import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

const CLINIC_IMG =
  "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&q=80";
const DOC_MALE =
  "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=200&q=80";
const DOC_FEMALE =
  "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&q=80";

export function slotTimeToHHMM(slotTime) {
  if (!slotTime) return "00:00";
  return dayjs.utc(slotTime).format("HH:mm");
}

export function mapStatus(status) {
  if (!status) return "waiting";
  if (status === "no-show") return "no_show";
  return status;
}

export function mapClinic(clinic) {
  const name = clinic.name || "";
  const parts = name.split(/[—–-]/).map((s) => s.trim());
  const branch = parts.length > 1 ? parts[parts.length - 1] : name;

  return {
    id: clinic.id,
    name,
    branch,
    address: clinic.address || "",
    hours: clinic.hours || "9:00 AM – 2:00 PM • 4:00 PM – 6:00 PM",
    image_url: clinic.image_url || CLINIC_IMG,
  };
}

export function mapDoctor(doctor, slotDurationMinutes = 30) {
  const isFemale =
    doctor.specialization?.toLowerCase().includes("pediatr") ||
    doctor.name?.toLowerCase().includes("priya") ||
    doctor.name?.toLowerCase().includes("vandana");

  return {
    id: doctor.id,
    name: doctor.name,
    clinic_id: doctor.clinicId,
    specialization: doctor.specialization,
    experience_years: doctor.experienceYears ?? 0,
    slot_duration_minutes: slotDurationMinutes,
    photo_url: doctor.photo_url || (isFemale ? DOC_FEMALE : DOC_MALE),
  };
}

export function mapAppointment(appointment, slot, totalSlots = 0) {
  const rawStatus = appointment.status;
  return {
    id: appointment.id,
    name: appointment.patientName,
    doctor_id: appointment.doctorId,
    clinic_id: appointment.clinicId,
    date: slot?.date || appointment.date || "",
    slot_time: slot ? slotTimeToHHMM(slot.slotTime) : "",
    slot_index: slot ? (slot.slotIndex ?? 0) + 1 : 0,
    total_slots: totalSlots,
    token: appointment.tokenNumber,
    status: mapStatus(rawStatus),
    _rawStatus: rawStatus,
    notes: appointment.symptoms || "",
    created_at: appointment.createdAt || new Date().toISOString(),
    _slotId: slot?.id,
  };
}

export function buildQueueFromAppointments(doctorId, date, appointments) {
  const inCabin = appointments.find((a) => a._rawStatus === "in-cabin");
  const nowServing = inCabin?.token ?? 0;
  const maxToken = appointments.reduce((max, a) => Math.max(max, a.token || 0), 0);

  return {
    doctor_id: doctorId,
    date,
    current_token: nowServing,
    last_token: maxToken,
  };
}

export function getQueueStats(queue, appointments) {
  const current = queue?.current_token ?? 0;
  const active = appointments.filter((a) => a.status !== "cancelled");
  const inCabin = active.find((a) => a._rawStatus === "in-cabin");
  const waiting = active.filter(
    (a) => a._rawStatus === "waiting" && (current === 0 || a.token > current),
  );

  return {
    nowServing: current > 0 ? current : null,
    booked: active.length,
    waiting: waiting.length,
    inCabin,
    waitingList: waiting,
  };
}
