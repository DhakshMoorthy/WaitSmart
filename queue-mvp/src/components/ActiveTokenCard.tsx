import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Hash } from 'lucide-react';
import {
  getAppointment,
  subscribeAppointments,
  subscribeQueue,
} from '../lib/db';
import type { Appointment, Queue, SavedToken } from '../lib/types';
import { estimateWaitMinutes, formatDisplayDate, getWaitLabel, isSlotInFuture } from '../lib/slotUtils';
import { useMinuteTick } from '../hooks/useMinuteTick';

interface Props {
  token: SavedToken;
}

export default function ActiveTokenCard({ token }: Props) {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  useMinuteTick();

  useEffect(() => {
    getAppointment(token.appointmentId).then(setAppointment);
    const unsubQ = subscribeQueue(token.doctorId, token.date, setQueue);
    const unsubA = subscribeAppointments(token.doctorId, token.date, (apts) => {
      setAppointments(apts);
      const updated = apts.find((a) => a.id === token.appointmentId);
      if (updated) setAppointment(updated);
    });
    return () => {
      unsubQ();
      unsubA();
    };
  }, [token.appointmentId, token.doctorId, token.date]);

  const currentToken = queue?.current_token ?? 0;
  const status = appointment?.status ?? 'waiting';
  const waitMinutes = estimateWaitMinutes(
    token.token,
    currentToken,
    appointments,
    status,
    token.date,
    token.slotTime,
    appointment?.slot_time_24h,
  );
  const isYourTurn =
    appointment?._rawStatus === 'in-cabin' ||
    (currentToken > 0 && token.token === currentToken && status === 'waiting');
  const isDone = status === 'done';
  const sessionEnded = queue?.session_ended ?? false;

  let waitLabel = getWaitLabel(waitMinutes);
  if (isDone) waitLabel = 'Done';
  else if (isYourTurn) waitLabel = 'Your turn!';
  else if (sessionEnded && status === 'waiting') waitLabel = 'Session ended';

  return (
    <Link
      to={`/token/${token.appointmentId}`}
      className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary-light/50 p-3 transition hover:bg-primary-light"
    >
      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary text-white">
        <Hash className="h-3.5 w-3.5" />
        <span className="text-sm font-bold">{token.token}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-900">{token.patientName}</p>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Clock className="h-3 w-3" />
          <span>
            {formatDisplayDate(token.date)} • {token.slotTime}
          </span>
        </div>
        <p
          className={`mt-0.5 text-xs font-semibold ${
            isYourTurn
              ? 'text-green-600'
              : isDone
                ? 'text-slate-400'
                : 'text-amber-600'
          }`}
        >
          {isSlotInFuture(token.date, token.slotTime, appointment?.slot_time_24h)
            ? 'Time left: '
            : 'Est. wait: '}
          {waitLabel}
        </p>
      </div>
      <span className="shrink-0 text-xs font-semibold text-primary">Track →</span>
    </Link>
  );
}
