import { useEffect, useState } from 'react';
import { getClinics, getDoctors } from '../lib/db';
import { useAuth } from './useAuth';
import type { Doctor } from '../lib/types';

/**
 * The doctors a signed-in staff member can run a queue for, loaded once per sign-in.
 *  - clinic admin / superadmin: every doctor in the clinic group, grouped by clinic
 *  - doctor: only their own profile (the doctor record linked to their user account)
 * The API enforces the same rule on every queue action; this just keeps the UI honest.
 */
export function useStaffDoctors(enabled: boolean) {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [clinicNames, setClinicNames] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    const onlyMine = user?.role === 'doctor' && user.id ? { onlyUserId: user.id } : {};
    Promise.all([getDoctors(undefined, onlyMine), getClinics().catch(() => [])])
      .then(([docs, clinics]) => {
        if (cancelled) return;
        const names = Object.fromEntries(clinics.map((c: { id: string; name: string }) => [c.id, c.name]));
        // Group by clinic so same-sounding doctors at different clinics can be told apart.
        const sorted = [...docs].sort(
          (a, b) =>
            (names[a.clinic_id] ?? '').localeCompare(names[b.clinic_id] ?? '') || a.name.localeCompare(b.name),
        );
        setError('');
        setClinicNames(names);
        setDoctors(sorted);
      })
      .catch((err) => {
        // Never fail silently: an empty list with "0 booked" looks like missing bookings.
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load doctors.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, user?.id, user?.role]);

  return { doctors, clinicNames, error, loading };
}
