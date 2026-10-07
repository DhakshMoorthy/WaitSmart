import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatPhoneDisplay } from '../lib/phone';
import {
  Clock,
  Hash,
  Home,
  Phone,
  RefreshCw,
  User,
  FileText,
  XCircle,
  CalendarClock,
  Paperclip,
} from 'lucide-react';
import {
  cancelAppointment,
  fileUrl,
  getAppointment,
  getClinic,
  getDoctor,
  subscribeAppointments,
  subscribeQueue,
} from '../lib/db';
import { getAuth } from '../lib/auth';
import {
  estimateWaitMinutes,
  formatDisplayDate,
  getWaitLabel,
  isSlotInFuture,
} from '../lib/slotUtils';
import { useMinuteTick } from '../hooks/useMinuteTick';
import type { Appointment, Doctor, Queue } from '../lib/types';
import LiveBadge from '../components/LiveBadge';

export default function TokenPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [clinicHours, setClinicHours] = useState('');
  const [queue, setQueue] = useState<Queue | null>(null);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState('');
  useMinuteTick();

  useEffect(() => {
    if (!appointmentId) return;
    getAppointment(appointmentId).then(async (apt) => {
      setAppointment(apt);
      if (apt) {
        const doc = await getDoctor(apt.doctor_id);
        setDoctor(doc);
        getClinic(apt.clinic_id).then((c) => setClinicHours(c?.hours ?? '')).catch(() => {});
      }
    });
  }, [appointmentId, refreshKey]);

  useEffect(() => {
    if (!appointment) return;
    const unsubQueue = subscribeQueue(
      appointment.doctor_id,
      appointment.date,
      setQueue,
    );
    const unsubApts = subscribeAppointments(
      appointment.doctor_id,
      appointment.date,
      (apts) => {
        setAllAppointments(apts);
        const updated = apts.find((a) => a.id === appointment.id);
        if (updated) setAppointment(updated);
      },
    );
    return () => {
      unsubQueue();
      unsubApts();
    };
  }, [appointment?.doctor_id, appointment?.date, appointment?.id]);

  if (!appointment || !doctor) {
    return (
      <div className="py-12 text-center text-slate-500">
        <p>Loading appointment…</p>
      </div>
    );
  }

  const currentToken = queue?.current_token ?? 0;
  const waitMinutes = estimateWaitMinutes(
    appointment.token,
    currentToken,
    allAppointments,
    appointment.status,
    appointment.date,
    appointment.slot_time,
    appointment.slot_time_24h,
    doctor.slot_duration_minutes,
  );
  const isYourTurn =
    appointment._rawStatus === 'in-cabin' ||
    (currentToken > 0 &&
      appointment.token === currentToken &&
      appointment.status === 'waiting');
  const isDone = appointment.status === 'done';
  const isCancelled = appointment.status === 'cancelled';
  const canCancel =
    appointment.status === 'waiting' && appointment._rawStatus !== 'in-cabin';
  const sessionEnded = queue?.session_ended ?? false;

  let waitDisplay = getWaitLabel(waitMinutes);
  if (isDone) waitDisplay = 'Done';
  else if (isCancelled) waitDisplay = 'Cancelled';
  else if (isYourTurn) waitDisplay = 'Now — your turn';
  else if (sessionEnded && appointment.status === 'waiting') {
    waitDisplay = 'Session ended';
  }

  const slotStillFuture = isSlotInFuture(
    appointment.date,
    appointment.slot_time,
    appointment.slot_time_24h,
  );
  const waitSubLabel = slotStillFuture
    ? 'Time left until your slot'
    : 'Est. queue wait';

  const handleOpenAttachment = async () => {
    if (!appointment?.attachment_data) return;
    try {
      const { accessToken } = getAuth();
      const res = await fetch(fileUrl(appointment.attachment_data), {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      if (!res.ok) throw new Error('Could not open file');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not open file');
    }
  };

  const handleCancel = async () => {
    if (!canCancel || !appointmentId) return;
    if (!window.confirm('Cancel this appointment?')) return;
    setCancelling(true);
    setActionError('');
    try {
      await cancelAppointment(appointmentId);
      navigate('/track');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-4">
      {sessionEnded && !isDone && appointment.status === 'waiting' && (
        <div className="rounded-xl bg-slate-100 px-4 py-2 text-center text-sm text-slate-600">
          Doctor session has ended for today. Please check with reception.
        </div>
      )}

      {isYourTurn && (
        <div className="turn-alert rounded-2xl bg-green-500 px-4 py-3 text-center text-white shadow-lg">
          <p className="text-lg font-bold">It&apos;s your turn!</p>
          <p className="text-sm text-green-100">Please proceed to the doctor&apos;s cabin</p>
        </div>
      )}

      <div className="rounded-2xl bg-primary px-4 py-3 text-center text-white card-shadow">
        <p className="text-sm text-blue-100">
          Your appointment is at <strong>{appointment.slot_time}</strong>
        </p>
      </div>

      <div className="rounded-2xl bg-white p-5 text-center card-shadow">
        <div className="flex items-center justify-center gap-2">
          <p className="text-4xl font-bold text-slate-900">{appointment.slot_time}</p>
          <LiveBadge />
        </div>
        <p className="mt-2 text-sm text-slate-500">
          {formatDisplayDate(appointment.date)} • Slot #{appointment.slot_index} of{' '}
          {appointment.total_slots}
        </p>
        <div className="mt-3 inline-flex items-center gap-1.5 text-sm text-slate-600">
          <User className="h-4 w-4" />
          {appointment.name}
        </div>
        {appointment.phone && (
          <div className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-500">
            <Phone className="h-3.5 w-3.5" />
            {formatPhoneDisplay(appointment.phone)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 text-center card-shadow">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Now serving
          </p>
          <p className="mt-1 text-3xl font-bold text-primary">
            {currentToken > 0 ? `#${currentToken}` : '—'}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 text-center card-shadow">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {waitSubLabel}
          </p>
          <p className="mt-1 text-3xl font-bold text-amber-600">{waitDisplay}</p>
        </div>
      </div>

      <div className="flex justify-center">
        <div className="inline-flex flex-col items-center rounded-2xl border-2 border-primary bg-primary-light px-8 py-4">
          <Hash className="h-5 w-5 text-primary" />
          <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
            Your token
          </p>
          <p className="text-5xl font-black text-primary">{appointment.token}</p>
        </div>
      </div>

      <div className="flex gap-3 rounded-2xl bg-white p-3 card-shadow">
        <img
          src={doctor.photo_url}
          alt={doctor.name}
          className="h-14 w-14 rounded-xl object-cover"
        />
        <div>
          <p className="font-semibold text-slate-900">{doctor.name}</p>
          <p className="text-sm text-slate-500">{doctor.specialization}</p>
          {clinicHours && (
            <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
              <Clock className="h-3 w-3" />
              {clinicHours}
            </div>
          )}
        </div>
      </div>

      {appointment.notes && (
        <div className="rounded-2xl bg-white p-4 card-shadow">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <FileText className="h-3.5 w-3.5" />
            Description
          </div>
          <p className="text-sm text-slate-600">{appointment.notes}</p>
        </div>
      )}

      {appointment.attachment_data && (
        <button
          type="button"
          onClick={handleOpenAttachment}
          className="flex w-full items-center gap-2 rounded-2xl bg-white p-4 text-sm font-medium text-primary card-shadow hover:bg-primary-light/40"
        >
          <Paperclip className="h-4 w-4" />
          View attached file
        </button>
      )}

      {actionError && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{actionError}</p>
      )}

      {canCancel && (
        <div className="grid grid-cols-2 gap-3">
          <Link
            to={`/book/${appointment.doctor_id}?clinic=${appointment.clinic_id}&reschedule=${appointment.id}`}
            className="flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary-light py-3 text-sm font-medium text-primary"
          >
            <CalendarClock className="h-4 w-4" />
            Reschedule
          </Link>
          <button
            type="button"
            disabled={cancelling}
            onClick={handleCancel}
            className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-medium text-red-600 disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" />
            {cancelling ? 'Cancelling…' : 'Cancel'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 pt-2">
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-700 transition hover:border-primary hover:text-primary"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
        <Link
          to="/"
          className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          <Home className="h-4 w-4" />
          Home
        </Link>
      </div>
    </div>
  );
}
