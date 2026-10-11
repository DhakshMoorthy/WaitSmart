import { Navigate } from 'react-router-dom';
import { logoutAndRevoke } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useStaffDoctors } from '../hooks/useStaffDoctors';
import LoadingScreen from '../components/LoadingScreen';
import AvailabilityPanel from '../components/AvailabilityPanel';
import ClinicQrPanel from '../components/ClinicQrPanel';
import ServicesPanel from '../components/ServicesPanel';
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
      headerExtra={<ClinicQrPanel clinicNames={clinicNames} />}
      doctorExtra={(d) => (
        <div key={d.id} className="space-y-5">
          <AvailabilityPanel doctorId={d.id} doctorName={d.name} bookingWindowDays={d.booking_window_days} />
          <ServicesPanel
            doctorId={d.id}
            clinicId={d.clinic_id}
            doctorName={d.name}
            canAddClinicWide={true}
          />
        </div>
      )}
      onLogout={() => logoutAndRevoke()}
    />
  );
}
