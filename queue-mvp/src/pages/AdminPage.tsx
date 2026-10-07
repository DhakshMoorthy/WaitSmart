import { Navigate } from 'react-router-dom';
import { logoutAndRevoke } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useStaffDoctors } from '../hooks/useStaffDoctors';
import LoadingScreen from '../components/LoadingScreen';
import QueueConsole from '../components/QueueConsole';
import StaffLoginCard from '../components/StaffLoginCard';

/** Clinic staff (admin / superadmin): every doctor's queue. Doctors are sent to /doctor, which shows only their own. */
export default function AdminPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const role = isAuthenticated ? user?.role : undefined;
  const isClinicStaff = role === 'admin' || role === 'superadmin';
  const { doctors, clinicNames, error } = useStaffDoctors(isClinicStaff);

  if (isLoading) return <LoadingScreen />;
  if (role === 'doctor') return <Navigate to="/doctor" replace />;
  if (!isClinicStaff) {
    return (
      <StaffLoginCard
        title="Admin access"
        subtitle="Sign in with your clinic account to manage queues"
        emailPlaceholder="admin@yourclinic.com"
      />
    );
  }

  return (
    <QueueConsole
      title="Slot control"
      doctors={doctors}
      clinicNames={clinicNames}
      doctorsError={error}
      allowReset
      onLogout={() => logoutAndRevoke()}
    />
  );
}
