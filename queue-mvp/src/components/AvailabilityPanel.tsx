import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, CalendarOff, ChevronDown, Loader2, Trash2 } from 'lucide-react';
import {
  addDoctorBreak,
  getDoctorBreaks,
  getDoctorSchedule,
  removeDoctorBreak,
  saveBookingWindow,
  saveDoctorSchedule,
} from '../lib/db';
import type { DoctorBreak, ScheduleDay } from '../lib/db';
import { formatDisplayDate } from '../lib/slotUtils';

interface Props {
  doctorId: string;
  doctorName: string;
  /** Current booking window (days) as stored on the doctor. */
  bookingWindowDays: number;
}

// Shown Monday first; values are JS day numbers (0 = Sunday), as the API stores them.
const WEEK = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 0, label: 'Sun' },
];
const SLOT_LENGTHS = [10, 15, 20, 30, 45, 60];
const WINDOWS = [1, 2, 3, 4, 5, 7, 14, 30, 60];
const DEFAULT_START = '09:00';
const DEFAULT_END = '17:00';

interface DayState {
  on: boolean;
  start: string;
  end: string;
}

function emptyWeek(): Record<number, DayState> {
  return Object.fromEntries(WEEK.map((w) => [w.day, { on: false, start: DEFAULT_START, end: DEFAULT_END }]));
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const inputCls =
  'rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-primary focus:outline-none';

/** Working days / hours, slot length, booking window and blocked dates for one doctor. The API enforces who may edit. */
export default function AvailabilityPanel({ doctorId, doctorName, bookingWindowDays }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [week, setWeek] = useState<Record<number, DayState>>(emptyWeek);
  const [slotLength, setSlotLength] = useState(15);
  const [windowDays, setWindowDays] = useState(bookingWindowDays);
  const [savedWindow, setSavedWindow] = useState(bookingWindowDays);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [breaks, setBreaks] = useState<DoctorBreak[]>([]);
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [reason, setReason] = useState('');
  const [breakBusy, setBreakBusy] = useState(false);
  const [breakError, setBreakError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [schedule, brks] = await Promise.all([getDoctorSchedule(doctorId), getDoctorBreaks(doctorId)]);
      const next = emptyWeek();
      for (const s of schedule) next[s.dayOfWeek] = { on: true, start: s.startTime, end: s.endTime };
      setWeek(next);
      if (schedule[0]) setSlotLength(schedule[0].slotDurationMinutes);
      const today = todayIso();
      setBreaks(brks.filter((b) => b.endDate >= today));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load availability.');
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  // Load when first opened, and again if the doctor changes while open.
  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // The stored window changed (another doctor selected, or the list reloaded).
  useEffect(() => {
    setWindowDays(bookingWindowDays);
    setSavedWindow(bookingWindowDays);
    setSaveMsg(null);
  }, [doctorId, bookingWindowDays]);

  const setDay = (day: number, patch: Partial<DayState>) =>
    setWeek((w) => ({ ...w, [day]: { ...w[day], ...patch } }));

  const save = async () => {
    setSaveMsg(null);
    const schedules: ScheduleDay[] = [];
    for (const { day, label } of WEEK) {
      const d = week[day];
      if (!d.on) continue;
      if (!d.start || !d.end || d.end <= d.start) {
        setSaveMsg({ ok: false, text: `${label}: end time must be after start time.` });
        return;
      }
      if (timeToMinutes(d.end) - timeToMinutes(d.start) < slotLength) {
        setSaveMsg({ ok: false, text: `${label}: hours are shorter than one ${slotLength}-minute slot.` });
        return;
      }
      schedules.push({ dayOfWeek: day, startTime: d.start, endTime: d.end, slotDurationMinutes: slotLength });
    }
    setSaving(true);
    try {
      await saveDoctorSchedule(doctorId, schedules);
      if (windowDays !== savedWindow) {
        await saveBookingWindow(doctorId, windowDays);
        setSavedWindow(windowDays);
      }
      setSaveMsg({
        ok: true,
        text: schedules.length
          ? 'Saved. Days that already have bookings keep their current slots.'
          : 'Saved. No working days: patients cannot book this doctor.',
      });
    } catch (e) {
      setSaveMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save.' });
    } finally {
      setSaving(false);
    }
  };

  const addBlock = async () => {
    setBreakError('');
    if (!from || !to || to < from) {
      setBreakError('Pick a start date and an end date on or after it.');
      return;
    }
    setBreakBusy(true);
    try {
      await addDoctorBreak(doctorId, from, to, reason.trim() || undefined);
      setReason('');
      setBreaks(await getDoctorBreaks(doctorId).then((b) => b.filter((x) => x.endDate >= todayIso())));
    } catch (e) {
      setBreakError(e instanceof Error ? e.message : 'Could not block those dates.');
    } finally {
      setBreakBusy(false);
    }
  };

  const unblock = async (id: string) => {
    setBreakBusy(true);
    setBreakError('');
    try {
      await removeDoctorBreak(doctorId, id);
      setBreaks((b) => b.filter((x) => x.id !== id));
    } catch (e) {
      setBreakError(e instanceof Error ? e.message : 'Could not remove that block.');
    } finally {
      setBreakBusy(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white card-shadow">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <CalendarClock className="h-4 w-4 text-primary" />
          Availability
          <span className="truncate text-xs font-normal text-slate-400">{doctorName}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-5 px-4 pb-4">
          {loading && (
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </p>
          )}
          {loadError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{loadError}</p>}

          {!loading && !loadError && (
            <>
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase text-slate-400">Working days & hours</h3>
                {WEEK.map(({ day, label }) => (
                  <div key={day} className="flex items-center gap-2">
                    <label className="flex w-16 items-center gap-2 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={week[day].on}
                        onChange={(e) => setDay(day, { on: e.target.checked })}
                        className="h-4 w-4 accent-primary"
                      />
                      {label}
                    </label>
                    {week[day].on ? (
                      <>
                        <input
                          type="time"
                          aria-label={`${label} start`}
                          value={week[day].start}
                          onChange={(e) => setDay(day, { start: e.target.value })}
                          className={inputCls}
                        />
                        <span className="text-xs text-slate-400">to</span>
                        <input
                          type="time"
                          aria-label={`${label} end`}
                          value={week[day].end}
                          onChange={(e) => setDay(day, { end: e.target.value })}
                          className={inputCls}
                        />
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">Off</span>
                    )}
                  </div>
                ))}
              </section>

              <section className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold uppercase text-slate-400">
                  Slot length
                  <select
                    value={slotLength}
                    onChange={(e) => setSlotLength(Number(e.target.value))}
                    className={`${inputCls} mt-1 w-full text-slate-800`}
                  >
                    {[...new Set([...SLOT_LENGTHS, slotLength])].sort((a, b) => a - b).map((m) => (
                      <option key={m} value={m}>
                        {m} minutes
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold uppercase text-slate-400">
                  Patients can book
                  <select
                    value={windowDays}
                    onChange={(e) => setWindowDays(Number(e.target.value))}
                    className={`${inputCls} mt-1 w-full text-slate-800`}
                  >
                    {[...new Set([...WINDOWS, windowDays])].sort((a, b) => a - b).map((n) => (
                      <option key={n} value={n}>
                        {n === 1 ? 'Today only' : `Next ${n} days`}
                      </option>
                    ))}
                  </select>
                </label>
              </section>

              <div>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save availability
                </button>
                {saveMsg && (
                  <p className={`mt-2 text-xs ${saveMsg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{saveMsg.text}</p>
                )}
              </div>

              <section className="space-y-2 border-t border-slate-100 pt-4">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-400">
                  <CalendarOff className="h-3.5 w-3.5" /> Blocked dates
                </h3>
                {breaks.length === 0 && <p className="text-xs text-slate-500">No upcoming blocked dates.</p>}
                {breaks.map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <div className="min-w-0 text-sm">
                      <p className="font-medium text-slate-800">
                        {b.startDate === b.endDate
                          ? formatDisplayDate(b.startDate)
                          : `${formatDisplayDate(b.startDate)} → ${formatDisplayDate(b.endDate)}`}
                      </p>
                      {b.reason && <p className="truncate text-xs text-slate-500">{b.reason}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => unblock(b.id)}
                      disabled={breakBusy}
                      aria-label="Unblock these dates"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <div className="flex flex-wrap items-end gap-2 pt-1">
                  <label className="text-xs text-slate-500">
                    From
                    <input
                      type="date"
                      value={from}
                      min={todayIso()}
                      onChange={(e) => {
                        setFrom(e.target.value);
                        if (to < e.target.value) setTo(e.target.value);
                      }}
                      className={`${inputCls} mt-1 block`}
                    />
                  </label>
                  <label className="text-xs text-slate-500">
                    To
                    <input
                      type="date"
                      value={to}
                      min={from}
                      onChange={(e) => setTo(e.target.value)}
                      className={`${inputCls} mt-1 block`}
                    />
                  </label>
                  <input
                    type="text"
                    value={reason}
                    maxLength={200}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason (optional)"
                    className={`${inputCls} min-w-0 flex-1`}
                  />
                  <button
                    type="button"
                    onClick={addBlock}
                    disabled={breakBusy}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-primary hover:text-primary disabled:opacity-50"
                  >
                    Block dates
                  </button>
                </div>
                {breakError && <p className="text-xs text-red-600">{breakError}</p>}
                <p className="text-[11px] text-slate-400">
                  Blocking a date hides it from patients. Appointments already booked on it stay on the queue.
                </p>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function timeToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
