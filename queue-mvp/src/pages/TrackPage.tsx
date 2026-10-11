import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { getAppointmentsByPhone, getDoctor } from '../lib/db';
import { useAuth } from '../hooks/useAuth';
import { formatPhoneDisplay, normalizePhone } from '../lib/phone';
import { formatDisplayDate, statusColor, statusLabel } from '../lib/slotUtils';
import { todayStr } from '../lib/dates';
import type { Appointment, Doctor } from '../lib/types';

export default function TrackPage() {
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Record<string, Doctor>>({});
  const [tab, setTab] = useState<'upcoming' | 'previous'>('upcoming');

  useEffect(() => {
    if (!isAuthenticated) return;

    async function load() {
      setLoading(true);
      try {
        const phone = user?.phone || '';
        const apts = await getAppointmentsByPhone(phone);
        setAppointments(apts);
        const docMap: Record<string, Doctor> = {};
        await Promise.all(
          [...new Set(apts.map((a) => a.doctor_id))].map(async (id) => {
            const doc = await getDoctor(id);
            if (doc) docMap[id] = doc;
          }),
        );
        setDoctors(docMap);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [isAuthenticated, user?.phone]);

  const { upcoming, previous } = useMemo(() => {
    const today = todayStr();
    const isUpcoming = (a: Appointment) =>
      (a.status === 'waiting' || a._rawStatus === 'in-cabin') && a.date >= today;
    const up = appointments.filter(isUpcoming).sort((a, b) => (a.date + a.slot_time_24h).localeCompare(b.date + b.slot_time_24h));
    const prev = appointments
      .filter((a) => !isUpcoming(a))
      .sort((a, b) => (b.date + b.slot_time_24h).localeCompare(a.date + a.slot_time_24h));
    return { upcoming: up, previous: prev };
  }, [appointments]);

  if (!isAuthenticated) {
    return null;
  }

  const shown = tab === 'upcoming' ? upcoming : previous;

  return (
    <div className="space-y-5">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to home
      </Link>

      <div className="rounded-2xl bg-gradient-to-br from-primary to-primary-dark p-5 text-white card-shadow">
        <h1 className="text-xl font-bold">My appointments</h1>
        <p className="mt-2 text-sm text-blue-100">
          All bookings for{' '}
          <strong>{formatPhoneDisplay(normalizePhone(user?.phone || ''))}</strong>
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : appointments.length === 0 ? (
        <p className="rounded-2xl bg-white py-10 text-center text-sm text-slate-400 card-shadow">
          No appointments found. Book a token from the home page.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Appointments">
            {([
              ['upcoming', `Upcoming (${upcoming.length})`],
              ['previous', `Previous (${previous.length})`],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`rounded-lg py-2 text-sm font-semibold transition ${
                  tab === key ? 'bg-white text-primary shadow-sm' : 'text-slate-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {shown.length === 0 && (
            <p className="rounded-2xl bg-white py-8 text-center text-sm text-slate-400 card-shadow">
              {tab === 'upcoming' ? 'No upcoming appointments.' : 'No previous appointments yet.'}
            </p>
          )}
          {shown.map((apt) => (
            <div key={apt.id} className="rounded-2xl border border-slate-100 bg-white card-shadow transition hover:border-primary/30">
            <Link
              to={`/token/${apt.id}`}
              className="block p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{apt.name}</p>
                  <p className="text-sm text-slate-500">
                    {doctors[apt.doctor_id]?.name ?? 'Doctor'} • Token #{apt.token}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatDisplayDate(apt.date)} • {apt.slot_time}
                    {apt.service_name ? ` • ${apt.service_name}` : ''}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor(apt.status)}`}
                >
                  {statusLabel(apt.status)}
                </span>
              </div>
              <p className="mt-2 text-xs font-semibold text-primary">
                {tab === 'upcoming' ? 'View live status →' : 'View details →'}
              </p>
            </Link>
            {tab === 'previous' && (
              <div className="border-t border-slate-100 px-4 py-2.5">
                <Link
                  to={`/book/${apt.doctor_id}?clinic=${apt.clinic_id}`}
                  className="text-xs font-semibold text-slate-700 hover:text-primary"
                >
                  Book again with {doctors[apt.doctor_id]?.name ?? 'this doctor'}
                </Link>
              </div>
            )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
