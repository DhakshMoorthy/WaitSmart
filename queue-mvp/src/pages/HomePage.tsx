import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, Sparkles } from 'lucide-react';
import { getClinics, getSavedTokens } from '../lib/db';
import { HIGHLIGHT_PILLS, TAGLINE, APP_NAME } from '../lib/constants';
import type { Clinic, SavedToken } from '../lib/types';
import ClinicCard from '../components/ClinicCard';
import ActiveTokenCard from '../components/ActiveTokenCard';

export default function HomePage() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [savedTokens, setSavedTokens] = useState<SavedToken[]>([]);

  useEffect(() => {
    getClinics().then(setClinics);
    setSavedTokens(getSavedTokens());
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-br from-primary to-primary-dark p-5 text-white card-shadow">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 opacity-90" />
          <div>
            <h1 className="text-xl font-bold leading-snug sm:text-2xl">{TAGLINE}</h1>
            <p className="mt-2 text-sm text-blue-100">
              Real-time queue updates from {APP_NAME}. Book, track, and never miss your turn.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {HIGHLIGHT_PILLS.map((pill) => (
            <span
              key={pill}
              className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm"
            >
              {pill}
            </span>
          ))}
        </div>
      </section>

      <Link
        to="/track"
        className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-white p-4 card-shadow transition hover:border-primary hover:bg-primary-light/30"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
          <Phone className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">My appointments</p>
          <p className="text-xs text-slate-500">
            View all your bookings and live token status
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-primary">View →</span>
      </Link>

      {savedTokens.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Your active tokens
          </h2>
          <div className="space-y-2">
            {savedTokens.map((t) => (
              <ActiveTokenCard key={t.appointmentId} token={t} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Choose a clinic
        </h2>
        <div className="space-y-3">
          {clinics.map((clinic) => (
            <ClinicCard key={clinic.id} clinic={clinic} />
          ))}
        </div>
      </section>
    </div>
  );
}
