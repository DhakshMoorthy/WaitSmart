import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock } from 'lucide-react';
import { getClinic, getDoctors, subscribeDoctorQueues } from '../lib/db';
import { formatDateISO } from '../lib/slotUtils';
import type { Clinic, Doctor } from '../lib/types';
import DoctorCard from '../components/DoctorCard';

export default function DoctorsPage() {
  const { clinicId } = useParams<{ clinicId: string }>();
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [stats, setStats] = useState<Record<string, { nowServing: number; waiting: number }>>({});

  useEffect(() => {
    if (!clinicId) return;
    getClinic(clinicId).then(setClinic);
    getDoctors(clinicId).then(setDoctors);
  }, [clinicId]);

  useEffect(() => {
    if (doctors.length === 0) return;
    const today = formatDateISO(new Date());
    const unsubs = doctors.map((doc) =>
      subscribeDoctorQueues(doc.id, today, (s) => {
        setStats((prev) => ({
          ...prev,
          [doc.id]: {
            nowServing: s.currentToken,
            waiting: s.waiting,
          },
        }));
      }),
    );
    return () => unsubs.forEach((u) => u());
  }, [doctors]);

  if (!clinic) {
    return (
      <div className="py-12 text-center text-slate-500">
        <p>Clinic not found.</p>
        <Link to="/" className="mt-2 inline-block text-primary">
          Go home
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        All clinics
      </Link>

      <div className="overflow-hidden rounded-2xl card-shadow">
        <div className="relative h-40">
          <img
            src={clinic.image_url}
            alt={clinic.name}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-4 left-4">
            <h1 className="text-xl font-bold text-white">{clinic.branch}</h1>
            <p className="text-sm text-white/80">{clinic.address}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2.5 text-xs text-slate-600">
          <Clock className="h-3.5 w-3.5 text-primary" />
          {clinic.hours}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Available doctors
        </h2>
        <div className="space-y-3">
          {doctors.map((doc) => (
            <DoctorCard
              key={doc.id}
              doctor={doc}
              clinicId={clinic.id}
              nowServing={stats[doc.id]?.nowServing ?? 0}
              waiting={stats[doc.id]?.waiting ?? 0}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
