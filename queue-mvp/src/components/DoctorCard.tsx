import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { Doctor } from '../lib/types';

interface Props {
  doctor: Doctor;
  nowServing: number;
  waiting: number;
  clinicId: string;
}

export default function DoctorCard({ doctor, nowServing, waiting, clinicId }: Props) {
  return (
    <Link
      to={`/book/${doctor.id}?clinic=${clinicId}`}
      className="group flex gap-3 rounded-2xl bg-white p-3 card-shadow transition hover:shadow-lg"
    >
      <img
        src={doctor.photo_url}
        alt={doctor.name}
        className="h-20 w-20 shrink-0 rounded-xl object-cover"
      />
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-slate-900">{doctor.name}</h3>
        <p className="text-sm text-slate-500">{doctor.specialization}</p>
        <p className="mt-0.5 text-xs text-slate-400">
          {doctor.experience_years} yrs experience • {doctor.slot_duration_minutes}-min slots
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            {nowServing > 0 ? `Now serving #${nowServing}` : 'Not started'}
          </span>
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
            {waiting} waiting
          </span>
        </div>
      </div>
      <ChevronRight className="mt-2 h-5 w-5 shrink-0 text-slate-300 transition group-hover:text-primary" />
    </Link>
  );
}
