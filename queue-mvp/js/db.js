import { get, post } from "./api.js";
import { getAuth } from "./auth.js";
import {
  connectSocket,
  getSocket,
  subscribeToQueue,
  unsubscribeFromQueue,
  SOCKET_EVENTS,
} from "./socket.js";
import {
  mapClinic,
  mapDoctor,
  mapAppointment,
  buildQueueFromAppointments,
  getQueueStats,
  slotTimeToHHMM,
} from "./mappers.js";
import { getSlotIndex, getTotalSlots, getAllSlotTimes } from "./utils/slots.js";
import { todayStr } from "./utils/dates.js";

export const isFirebaseConfigured = false;
export const usingFirebase = false;

const APPT_CACHE_KEY = "ws-appt-cache";
const durationCache = new Map();

function loadApptCache() {
  try {
    const raw = localStorage.getItem(APPT_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveApptToCache(appt) {
  const cache = loadApptCache();
  cache[appt.id] = appt;
  localStorage.setItem(APPT_CACHE_KEY, JSON.stringify(cache));
}

function getFromCache(id) {
  return loadApptCache()[id] || null;
}

async function fetchAvail(doctorId, date) {
  const res = await get("/avail", { doctorId, date });
  return res.data;
}

async function fetchDoctorDay(doctorId, date) {
  const avail = await fetchAvail(doctorId, date);
  const slots = avail.slots || [];
  const duration = await getDoctorSlotDuration(doctorId);
  const totalSlots = slots.length;

  const appointments = slots
    .filter((s) => s.appointment)
    .map((s) => mapAppointment(s.appointment, s, totalSlots));

  const queue = buildQueueFromAppointments(doctorId, date, appointments);
  const stats = getQueueStats(queue, appointments);

  return { queue, appointments, stats, duration, slots };
}

// ─── Public API (same signatures as Firebase db.js) ─────────────────

export async function getClinics() {
  const res = await get("/clinics");
  return (res.data || []).map(mapClinic);
}

export async function getClinic(clinicId) {
  const clinics = await getClinics();
  return clinics.find((c) => c.id === clinicId) || null;
}

export async function getDoctors(clinicId) {
  const res = await get("/doctors", { clinicId });
  const doctors = res.data || [];
  return Promise.all(
    doctors.map(async (d) => mapDoctor(d, await getDoctorSlotDuration(d.id))),
  );
}

export async function getDoctor(doctorId) {
  const res = await get(`/doctors/${doctorId}`);
  const doctor = res.data;
  if (!doctor) return null;
  return mapDoctor(doctor, await getDoctorSlotDuration(doctorId));
}

export async function getAllDoctors() {
  const res = await get("/doctors");
  const doctors = res.data || [];
  return Promise.all(
    doctors.map(async (d) => mapDoctor(d, await getDoctorSlotDuration(d.id))),
  );
}

export async function getQueue(doctorId, date = todayStr()) {
  const { queue } = await fetchDoctorDay(doctorId, date);
  return queue;
}

export async function getBookedSlotTimes(doctorId, date) {
  const avail = await fetchAvail(doctorId, date);
  const booked = new Set();
  for (const slot of avail.slots || []) {
    if (slot.status === "booked") {
      booked.add(slotTimeToHHMM(slot.slotTime));
    }
  }
  return booked;
}

export async function getDoctorDaySlots(doctorId, date) {
  const avail = await fetchAvail(doctorId, date);
  return {
    slots: avail.slots || [],
    message: avail.message || null,
  };
}

export async function getAppointmentsForDate(doctorId, date) {
  const { appointments } = await fetchDoctorDay(doctorId, date);
  return appointments.sort((a, b) => a.token - b.token);
}

export async function getAppointment(appointmentId) {
  const cached = getFromCache(appointmentId);
  if (cached) return cached;

  try {
    const res = await get("/patients/history");
    const history = res.data || [];
    const found = history.find((h) => h.id === appointmentId);
    if (found?.doctorId && found?.date) {
      const avail = await fetchAvail(found.doctorId, found.date);
      const slot = (avail.slots || []).find((s) => s.appointment?.id === appointmentId);
      if (slot?.appointment) {
        const appt = mapAppointment(slot.appointment, slot, avail.slots?.length ?? 0);
        saveApptToCache(appt);
        return appt;
      }
    }
  } catch {
    /* not logged in or no history */
  }

  return null;
}

export async function getDoctorSlotDuration(doctorId) {
  if (durationCache.has(doctorId)) return durationCache.get(doctorId);

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

export function calcWaitMinutes(patientToken, currentToken, slotMinutes = 30) {
  if (!patientToken || !currentToken) {
    const diff = Math.max(0, (patientToken || 0) - (currentToken || 0));
    return diff * slotMinutes;
  }
  const diff = Math.max(0, patientToken - currentToken);
  return diff * slotMinutes;
}

export { getQueueStats };

export async function bookAppointment({ name, doctorId, clinicId, date, slotTime, notes }) {
  const avail = await fetchAvail(doctorId, date);
  const slots = avail.slots || [];
  const duration = await getDoctorSlotDuration(doctorId);

  const slot = slots.find(
    (s) => slotTimeToHHMM(s.slotTime) === slotTime && s.status === "available",
  );
  if (!slot) {
    throw new Error("This slot is no longer available. Please pick another.");
  }

  const { user } = getAuth();
  const res = await post("/book", {
    clinicId,
    doctorId,
    slotId: slot.id,
    patientName: name,
    patientPhone: user?.phone || undefined,
    symptoms: notes || undefined,
  });

  const appointment = mapAppointment(res.data, slot, slots.length);
  saveApptToCache(appointment);
  return appointment;
}

async function adminAction(action, doctorId, date) {
  const res = await post(`/admin/${action}`, { doctorId, date });
  return res.data;
}

export function nextPatient(doctorId, date) {
  return adminAction("next", doctorId, date);
}

export function skipPatient(doctorId, date) {
  return adminAction("skip", doctorId, date);
}

export function markNoShow(doctorId, date) {
  return adminAction("no-show", doctorId, date);
}

export async function resetQueue() {
  throw new Error("Reset queue is not supported by the backend.");
}

export function subscribeToDoctorDay(doctorId, date, callback) {
  let unsubscribed = false;

  async function emit() {
    if (unsubscribed) return;
    try {
      const payload = await fetchDoctorDay(doctorId, date);
      callback(payload);
    } catch (err) {
      console.error("subscribeToDoctorDay error:", err);
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

export function subscribeToAppointment(appointmentId, callback) {
  let unsubscribed = false;
  let doctorId = null;
  let date = null;

  async function emit() {
    if (unsubscribed) return;
    try {
      let appt = await getAppointment(appointmentId);
      if (!appt) {
        callback(null);
        return;
      }

      doctorId = appt.doctor_id;
      date = appt.date;

      const { queue, duration } = await fetchDoctorDay(doctorId, date);
      const stats = getQueueStats(queue, [appt]);

      callback({ appointment: appt, queue, stats, duration });
    } catch (err) {
      console.error("subscribeToAppointment error:", err);
    }
  }

  function onSocketEvent() {
    emit();
  }

  connectSocket();

  emit().then(() => {
    if (doctorId && !unsubscribed) {
      subscribeToQueue(doctorId);
      const socket = getSocket();
      socket.on(SOCKET_EVENTS.QUEUE_UPDATE, onSocketEvent);
      socket.on(SOCKET_EVENTS.BOOKING_CREATED, onSocketEvent);
    }
  });

  const socket = getSocket();
  socket.on(SOCKET_EVENTS.QUEUE_UPDATE, onSocketEvent);
  socket.on(SOCKET_EVENTS.BOOKING_CREATED, onSocketEvent);

  return () => {
    unsubscribed = true;
    socket.off(SOCKET_EVENTS.QUEUE_UPDATE, onSocketEvent);
    socket.off(SOCKET_EVENTS.BOOKING_CREATED, onSocketEvent);
    if (doctorId) unsubscribeFromQueue(doctorId);
  };
}

export { getAllSlotTimes, getTotalSlots, getSlotIndex };
