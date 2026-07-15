import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { getAppointmentsByPhone, getDoctor } from '../lib/db';
import { useAuth } from '../hooks/useAuth';
import { formatPhoneDisplay, normalizePhone } from '../lib/phone';
import { formatDisplayDate, statusColor, statusLabel } from '../lib/slotUtils';
import type { Appointment, Doctor } from '../lib/types';

export default function TrackPage() {
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Record<string, Doctor>>({});

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

  if (!isAuthenticated) {
    return null;
  }

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
          {appointments.map((apt) => (
            <Link
              key={apt.id}
              to={`/token/${apt.id}`}
              className="block rounded-2xl border border-slate-100 bg-white p-4 card-shadow transition hover:border-primary/30"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{apt.name}</p>
                  <p className="text-sm text-slate-500">
                    {doctors[apt.doctor_id]?.name ?? 'Doctor'} • Token #{apt.token}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatDisplayDate(apt.date)} • {apt.slot_time}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor(apt.status)}`}
                >
                  {statusLabel(apt.status)}
                </span>
              </div>
              <p className="mt-2 text-xs font-semibold text-primary">View live status →</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
