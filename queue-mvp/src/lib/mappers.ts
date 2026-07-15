import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import type { Appointment, AppointmentStatus } from './types';
import { formatTime12, isToday, nowMinutes, timeToMinutes } from './dates';

dayjs.extend(utc);

const CLINIC_IMG =
  'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&q=80';
const DOC_MALE =
  'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=200&q=80';
const DOC_FEMALE =
  'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&q=80';

export function slotTimeToHHMM(slotTime: string): string {
  if (!slotTime) return '00:00';
  return dayjs.utc(slotTime).format('HH:mm');
}

export function mapStatus(status: string | undefined): AppointmentStatus {
  if (!status) return 'waiting';
  if (status === 'no-show') return 'no_show';
  if (status === 'in-cabin') return 'in-cabin';
  return status as AppointmentStatus;
}

export function mapClinic(clinic: {
  id: string;
  name?: string;
  address?: string;
  hours?: string;
  image_url?: string;
}) {
  const name = clinic.name || '';
  const parts = name.split(/[—–-]/).map((s) => s.trim());
  const branch = parts.length > 1 ? parts[parts.length - 1] : name;

  return {
    id: clinic.id,
    name,
    branch,
    address: clinic.address || '',
    hours: clinic.hours || '9:00 AM – 2:00 PM • 4:00 PM – 6:00 PM',
    image_url: clinic.image_url || CLINIC_IMG,
  };
}

export function mapDoctor(
  doctor: {
    id: string;
    name: string;
    clinicId: string;
    specialization: string;
    experienceYears?: number;
    photo_url?: string;
  },
  slotDurationMinutes = 30,
) {
  const isFemale =
    doctor.specialization?.toLowerCase().includes('pediatr') ||
    doctor.name?.toLowerCase().includes('priya') ||
    doctor.name?.toLowerCase().includes('vandana');

  return {
    id: doctor.id,
    name: doctor.name,
    clinic_id: doctor.clinicId,
    specialization: doctor.specialization,
    experience_years: doctor.experienceYears ?? 0,
    slot_duration_minutes: slotDurationMinutes,
    photo_url: doctor.photo_url || (isFemale ? DOC_FEMALE : DOC_MALE),
  };
}

interface BackendSlot {
  id: string;
  date?: string;
  slotTime: string;
  slotIndex?: number;
}

interface BackendAppointment {
  id: string;
  patientName: string;
  patientPhone?: string;
  doctorId: string;
  clinicId: string;
  date?: string;
  tokenNumber: number;
  status: string;
  symptoms?: string;
  createdAt?: string;
}

export function mapAppointment(
  appointment: BackendAppointment,
  slot: BackendSlot | null,
  totalSlots = 0,
) {
  const rawStatus = appointment.status;
  const time24 = slot ? slotTimeToHHMM(slot.slotTime) : '';
  return {
    id: appointment.id,
    name: appointment.patientName,
    phone: appointment.patientPhone || '',
    doctor_id: appointment.doctorId,
    clinic_id: appointment.clinicId,
    date: slot?.date || appointment.date || '',
    slot_time: time24 ? formatTime12(time24) : '',
    slot_time_24h: time24,
    slot_index: slot ? (slot.slotIndex ?? 0) + 1 : 0,
    total_slots: totalSlots,
    token: appointment.tokenNumber,
    status: mapStatus(rawStatus),
    _rawStatus: rawStatus,
    notes: appointment.symptoms || '',
    created_at: appointment.createdAt || new Date().toISOString(),
    _slotId: slot?.id,
  };
}

export function mapHistoryItem(item: {
  id: string;
  tokenNumber: number;
  status: string;
  doctorId: string;
  doctorName?: string;
  date: string;
  slotTime: string;
  patientName: string;
  symptoms?: string;
  clinicId?: string;
  patientPhone?: string;
}): Appointment {
  const time24 = slotTimeToHHMM(item.slotTime);
  return {
    id: item.id,
    name: item.patientName,
    phone: item.patientPhone || '',
    doctor_id: item.doctorId,
    clinic_id: item.clinicId || '',
    date: item.date,
    slot_time: time24 ? formatTime12(time24) : '',
    slot_time_24h: time24,
    slot_index: 0,
    total_slots: 0,
    token: item.tokenNumber,
    status: mapStatus(item.status),
    _rawStatus: item.status,
    notes: item.symptoms || '',
    created_at: '',
  };
}

export function buildQueueFromAppointments(
  doctorId: string,
  date: string,
  appointments: Appointment[],
) {
  const inCabin = appointments.find((a) => a._rawStatus === 'in-cabin');
  const nowServing = inCabin?.token ?? 0;
  const maxToken = appointments.reduce((max, a) => Math.max(max, a.token || 0), 0);

  return {
    doctor_id: doctorId,
    date,
    current_token: nowServing,
    last_token: maxToken,
  };
}

export function getQueueStatsFromAppointments(queue: { current_token?: number }, appointments: Appointment[]) {
  const current = queue?.current_token ?? 0;
  const active = appointments.filter((a) => a.status !== 'cancelled');
  const inCabin = active.find((a) => a._rawStatus === 'in-cabin');
  const waiting = active.filter(
    (a) => a._rawStatus === 'waiting' && (current === 0 || a.token > current),
  );

  const sessionEnded =
    active.length > 0 && !inCabin && waiting.length === 0 && current === 0;

  return {
    nowServing: current > 0 ? current : null,
    booked: active.length,
    waiting: waiting.length,
    inCabin,
    waitingList: waiting,
    sessionEnded,
  };
}

export function toKvtQueueStats(
  queue: { current_token?: number; last_token?: number; session_ended?: boolean },
  appointments: Appointment[],
) {
  const stats = getQueueStatsFromAppointments(queue, appointments);
  return {
    currentToken: queue?.current_token ?? 0,
    lastToken: queue?.last_token ?? 0,
    waiting: stats.waiting,
    booked: stats.booked,
    sessionEnded: queue?.session_ended ?? stats.sessionEnded,
  };
}

export function isSlotPast(dateStr: string, slotTime24: string): boolean {
  if (!isToday(dateStr)) return false;
  return timeToMinutes(slotTime24) <= nowMinutes();
}

const AFTERNOON_SPLIT = 14 * 60;

interface ServerSlot {
  slotTime: string;
  status: string;
  id: string;
}

export interface SlotEntry {
  time: string;
  status: string;
  slot: ServerSlot;
}

export function groupServerSlots(serverSlots: ServerSlot[] = []) {
  const morning: SlotEntry[] = [];
  const afternoon: SlotEntry[] = [];

  for (const slot of serverSlots) {
    const time = slotTimeToHHMM(slot.slotTime);
    const minutes = timeToMinutes(time);
    const entry: SlotEntry = { time, status: slot.status, slot };
    if (minutes < AFTERNOON_SPLIT) morning.push(entry);
    else afternoon.push(entry);
  }

  morning.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  afternoon.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

  return {
    morning,
    afternoon,
    all: [...morning, ...afternoon],
    hasSlots: serverSlots.length > 0,
  };
}

export function formatSlotGroupLabel(times: SlotEntry[], fallback: string): string {
  if (!times.length) return fallback;
  const first = formatTime12(times[0].time);
  const last = formatTime12(times[times.length - 1].time);
  return `${first} – ${last}`;
}

export function getServerSlotAvailability(dateStr: string, slotEntry: SlotEntry): string {
  if (isSlotPast(dateStr, slotEntry.time)) return 'past';
  if (slotEntry.status === 'booked') return 'booked';
  if (slotEntry.status !== 'available') return 'unavailable';
  return 'available';
}
