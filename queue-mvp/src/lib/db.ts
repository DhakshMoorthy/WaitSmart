import { get, post, patch, del, uploadFile, apiBaseUrl, wakeApi } from './api';
import { compareQueueOrder } from './slotUtils';
import { getAuth, hydrate, setUser } from './auth';
import {
  connectSocket,
  getSocket,
  subscribeToQueue,
  unsubscribeFromQueue,
  SOCKET_EVENTS,
} from './socket';
import {
  mapClinic,
  mapDoctor,
  mapAppointment,
  mapHistoryItem,
  buildQueueFromAppointments,
  toKvtQueueStats,
  slotTimeToHHMM,
} from './mappers';
import { todayStr } from './dates';
import { SAVED_TOKENS_KEY } from './constants';
import { normalizePhone, toE164 } from './phone';
import type { Appointment, AppointmentStatus, Queue, QueueStats, SavedToken } from './types';

export const isFirebaseConfigured = false;
export const usingFirebase = false;

const APPT_CACHE_KEY = 'ws-appt-cache';
const durationCache = new Map<string, number>();
const availCache = new Map<string, { data: Awaited<ReturnType<typeof fetchAvail>>; ts: number }>();
const AVAIL_CACHE_TTL = 30_000;

function loadApptCache(): Record<string, Appointment> {
  try {
    const raw = localStorage.getItem(APPT_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveApptToCache(appt: Appointment) {
  const cache = loadApptCache();
  cache[appt.id] = appt;
  localStorage.setItem(APPT_CACHE_KEY, JSON.stringify(cache));
}

function getFromCache(id: string): Appointment | null {
  return loadApptCache()[id] || null;
}

function removeFromCache(id: string) {
  const cache = loadApptCache();
  delete cache[id];
  localStorage.setItem(APPT_CACHE_KEY, JSON.stringify(cache));
}

async function fetchAvail(doctorId: string, date: string) {
  const cacheKey = `${doctorId}_${date}`;
  const cached = availCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < AVAIL_CACHE_TTL) {
    return cached.data;
  }
  const res = await get('/avail', { doctorId, date });
  const data = res.data;
  availCache.set(cacheKey, { data, ts: Date.now() });
  return data;
}

function invalidateAvailCache(doctorId: string, date: string) {
  availCache.delete(`${doctorId}_${date}`);
}

async function fetchDoctorDay(doctorId: string, date: string) {
  const avail = await fetchAvail(doctorId, date);
  const slots = avail.slots || [];
  const duration = await getDoctorSlotDuration(doctorId);
  const totalSlots = slots.length;

  const appointments = slots
    .filter((s: { appointment?: unknown }) => s.appointment)
    .map((s: { appointment: Parameters<typeof mapAppointment>[0]; slotTime: string; date?: string; slotIndex?: number; id: string }) =>
      mapAppointment(s.appointment, s, totalSlots),
    );

  const queue = buildQueueFromAppointments(doctorId, date, appointments, avail.queueState);
  const stats = toKvtQueueStats(queue, appointments);

  return { queue, appointments, stats, duration, slots };
}

// ─── Boot ───────────────────────────────────────────────────────────

export async function initializeDatabase(): Promise<void> {
  hydrate();
  await wakeApi();
}

export function getDbModeLabel(): string {
  return 'WaitSmart API';
}

// ─── Reads ──────────────────────────────────────────────────────────

export async function getClinics() {
  const res = await get('/clinics');
  return (res.data || []).map(mapClinic);
}

export async function getClinic(clinicId: string) {
  const clinics = await getClinics();
  return clinics.find((c) => c.id === clinicId) || null;
}

export async function getDoctors(clinicId?: string, opts: { onlyUserId?: string } = {}) {
  const res = clinicId
    ? await get('/doctors', { clinicId })
    : await get('/doctors');
  let doctors = res.data || [];
  // A doctor login manages only its own queue: keep just the doctor record linked to that user.
  if (opts.onlyUserId) {
    doctors = doctors.filter((d: { userId?: string | null }) => d.userId === opts.onlyUserId);
  }
  return Promise.all(
    doctors.map(async (d: Parameters<typeof mapDoctor>[0]) =>
      mapDoctor(d, await getDoctorSlotDuration(d.id)),
    ),
  );
}

export async function getDoctor(doctorId: string) {
  const res = await get(`/doctors/${doctorId}`);
  const doctor = res.data;
  if (!doctor) return null;
  return mapDoctor(doctor, await getDoctorSlotDuration(doctorId));
}

export async function getAllDoctors() {
  return getDoctors();
}

export async function getQueue(doctorId: string, date = todayStr()): Promise<Queue> {
  const { queue } = await fetchDoctorDay(doctorId, date);
  return queue;
}

export async function getBookedSlotTimes(doctorId: string, date: string): Promise<Set<string>> {
  const avail = await fetchAvail(doctorId, date);
  const booked = new Set<string>();
  for (const slot of avail.slots || []) {
    if (slot.status === 'booked') {
      booked.add(slotTimeToHHMM(slot.slotTime));
    }
  }
  return booked;
}

export async function getDoctorDaySlots(doctorId: string, date: string) {
  const avail = await fetchAvail(doctorId, date);
  return {
    slots: avail.slots || [],
    message: avail.message || null,
  };
}

export async function getAppointments(doctorId: string, date: string): Promise<Appointment[]> {
  const { appointments } = await fetchDoctorDay(doctorId, date);
  return appointments.sort(compareQueueOrder);
}

export async function getAppointment(appointmentId: string): Promise<Appointment | null> {
  const cached = getFromCache(appointmentId);
  if (cached) return cached;

  try {
    const res = await get('/patients/history');
    const history = res.data || [];
    const found = history.find((h: { id: string }) => h.id === appointmentId);
    if (found?.doctorId && found?.date) {
      invalidateAvailCache(found.doctorId, found.date);
      const avail = await fetchAvail(found.doctorId, found.date);
      const slot = (avail.slots || []).find(
        (s: { appointment?: { id: string } }) => s.appointment?.id === appointmentId,
      );
      if (slot?.appointment) {
        const appt = mapAppointment(slot.appointment, slot, avail.slots?.length ?? 0);
        saveApptToCache(appt);
        return appt;
      }
      const mapped = mapHistoryItem(found);
      saveApptToCache(mapped);
      return mapped;
    }
  } catch {
    /* not logged in or no history */
  }

  return null;
}

export async function getDoctorSlotDuration(doctorId: string): Promise<number> {
  if (durationCache.has(doctorId)) return durationCache.get(doctorId)!;

  try {
    const res = await get(`/doctors/${doctorId}/schedules`);
    const schedules = res.data || [];
    const duration = schedules[0]?.slotDurationMinutes ?? 30;
    durationCache.set(doctorId, duration);
    return duration;
  } catch {
    return 30;
  }
}

export async function getQueueStats(doctorId: string, date: string): Promise<QueueStats> {
  const { stats } = await fetchDoctorDay(doctorId, date);
  return stats;
}

export async function getBookingCountsByDate(
  doctorId: string,
  dates: string[],
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  await Promise.all(
    dates.map(async (date) => {
      try {
        const avail = await fetchAvail(doctorId, date);
        const booked = (avail.slots || []).filter(
          (s: { status: string }) => s.status === 'booked',
        ).length;
        counts[date] = booked;
      } catch {
        counts[date] = 0;
      }
    }),
  );
  return counts;
}

export async function getAppointmentsByPhone(phone: string): Promise<Appointment[]> {
  const normalized = normalizePhone(phone);
  const res = await get('/patients/history');
  const history = res.data || [];
  return history
    .filter((h: { patientPhone?: string }) => {
      if (!h.patientPhone) return true;
      return normalizePhone(h.patientPhone) === normalized;
    })
    .map(mapHistoryItem)
    .sort((a: Appointment, b: Appointment) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.token - a.token;
    });
}

// ─── Patient profile / favorites / family ───────────────────────────

export async function getPatientProfile() {
  const res = await get('/patients/profile');
  return res.data;
}

export async function updatePatientProfile(input: { name?: string; phone?: string }) {
  const body: { name?: string; phone?: string } = {};
  if (input.name) body.name = input.name;
  if (input.phone) body.phone = toE164(input.phone);
  const res = await patch('/patients/profile', body);
  const profile = res.data;
  const { user } = getAuth();
  if (user && profile) {
    setUser({
      ...user,
      name: profile.name ?? user.name,
      phone: profile.phone ?? user.phone,
    });
  }
  return profile;
}

export async function getFavoriteDoctors() {
  const res = await get('/patients/favorites');
  const doctors = res.data || [];
  return Promise.all(
    doctors.map(async (d: Parameters<typeof mapDoctor>[0]) =>
      mapDoctor(d, await getDoctorSlotDuration(d.id)),
    ),
  );
}

export async function addFavoriteDoctor(doctorId: string) {
  await post('/patients/favorites', { doctorId });
}

export async function removeFavoriteDoctor(doctorId: string) {
  await del(`/patients/favorites/${doctorId}`);
}

export async function getFamilyMembers() {
  const res = await get('/patients/family');
  return res.data || [];
}

export async function addFamilyMember(input: {
  name: string;
  relationship: string;
  age?: number;
  phone?: string;
}) {
  const res = await post('/patients/family', {
    name: input.name,
    relationship: input.relationship,
    age: input.age,
    phone: input.phone ? toE164(input.phone) : undefined,
  });
  return res.data;
}

export function fileUrl(fileId: string) {
  return `${apiBaseUrl()}/files/${fileId}`;
}

export async function uploadAppointmentFile(file: File) {
  const res = await uploadFile(file);
  return res.data as { id: string; filename: string; mimeType: string };
}

// ─── Saved tokens (local) ───────────────────────────────────────────

export function getSavedTokens(): SavedToken[] {
  try {
    const raw = localStorage.getItem(SAVED_TOKENS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTokenLocally(appointment: Appointment) {
  const tokens = getSavedTokens();
  const entry: SavedToken = {
    appointmentId: appointment.id,
    doctorId: appointment.doctor_id,
    clinicId: appointment.clinic_id,
    date: appointment.date,
    patientName: appointment.name,
    phone: appointment.phone,
    slotTime: appointment.slot_time,
    token: appointment.token,
  };
  const filtered = tokens.filter((t) => t.appointmentId !== entry.appointmentId);
  filtered.unshift(entry);
  localStorage.setItem(SAVED_TOKENS_KEY, JSON.stringify(filtered.slice(0, 10)));
}

function removeSavedToken(appointmentId: string) {
  const tokens = getSavedTokens().filter((t) => t.appointmentId !== appointmentId);
  localStorage.setItem(SAVED_TOKENS_KEY, JSON.stringify(tokens));
}

// ─── Writes ─────────────────────────────────────────────────────────

export async function bookAppointment(input: {
  name: string;
  phone?: string;
  doctorId: string;
  clinicId: string;
  date: string;
  slotTime: string;
  notes?: string;
  fileId?: string;
}) {
  const { doctorId, date, slotTime, name, clinicId, notes, phone, fileId } = input;
  invalidateAvailCache(doctorId, date);
  const avail = await fetchAvail(doctorId, date);
  const slots = avail.slots || [];

  const slot = slots.find(
    (s: { slotTime: string; status: string }) =>
      slotTimeToHHMM(s.slotTime) === slotTime && s.status === 'available',
  );
  if (!slot) {
    throw new Error('This slot is no longer available. Please pick another.');
  }

  const { user } = getAuth();
  const res = await post('/book', {
    clinicId,
    doctorId,
    slotId: slot.id,
    patientName: name,
    patientPhone: phone || user?.phone || undefined,
    symptoms: notes || undefined,
    fileId: fileId || undefined,
  });

  const appointment = mapAppointment(res.data, slot, slots.length);
  saveApptToCache(appointment);
  saveTokenLocally(appointment);
  return appointment;
}

export async function cancelAppointment(appointmentId: string) {
  const cached = getFromCache(appointmentId);
  const res = await post('/cancel', { appointmentId });
  if (cached) {
    invalidateAvailCache(cached.doctor_id, cached.date);
  }
  removeFromCache(appointmentId);
  removeSavedToken(appointmentId);
  return res.data;
}

export async function rescheduleAppointment(appointmentId: string, newSlotId: string) {
  const cached = getFromCache(appointmentId);
  const res = await post('/reschedule', { appointmentId, newSlotId });
  if (cached) {
    invalidateAvailCache(cached.doctor_id, cached.date);
    removeFromCache(appointmentId);
    removeSavedToken(appointmentId);
  }
  return res.data;
}

async function adminAction(action: string, doctorId: string, date: string) {
  invalidateAvailCache(doctorId, date);
  const res = await post(`/admin/${action}`, { doctorId, date });
  return res.data;
}

export async function advanceQueue(
  doctorId: string,
  date: string,
  action: 'next' | 'skip',
) {
  return adminAction(action, doctorId, date);
}

export async function endSession(doctorId: string, date: string) {
  return adminAction('done', doctorId, date);
}

export async function markNoShow(doctorId: string, date: string) {
  return adminAction('no-show', doctorId, date);
}

export async function undoLastAction(doctorId: string, date: string) {
  return adminAction('undo', doctorId, date);
}

export async function resetQueue(doctorId: string, date: string) {
  return adminAction('reset', doctorId, date);
}

export async function updateDoctorNotes(appointmentId: string, doctorNotes: string) {
  const res = await patch('/admin/doctor-notes', {
    appointmentId,
    doctorNotes: doctorNotes.trim() || null,
  });
  return res.data;
}

export async function updateAppointmentStatusAdmin(
  appointmentId: string,
  status: AppointmentStatus,
  doctorId: string,
  date: string,
) {
  invalidateAvailCache(doctorId, date);
  const backendStatus = status === 'no_show' ? 'no-show' : status;
  const res = await patch('/admin/appointment-status', {
    appointmentId,
    status: backendStatus,
  });
  return res.data;
}

// ─── Real-time subscriptions ────────────────────────────────────────

function subscribeDoctorDayInternal(
  doctorId: string,
  date: string,
  callback: (payload: Awaited<ReturnType<typeof fetchDoctorDay>>) => void,
) {
  let unsubscribed = false;

  async function emit() {
    if (unsubscribed) return;
    try {
      invalidateAvailCache(doctorId, date);
      const payload = await fetchDoctorDay(doctorId, date);
      callback(payload);
    } catch (err) {
      console.error('subscribeToDoctorDay error:', err);
    }
  }

  function onSocketEvent() {
    emit();
  }

  connectSocket();
  subscribeToQueue(doctorId);

  const socket = getSocket();
  socket.on(SOCKET_EVENTS.QUEUE_UPDATE, onSocketEvent);
  socket.on(SOCKET_EVENTS.BOOKING_CREATED, onSocketEvent);

  emit();

  return () => {
    unsubscribed = true;
    socket.off(SOCKET_EVENTS.QUEUE_UPDATE, onSocketEvent);
    socket.off(SOCKET_EVENTS.BOOKING_CREATED, onSocketEvent);
    unsubscribeFromQueue(doctorId);
  };
}

export function subscribeQueue(
  doctorId: string,
  date: string,
  callback: (queue: Queue) => void,
) {
  const unsub = subscribeDoctorDayInternal(doctorId, date, ({ queue, appointments }) => {
    const stats = toKvtQueueStats(queue, appointments);
    callback({
      ...queue,
      session_ended: stats.sessionEnded,
    });
  });
  return unsub;
}

export function subscribeAppointments(
  doctorId: string,
  date: string,
  callback: (appointments: Appointment[]) => void,
) {
  const unsub = subscribeDoctorDayInternal(doctorId, date, ({ appointments }) => {
    callback(appointments.sort(compareQueueOrder));
  });
  return unsub;
}

export function subscribeDoctorQueues(
  doctorId: string,
  date: string,
  callback: (stats: QueueStats) => void,
) {
  const unsub = subscribeDoctorDayInternal(doctorId, date, ({ stats }) => {
    callback(stats);
  });
  return unsub;
}

export function subscribeToDoctorDay(
  doctorId: string,
  date: string,
  callback: () => void,
) {
  return subscribeDoctorDayInternal(doctorId, date, () => callback());
}
