export type AppointmentStatus =
  | 'waiting'
  | 'done'
  | 'skipped'
  | 'no_show'
  | 'cancelled'
  | 'in-cabin';

export interface Clinic {
  id: string;
  name: string;
  branch: string;
  address: string;
  hours: string;
  image_url: string;
}

export interface Doctor {
  id: string;
  name: string;
  clinic_id: string;
  specialization: string;
  experience_years: number;
  slot_duration_minutes: number;
  photo_url: string;
}

export interface QueueLastAction {
  appointment_id: string;
  previous_status: AppointmentStatus;
  previous_current_token: number;
  previous_session_ended: boolean;
}

export interface Queue {
  doctor_id: string;
  date: string;
  current_token: number;
  last_token: number;
  session_ended?: boolean;
  last_action?: QueueLastAction | null;
}

export interface Appointment {
  id: string;
  name: string;
  phone: string;
  doctor_id: string;
  clinic_id: string;
  date: string;
  slot_time: string;
  slot_time_24h: string;
  slot_index: number;
  total_slots: number;
  token: number;
  status: AppointmentStatus;
  notes?: string;
  doctor_notes?: string;
  attachment_name?: string;
  attachment_data?: string;
  created_at: string;
  _rawStatus?: string;
  _slotId?: string;
}

export interface SavedToken {
  appointmentId: string;
  doctorId: string;
  clinicId: string;
  date: string;
  patientName: string;
  phone: string;
  slotTime: string;
  token: number;
}

export interface QueueStats {
  currentToken: number;
  lastToken: number;
  waiting: number;
  booked: number;
  sessionEnded?: boolean;
}

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  role: string;
  tenantId: string | null;
  doctorId: string | null;
}
