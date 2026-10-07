import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Star } from 'lucide-react';
import { getFavoriteDoctors, removeFavoriteDoctor, subscribeDoctorQueues } from '../lib/db';
import { formatDateISO } from '../lib/slotUtils';
import type { Doctor } from '../lib/types';
import DoctorCard from '../components/DoctorCard';

type LoadState = 'loading' | 'ready' | 'error';

export default function FavoritesPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [stats, setStats] = useState<Record<string, { nowServing: number; waiting: number }>>({});

  const load = () => {
    setLoadState('loading');
    getFavoriteDoctors()
      .then((favs) => {
        setDoctors(favs);
        setLoadState('ready');
      })
      .catch(() => setLoadState('error'));
  };

  useEffect(load, []);

  useEffect(() => {
    if (doctors.length === 0) return;
    const today = formatDateISO(new Date());
    const unsubs = doctors.map((doc) =>
      subscribeDoctorQueues(doc.id, today, (s) => {
        setStats((prev) => ({ ...prev, [doc.id]: { nowServing: s.currentToken, waiting: s.waiting } }));
      }),
    );
    return () => unsubs.forEach((u) => u());
  }, [doctors]);

  const remove = async (doctorId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await removeFavoriteDoctor(doctorId);
      setDoctors((prev) => prev.filter((d) => d.id !== doctorId));
    } catch {
      /* keep the doctor listed if the server call failed */
    }
  };

  return (
    <div className="space-y-4">
      <Link to="/" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-primary">
        <ArrowLeft className="h-4 w-4" />
        Clinics
      </Link>
      <h1 className="text-lg font-bold text-slate-900">Favorite doctors</h1>

      {loadState === 'loading' && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {loadState === 'error' && (
        <div className="space-y-3 py-8 text-center">
          <p className="text-sm text-slate-500">Couldn&apos;t load your favorites.</p>
          <button
            type="button"
            onClick={load}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Try again
          </button>
        </div>
      )}

      {loadState === 'ready' && doctors.length === 0 && (
        <div className="space-y-3 rounded-2xl bg-white py-10 text-center card-shadow">
          <Star className="mx-auto h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">No favorites yet. Tap the star on a doctor to save them here.</p>
          <Link to="/" className="inline-block rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white">
            Browse clinics
          </Link>
        </div>
      )}

      {loadState === 'ready' && doctors.length > 0 && (
        <div className="space-y-3">
          {doctors.map((doc) => (
            <div key={doc.id} className="relative">
              <DoctorCard
                doctor={doc}
                clinicId={doc.clinic_id}
                nowServing={stats[doc.id]?.nowServing ?? 0}
                waiting={stats[doc.id]?.waiting ?? 0}
              />
              <button
                type="button"
                aria-label="Remove favorite"
                onClick={(e) => remove(doc.id, e)}
                className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-1.5 shadow-sm"
              >
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
