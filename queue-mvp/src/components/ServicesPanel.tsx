import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ClipboardList, Loader2, Plus, Trash2 } from 'lucide-react';
import { addService, getDoctorServices, removeService } from '../lib/db';
import type { ClinicService } from '../lib/db';

interface Props {
  doctorId: string;
  clinicId: string;
  doctorName: string;
  /** Clinic admins may also add services every doctor of the clinic offers. */
  canAddClinicWide: boolean;
}

const DURATIONS = [10, 15, 20, 30, 45, 60, 90];
const inputCls =
  'rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-primary focus:outline-none';

/** The services a doctor offers (patients pick one when booking). The API enforces who may edit. */
export default function ServicesPanel({ doctorId, clinicId, doctorName, canAddClinicWide }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ClinicService[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState(15);
  const [clinicWide, setClinicWide] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await getDoctorServices(doctorId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load services.');
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const add = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('Give the service a name (at least 2 letters).');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await addService({
        clinicId,
        doctorId: clinicWide ? null : doctorId,
        name: trimmed,
        durationMinutes: minutes,
      });
      setName('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the service.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    setError('');
    try {
      await removeService(id);
      setItems((list) => list.filter((s) => s.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove the service.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white card-shadow">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <ClipboardList className="h-4 w-4 text-primary" />
          Services
          <span className="truncate text-xs font-normal text-slate-400">{doctorName}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-3 px-4 pb-4">
          {loading && (
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </p>
          )}
          {!loading && items.length === 0 && (
            <p className="text-xs text-slate-500">
              No services yet. Patients can still book; add services so they can say what the visit is for.
            </p>
          )}
          {items.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <div className="min-w-0 text-sm">
                <p className="truncate font-medium text-slate-800">{s.name}</p>
                <p className="text-xs text-slate-500">
                  {s.durationMinutes} min{s.doctorId === null ? ' · all doctors at this clinic' : ''}
                </p>
              </div>
              {/* A doctor cannot edit clinic-wide services; the API would refuse it, so do not offer it. */}
              {(canAddClinicWide || s.doctorId !== null) && (
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  disabled={busy}
                  aria-label={`Remove ${s.name}`}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}

          <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
            <input
              type="text"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Follow-up"
              aria-label="Service name"
              className={`${inputCls} min-w-0 flex-1`}
            />
            <select
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              aria-label="Duration"
              className={inputCls}
            >
              {DURATIONS.map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={add}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>
          {canAddClinicWide && (
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={clinicWide}
                onChange={(e) => setClinicWide(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Offer to every doctor at this clinic
            </label>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <p className="text-[11px] text-slate-400">
            The duration is shown to patients and staff. Appointment slots are still the length set under Availability.
          </p>
        </div>
      )}
    </div>
  );
}
