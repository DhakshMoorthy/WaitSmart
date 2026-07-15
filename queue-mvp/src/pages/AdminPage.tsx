import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  advanceQueue,
  endSession,
  getBookingCountsByDate,
  getDoctors,
  getQueueStats,
  markNoShow,
  subscribeAppointments,
  subscribeQueue,
} from '../lib/db';
import { post } from '../lib/api';
import { logout, setTokens, setUser } from '../lib/auth';
import { useIsAdmin } from '../hooks/useAuth';
import {
  formatDisplayDate,
  getCalendarDays,
  isPastDate,
  statusColor,
  statusLabel,
} from '../lib/slotUtils';
import { formatPhoneDisplay } from '../lib/phone';
import type { Appointment, Doctor, Queue } from '../lib/types';
import AdminCalendar from '../components/AdminCalendar';
import LiveBadge from '../components/LiveBadge';
import {
  ChevronDown,
  Loader2,
  LogOut,
  Radio,
  SkipForward,
  Square,
  UserX,
  Users,
} from 'lucide-react';

export default function AdminPage() {
  const isAdmin = useIsAdmin();
  const [authenticated, setAuthenticated] = useState(isAdmin);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [queue, setQueue] = useState<Queue | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [stats, setStats] = useState({
    currentToken: 0,
    lastToken: 0,
    waiting: 0,
    booked: 0,
    sessionEnded: false,
  });
  const [bookingCounts, setBookingCounts] = useState<Record<string, number>>({});
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  const calendarDays = useMemo(() => getCalendarDays(14, 14), []);
  const todayIso = calendarDays.find((d) => d.isToday)?.iso ?? calendarDays[14]?.iso ?? '';
  const isHistoryView = selectedDate ? isPastDate(selectedDate) : false;

  useEffect(() => {
    setAuthenticated(isAdmin);
  }, [isAdmin]);

  useEffect(() => {
    if (!authenticated) return;
    getDoctors().then((docs) => {
      setDoctors(docs);
      if (docs.length > 0 && !selectedDoctor) setSelectedDoctor(docs[0].id);
    });
    if (!selectedDate && todayIso) {
      setSelectedDate(todayIso);
    }
  }, [authenticated, todayIso, selectedDate, selectedDoctor]);

  useEffect(() => {
    if (!selectedDoctor) return;
    const dates = calendarDays.map((d) => d.iso);
    getBookingCountsByDate(selectedDoctor, dates).then(setBookingCounts);
  }, [selectedDoctor, appointments, calendarDays]);

  const refreshStats = useCallback(async () => {
    if (!selectedDoctor || !selectedDate) return;
    const s = await getQueueStats(selectedDoctor, selectedDate);
    setStats(s);
  }, [selectedDoctor, selectedDate]);

  useEffect(() => {
    if (!authenticated || !selectedDoctor || !selectedDate) return;
    const unsubQ = subscribeQueue(selectedDoctor, selectedDate, setQueue);
    const unsubA = subscribeAppointments(selectedDoctor, selectedDate, setAppointments);
    refreshStats();
    return () => {
      unsubQ();
      unsubA();
    };
  }, [authenticated, selectedDoctor, selectedDate, refreshStats]);

  useEffect(() => {
    refreshStats();
  }, [queue, appointments, refreshStats]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const data = await post('/auth/login', { email, password });
      setTokens(data.accessToken, data.refreshToken);
      setUser({
        id: data.user.id,
        email: data.user.email || null,
        name: data.user.name || null,
        phone: data.user.phone || null,
        role: data.user.role,
        tenantId: data.user.tenantId || null,
        doctorId: data.user.doctorId || null,
      });

      const role = data.user.role;
      if (role !== 'admin' && role !== 'doctor' && role !== 'superadmin') {
        logout();
        setLoginError('This account does not have admin or doctor access.');
        return;
      }
      setAuthenticated(true);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    setAuthenticated(false);
    setEmail('');
    setPassword('');
  };

  const runAction = async (fn: () => Promise<void>) => {
    if (!selectedDoctor || !selectedDate) return;
    setActionLoading(true);
    setActionError('');
    try {
      await fn();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const currentToken = queue?.current_token ?? 0;
  const sessionEnded = queue?.session_ended ?? stats.sessionEnded;
  const activePatient =
    appointments.find((a) => a._rawStatus === 'in-cabin') ??
    (currentToken > 0
      ? appointments.find(
          (a) => a.token === currentToken && a.status === 'waiting',
        ) ?? null
      : null);
  const noWaiting = stats.waiting === 0;
  const nextDisabled =
    isHistoryView || actionLoading || sessionEnded || (noWaiting && !activePatient);
  const skipDisabled = isHistoryView || actionLoading || sessionEnded || !activePatient;
  const endDisabled = isHistoryView || actionLoading || sessionEnded || stats.booked === 0;
  const noShowDisabled = skipDisabled;

  if (!authenticated) {
    return (
      <div className="mx-auto max-w-sm pt-8">
        <div className="rounded-2xl bg-white p-6 card-shadow">
          <h1 className="text-xl font-bold text-slate-900">Admin access</h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign in with your clinic account to manage queues
          </p>
          <form onSubmit={handleLogin} className="mt-5 space-y-4">
            <div>
              <label htmlFor="admin-email" className="mb-1 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@apollo.waitsmart.app"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                required
              />
            </div>
            <div>
              <label htmlFor="admin-password" className="mb-1 block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                required
              />
            </div>
            {loginError && (
              <p className="text-center text-sm text-red-500">{loginError}</p>
            )}
            <button
              type="submit"
              disabled={loginLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
            >
              {loginLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const selectedDoc = doctors.find((d) => d.id === selectedDoctor);

  return (
    <div className="space-y-5 pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Slot control</h1>
          <div className="mt-1 flex items-center gap-2">
            <LiveBadge label="SYNC" />
            <span className="text-xs text-slate-400">Live updates active</span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-red-200 hover:text-red-600"
        >
          <LogOut className="h-3.5 w-3.5" />
          Logout
        </button>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">
          Doctor
        </label>
        <div className="relative">
          <select
            value={selectedDoctor}
            onChange={(e) => setSelectedDoctor(e.target.value)}
            className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-8 text-sm outline-none focus:border-primary"
          >
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      <AdminCalendar
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        bookingCounts={bookingCounts}
      />

      <p className="text-center text-xs text-slate-500">
        Viewing <strong>{formatDisplayDate(selectedDate)}</strong>
        {isHistoryView && (
          <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            History
          </span>
        )}
      </p>

      {isHistoryView && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-center text-xs text-slate-600">
          Past date — read-only history. Queue controls are disabled.
        </div>
      )}

      {sessionEnded && (
        <div className="rounded-xl bg-slate-800 px-4 py-2.5 text-center text-sm font-medium text-white">
          Session ended — all patients served
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-primary p-3 text-center text-white">
          <p className="text-[10px] font-semibold uppercase opacity-80">Now serving</p>
          <p className="text-2xl font-bold">
            {activePatient ? `#${currentToken}` : '—'}
          </p>
        </div>
        <div className="rounded-xl bg-white p-3 text-center card-shadow">
          <p className="text-[10px] font-semibold uppercase text-slate-400">Booked</p>
          <p className="text-2xl font-bold text-slate-900">{stats.booked}</p>
        </div>
        <div className="rounded-xl bg-amber-50 p-3 text-center">
          <p className="text-[10px] font-semibold uppercase text-amber-700">Waiting</p>
          <p className="text-2xl font-bold text-amber-700">{stats.waiting}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 card-shadow">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Radio className="h-4 w-4 text-primary" />
          Currently in cabin
        </h2>
        {activePatient ? (
          <div className="space-y-3 rounded-xl bg-primary-light p-3">
            <div>
              <p className="font-semibold text-slate-900">{activePatient.name}</p>
              <p className="mt-1 text-sm text-slate-600">
                Token #{activePatient.token} • {activePatient.slot_time}
              </p>
              {activePatient.notes && (
                <p className="mt-2 rounded-lg bg-white/60 px-2 py-1.5 text-xs text-slate-600">
                  <span className="font-semibold">Patient: </span>
                  {activePatient.notes}
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
            {sessionEnded
              ? 'Session complete for today.'
              : 'No patient in cabin. Tap Next to call the first patient.'}
          </p>
        )}

        {actionError && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            {actionError}
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            type="button"
            disabled={nextDisabled}
            onClick={() => runAction(() => advanceQueue(selectedDoctor, selectedDate, 'next'))}
            className="rounded-xl bg-primary py-3 text-xs font-bold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            {actionLoading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'NEXT'}
          </button>
          <button
            type="button"
            disabled={skipDisabled}
            onClick={() => runAction(() => advanceQueue(selectedDoctor, selectedDate, 'skip'))}
            className="rounded-xl border-2 border-amber-400 bg-amber-50 py-3 text-xs font-bold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <SkipForward className="mx-auto h-4 w-4" />
            SKIP
          </button>
          <button
            type="button"
            disabled={noShowDisabled}
            onClick={() => runAction(() => markNoShow(selectedDoctor, selectedDate))}
            className="rounded-xl border-2 border-red-300 bg-red-50 py-3 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <UserX className="mx-auto h-4 w-4" />
            NO SHOW
          </button>
          <button
            type="button"
            disabled={endDisabled}
            onClick={() => runAction(() => endSession(selectedDoctor, selectedDate))}
            className="rounded-xl border-2 border-slate-400 bg-slate-100 py-3 text-xs font-bold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Square className="mx-auto h-4 w-4" />
            END
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 card-shadow">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Users className="h-4 w-4 text-primary" />
          Bookings {isHistoryView ? 'history' : ''} — {selectedDoc?.name}
        </h2>
        {appointments.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No bookings for this date.</p>
        ) : (
          <div className="space-y-2">
            {appointments.map((apt) => (
              <div
                key={apt.id}
                className={`rounded-xl border px-3 py-2.5 ${
                  apt._rawStatus === 'in-cabin' ||
                  (apt.token === currentToken && apt.status === 'waiting')
                    ? 'border-primary bg-primary-light/30'
                    : 'border-slate-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{apt.name}</p>
                    <p className="text-xs text-slate-400">
                      {apt.slot_time} • Token #{apt.token}
                      {apt.phone ? ` • ${formatPhoneDisplay(apt.phone)}` : ''}
                    </p>
                    {apt.notes && (
                      <p className="mt-1 text-[10px] text-slate-500">
                        <span className="font-semibold">Patient: </span>
                        {apt.notes}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor(apt.status)}`}
                  >
                    {statusLabel(apt.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
