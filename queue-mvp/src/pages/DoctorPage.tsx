import { Navigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { logoutAndRevoke } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useStaffDoctors } from '../hooks/useStaffDoctors';
import DoctorAvatar from '../components/DoctorAvatar';
import LoadingScreen from '../components/LoadingScreen';
import QueueConsole from '../components/QueueConsole';
import StaffLoginCard from '../components/StaffLoginCard';

/**
 * Doctor portal (/doctor): a doctor's own queue only, no doctor picker and no "Reset queue".
 * Accounts are told apart by role: `doctor` lands here, `admin` / `superadmin` are sent to /admin.
 * The API independently refuses any queue action on another doctor's patients.
 */
export default function DoctorPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const role = isAuthenticated ? user?.role : undefined;
  const isDoctor = role === 'doctor';
  const { doctors, clinicNames, error, loading } = useStaffDoctors(isDoctor);

  if (isLoading) return <LoadingScreen />;
  if (role === 'admin' || role === 'superadmin') return <Navigate to="/admin" replace />;
  if (!isDoctor) {
    return (
      <StaffLoginCard
        title="Doctor sign in"
        subtitle="Sign in with your doctor account to run your own queue"
        emailPlaceholder="doctor@yourclinic.com"
      />
    );
  }
  if (loading) return <LoadingScreen />;

  const me = doctors[0];
  if (!me) {
    return (
      <div className="mx-auto max-w-sm space-y-4 pt-8 text-center">
        <div className="rounded-2xl bg-white p-6 card-shadow">
          <h1 className="text-lg font-bold text-slate-900">No doctor profile found</h1>
          <p className="mt-2 text-sm text-slate-500">
            {error
              ? `Could not load your profile: ${error}`
              : "Your account isn't linked to a doctor profile yet. Ask your clinic admin to link it."}
          </p>
          <button
            type="button"
            onClick={() => logoutAndRevoke()}
            className="mt-4 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-red-200 hover:text-red-600"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <QueueConsole
      title="My queue"
      doctors={doctors}
      clinicNames={clinicNames}
      doctorsError={error}
      lockedToDoctor
      allowReset={false}
      onLogout={() => logoutAndRevoke()}
      headerExtra={
        <div className="flex items-center gap-3 rounded-2xl bg-white p-3 card-shadow">
          <DoctorAvatar gender={me.gender} name={me.name} className="h-14 w-14 shrink-0 rounded-xl" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{me.name}</p>
            <p className="text-sm text-slate-500">{me.specialization}</p>
            {clinicNames[me.clinic_id] && (
              <p className="truncate text-xs text-slate-400">{clinicNames[me.clinic_id]}</p>
            )}
          </div>
        </div>
      }
    />
  );
}
