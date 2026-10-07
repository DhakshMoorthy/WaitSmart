import type { Appointment, AppointmentStatus } from './types';
import { formatTime12, timeToMinutes } from './dates';

export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDisplayDate(iso: string): string {
  const date = parseDateISO(iso);
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function getDateOptions(count = 3): { iso: string; label: string }[] {
  const options: { iso: string; label: string }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const labels = ['Today', 'Tomorrow', 'Day after'];

  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    options.push({
      iso: formatDateISO(d),
      label: labels[i] ?? d.toLocaleDateString('en-IN', { weekday: 'short' }),
    });
  }
  return options;
}

function resolveTime24(slotTime: string, slotTime24h?: string): string {
  if (slotTime24h) return slotTime24h;
  if (/^\d{2}:\d{2}$/.test(slotTime)) return slotTime;
  return '09:00';
}

/** Queue order: by appointment time, token number only breaks ties (matches the server). */
export function compareQueueOrder(a: Appointment, b: Appointment): number {
  const ta = a.slot_time_24h || '';
  const tb = b.slot_time_24h || '';
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.token - b.token;
}

export function getSlotDateTime(isoDate: string, slotTime: string, slotTime24h?: string): Date {
  const time24 = resolveTime24(slotTime, slotTime24h);
  const [h, m] = time24.split(':').map(Number);
  const d = parseDateISO(isoDate);
  d.setHours(h, m, 0, 0);
  return d;
}

export function minutesUntilSlot(isoDate: string, slotTime: string, slotTime24h?: string): number {
  const slotDt = getSlotDateTime(isoDate, slotTime, slotTime24h);
  const diffMs = slotDt.getTime() - Date.now();
  return Math.max(0, Math.round(diffMs / 60_000));
}

export function isSlotInFuture(isoDate: string, slotTime: string, slotTime24h?: string): boolean {
  return getSlotDateTime(isoDate, slotTime, slotTime24h).getTime() > Date.now();
}

export function isSlotPast(isoDate: string, slotTime: string, slotTime24h?: string): boolean {
  const todayIso = formatDateISO(new Date());
  if (isoDate !== todayIso) return false;
  const time24 = resolveTime24(slotTime, slotTime24h);
  const now = new Date();
  const [h, m] = time24.split(':').map(Number);
  const slotDate = new Date();
  slotDate.setHours(h, m, 0, 0);
  return slotDate.getTime() <= now.getTime();
}

export function estimateWaitMinutes(
  patientToken: number,
  currentToken: number,
  appointments: Appointment[] = [],
  patientStatus: AppointmentStatus = 'waiting',
  appointmentDate?: string,
  slotTime?: string,
  slotTime24h?: string,
  slotDurationMinutes = 30,
): number {
  if (['done', 'skipped', 'no_show', 'cancelled'].includes(patientStatus)) {
    return 0;
  }

  const todayIso = formatDateISO(new Date());
  const myTime = resolveTime24(slotTime ?? '', slotTime24h);
  const queueWait =
    appointments.filter(
      (a) =>
        a._rawStatus === 'waiting' &&
        a.token !== patientToken &&
        (a.slot_time_24h || '') !== '' &&
        ((a.slot_time_24h < myTime) || (a.slot_time_24h === myTime && a.token < patientToken)),
    ).length * slotDurationMinutes;

  if (
    appointmentDate === todayIso &&
    currentToken > 0 &&
    patientToken === currentToken
  ) {
    return 0;
  }

  if (appointmentDate && slotTime && isSlotInFuture(appointmentDate, slotTime, slotTime24h)) {
    const untilSlot = minutesUntilSlot(appointmentDate, slotTime, slotTime24h);
    if (appointmentDate === todayIso && currentToken > 0) {
      return Math.max(untilSlot, queueWait);
    }
    return untilSlot;
  }

  return queueWait;
}

export function formatWaitTime(minutes: number): string {
  if (minutes <= 0) return 'Now';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 1 && m === 0) return '1 hour';
  if (m === 0) return `${h} hours`;
  if (h === 1) return `1 hr ${m} min`;
  return `${h} hr ${m} min`;
}

export function getWaitLabel(waitMinutes: number): string {
  return formatWaitTime(waitMinutes);
}

export function isPastDate(iso: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parseDateISO(iso).getTime() < today.getTime();
}

export function getCalendarDays(pastDays = 14, futureDays = 14) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = formatDateISO(today);
  const total = pastDays + futureDays + 1;

  return Array.from({ length: total }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - pastDays + i);
    const iso = formatDateISO(d);
    const offset = i - pastDays;
    return {
      iso,
      day: d.getDate(),
      weekday: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      isToday: iso === todayIso,
      isPast: iso < todayIso,
      month: d.toLocaleDateString('en-IN', { month: 'short' }),
      label:
        offset === 0
          ? 'Today'
          : offset === -1
            ? 'Yesterday'
            : offset === 1
              ? 'Tomorrow'
              : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    };
  });
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    waiting: 'Waiting',
    done: 'Done',
    skipped: 'Skipped',
    no_show: 'No show',
    cancelled: 'Cancelled',
    'in-cabin': 'In cabin',
  };
  return map[status] ?? status;
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    waiting: 'bg-blue-100 text-blue-700',
    done: 'bg-green-100 text-green-700',
    skipped: 'bg-yellow-100 text-yellow-800',
    no_show: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-600',
    'in-cabin': 'bg-purple-100 text-purple-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
}

export function formatSlotDisplay(time24: string): string {
  return formatTime12(time24);
}
