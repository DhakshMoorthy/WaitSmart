import { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { getAnalyticsSummary } from '../lib/db';
import type { AnalyticsSummary } from '../lib/db';

interface Props {
  date: string;
  /** Clinic admins can narrow to one doctor; the API ignores it for a doctor login. */
  doctorId?: string;
  /** Changes whenever the queue changes, so the numbers follow Next / No-show / Done. */
  refreshKey: string;
}

function Tile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center">
      <p className={`text-xl font-bold ${tone}`}>{value}</p>
      <p className="mt-0.5 text-[11px] leading-tight text-slate-500">{label}</p>
    </div>
  );
}

/** Appointments / completed / no-shows / average consultation time for the viewed day, plus the last 7 days. */
export default function DaySummary({ date, doctorId, refreshKey }: Props) {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    getAnalyticsSummary(date, doctorId)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError('');
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the overview.');
      });
    return () => {
      cancelled = true;
    };
  }, [date, doctorId, refreshKey]);

  if (error) return <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>;
  if (!data) return null;

  const max = Math.max(1, ...data.trend.map((t) => t.total));

  return (
    <div className="rounded-2xl bg-white p-4 card-shadow">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
        <BarChart3 className="h-4 w-4 text-primary" />
        Day overview
      </h2>
      <div className="grid grid-cols-4 gap-2">
        <Tile label="Appointments" value={String(data.total)} tone="text-slate-900" />
        <Tile label="Completed" value={String(data.completed)} tone="text-emerald-600" />
        <Tile label="No-show" value={String(data.noShow)} tone="text-red-600" />
        <Tile
          label="Avg consult"
          value={data.avgConsultMinutes == null ? '—' : data.avgConsultMinutes < 1 ? '<1 min' : `${data.avgConsultMinutes} min`}
          tone="text-primary"
        />
      </div>
      <p className="mt-1 text-center text-[11px] text-slate-400">
        {data.waiting} still waiting
        {data.cancelled > 0 ? ` · ${data.cancelled} cancelled` : ''}
      </p>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <p className="mb-2 text-[11px] font-semibold uppercase text-slate-400">Last 7 days</p>
        <div className="flex items-end gap-1.5" role="img" aria-label="Appointments per day, last 7 days">
          {data.trend.map((t) => (
            <div key={t.date} className="flex flex-1 flex-col items-center gap-1" title={`${t.date}: ${t.total} appointments, ${t.completed} completed`}>
              <div className="flex h-12 w-full items-end">
                <div
                  className={`w-full rounded-t ${t.date === date ? 'bg-primary' : 'bg-slate-300'}`}
                  style={{ height: `${Math.max(t.total > 0 ? 4 : 2, Math.round((t.total / max) * 48))}px` }}
                />
              </div>
              <span className="text-[10px] text-slate-400">{t.date.slice(8)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
