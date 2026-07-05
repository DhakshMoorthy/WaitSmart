import { eq, and, count, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import {
  slots,
  appointments,
  doctors,
  doctorSchedules,
  doctorBreaks,
} from "../../db/schema/index.js";
import { AppError } from "../../types/index.js";
import { getIO } from "../../socket/index.js";
import { SOCKET_EVENTS } from "@waitsmart/shared";
import type { CreateBookingInput, RescheduleBookingInput } from "./booking.validator.js";

export async function getAvailability(tenantId: string, doctorId: string, date: string) {
  // Verify doctor exists in tenant
  const doctor = await db.query.doctors.findFirst({
    where: and(eq(doctors.id, doctorId), eq(doctors.tenantId, tenantId)),
  });
  if (!doctor) {
    throw new AppError(404, "Doctor not found", "NOT_FOUND");
  }

  // Check if doctor is on break
  const breakRecord = await db.query.doctorBreaks.findFirst({
    where: and(
      eq(doctorBreaks.doctorId, doctorId),
      sql`${doctorBreaks.startDate} <= ${date}`,
      sql`${doctorBreaks.endDate} >= ${date}`,
    ),
  });
  if (breakRecord) {
    return { doctorId, date, slots: [], message: "Doctor is on break" };
  }

  // Calendar day-of-week (avoid UTC shift from `new Date("YYYY-MM-DD")`)
  const [year, month, day] = date.split("-").map(Number);
  const dayOfWeek = new Date(year, month - 1, day).getDay();

  // Get schedule for this day
  const schedule = await db.query.doctorSchedules.findFirst({
    where: and(
      eq(doctorSchedules.doctorId, doctorId),
      eq(doctorSchedules.dayOfWeek, dayOfWeek),
    ),
  });
  if (!schedule) {
    return { doctorId, date, slots: [], message: "No schedule for this day" };
  }

  // Generate or fetch slots for this date
  let existingSlots = await db.query.slots.findMany({
    where: and(eq(slots.doctorId, doctorId), eq(slots.date, date)),
    orderBy: slots.slotIndex,
  });

  // If no slots exist yet, generate them from the schedule
  if (existingSlots.length === 0) {
    existingSlots = await generateSlots(tenantId, doctorId, date, schedule);
  }

  // Attach appointment details for booked slots (doctor queue + patient views)
  const slotsWithAppointments = await Promise.all(
    existingSlots.map(async (slot) => {
      if (slot.status !== "booked") {
        return { ...slot, appointment: null };
      }
      const appointment = await db.query.appointments.findFirst({
        where: eq(appointments.slotId, slot.id),
      });
      return { ...slot, appointment: appointment ?? null };
    }),
  );

  return { doctorId, date, slots: slotsWithAppointments };
}

async function generateSlots(
  tenantId: string,
  doctorId: string,
  date: string,
  schedule: { startTime: string; endTime: string; slotDurationMinutes: number },
) {
  const [year, month, day] = date.split("-").map(Number);
  const [startH, startM] = schedule.startTime.split(":").map(Number);
  const [endH, endM] = schedule.endTime.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const duration = schedule.slotDurationMinutes;

  const slotValues = [];
  let idx = 0;
  for (let m = startMinutes; m + duration <= endMinutes; m += duration) {
    const hours = Math.floor(m / 60);
    const mins = m % 60;
    // Store wall-clock time as UTC so clients can display with dayjs.utc()
    const slotTime = new Date(Date.UTC(year, month - 1, day, hours, mins, 0));
    slotValues.push({
      tenantId,
      doctorId,
      date,
      slotIndex: idx,
      slotTime,
      status: "available" as const,
    });
    idx++;
  }

  if (slotValues.length === 0) return [];

  return db.insert(slots).values(slotValues).returning();
}

export async function createBooking(
  tenantId: string,
  patientUserId: string | null,
  input: CreateBookingInput,
) {
  // Verify slot belongs to tenant + doctor and is available
  const slot = await db.query.slots.findFirst({
    where: and(
      eq(slots.id, input.slotId),
      eq(slots.doctorId, input.doctorId),
      eq(slots.tenantId, tenantId),
    ),
  });
  if (!slot) {
    throw new AppError(404, "Slot not found", "NOT_FOUND");
  }
  if (slot.status !== "available") {
    throw new AppError(409, "Slot is no longer available", "SLOT_TAKEN");
  }

  // Token number = count of appointments for this doctor on this slot date + 1
  const [countResult] = await db
    .select({ total: count() })
    .from(appointments)
    .innerJoin(slots, eq(appointments.slotId, slots.id))
    .where(
      and(
        eq(appointments.doctorId, input.doctorId),
        eq(appointments.tenantId, tenantId),
        eq(slots.date, slot.date),
      ),
    );
  const tokenNumber = (countResult?.total ?? 0) + 1;

  // Mark slot as booked
  await db.update(slots).set({ status: "booked" }).where(eq(slots.id, input.slotId));

  // Create appointment
  const [appointment] = await db
    .insert(appointments)
    .values({
      tenantId,
      clinicId: input.clinicId,
      doctorId: input.doctorId,
      slotId: input.slotId,
      patientUserId,
      patientName: input.patientName,
      patientPhone: input.patientPhone,
      symptoms: input.symptoms,
      tokenNumber,
      status: "waiting",
    })
    .returning();

  // Emit booking:created via Socket.io
  try {
    getIO().to(`queue:${input.doctorId}`).emit(SOCKET_EVENTS.BOOKING_CREATED, {
      appointmentId: appointment.id,
      tokenNumber: appointment.tokenNumber,
      doctorId: input.doctorId,
      patientName: input.patientName,
    });
  } catch {
    // Socket may not be initialized in test environments
  }

  return appointment;
}

export async function cancelBooking(tenantId: string, appointmentId: string) {
  const appointment = await db.query.appointments.findFirst({
    where: and(eq(appointments.id, appointmentId), eq(appointments.tenantId, tenantId)),
  });
  if (!appointment) {
    throw new AppError(404, "Appointment not found", "NOT_FOUND");
  }
  if (appointment.status === "cancelled" || appointment.status === "done") {
    throw new AppError(400, "Cannot cancel this appointment", "INVALID_STATUS");
  }

  // Release the slot
  await db.update(slots).set({ status: "available" }).where(eq(slots.id, appointment.slotId));

  // Update appointment status
  const [updated] = await db
    .update(appointments)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(appointments.id, appointmentId))
    .returning();

  return updated;
}

export async function rescheduleBooking(
  tenantId: string,
  patientUserId: string | null,
  input: RescheduleBookingInput,
) {
  const appointment = await db.query.appointments.findFirst({
    where: and(eq(appointments.id, input.appointmentId), eq(appointments.tenantId, tenantId)),
  });
  if (!appointment) {
    throw new AppError(404, "Appointment not found", "NOT_FOUND");
  }
  if (appointment.status !== "waiting") {
    throw new AppError(400, "Can only reschedule waiting appointments", "INVALID_STATUS");
  }

  // Cancel old
  await cancelBooking(tenantId, input.appointmentId);

  // Book new slot
  const newAppointment = await createBooking(tenantId, patientUserId, {
    clinicId: appointment.clinicId,
    doctorId: appointment.doctorId,
    slotId: input.newSlotId,
    patientName: appointment.patientName,
    patientPhone: appointment.patientPhone ?? undefined,
    symptoms: appointment.symptoms ?? undefined,
  });

  return newAppointment;
}
