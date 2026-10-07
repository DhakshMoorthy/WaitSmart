import { eq, and, count, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import {
  slots,
  appointments,
  doctors,
  doctorSchedules,
  doctorBreaks,
  queueState,
} from "../../db/schema/index.js";
import { AppError } from "../../types/index.js";
import { getIO } from "../../socket/index.js";
import { publicQueueRoom, staffQueueRoom } from "../../socket/queueHandler.js";
import { SOCKET_EVENTS } from "@waitsmart/shared";
import type { CreateBookingInput, RescheduleBookingInput } from "./booking.validator.js";

export interface Actor {
  userId: string;
  role: string;
}

/**
 * Can this actor see / change the patients of `doctor`?
 *  - admin and superadmin: every doctor in the clinic group
 *  - doctor: only their OWN patients (a doctor must not read other doctors' patient lists)
 */
function staffManagesDoctor(actor: Actor | null, doctor: { userId: string | null }): boolean {
  if (!actor) return false;
  if (actor.role === "admin" || actor.role === "superadmin") return true;
  return actor.role === "doctor" && doctor.userId !== null && doctor.userId === actor.userId;
}

export async function getAvailability(
  tenantId: string,
  doctorId: string,
  date: string,
  actor: Actor | null = null,
) {
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
      if (!appointment) return { ...slot, appointment: null };

      // Staff and the booking's owner see everything; everyone else only sees
      // that the token exists (no names, phones, symptoms, notes or user ids).
      const canSeeDetails = staffManagesDoctor(actor, doctor) || appointment.patientUserId === actor?.userId;
      if (canSeeDetails) return { ...slot, appointment };
      return {
        ...slot,
        appointment: {
          id: appointment.id,
          slotId: appointment.slotId,
          doctorId: appointment.doctorId,
          tokenNumber: appointment.tokenNumber,
          status: appointment.status,
        },
      };
    }),
  );

  const state = await db.query.queueState.findFirst({
    where: and(eq(queueState.doctorId, doctorId), eq(queueState.date, date)),
  });

  return {
    doctorId,
    date,
    slots: slotsWithAppointments,
    queueState: state
      ? {
          currentSlot: state.currentSlot,
          lastSlot: state.lastSlot,
          lastAction: state.lastAction,
        }
      : null,
  };
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

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Claims the slot and creates the appointment inside the caller's transaction.
 *  - the slot is claimed with an atomic `UPDATE ... WHERE status = 'available'`, so two
 *    simultaneous requests can never both win (the loser gets 409 SLOT_TAKEN)
 *  - token numbers are allocated under a per-doctor/day advisory lock as MAX+1, so they
 *    are unique even when bookings are cancelled or made concurrently
 */
async function bookInTx(
  tx: Tx,
  tenantId: string,
  patientUserId: string | null,
  input: CreateBookingInput,
) {
  const slot = await tx.query.slots.findFirst({
    where: and(
      eq(slots.id, input.slotId),
      eq(slots.doctorId, input.doctorId),
      eq(slots.tenantId, tenantId),
    ),
  });
  if (!slot) {
    throw new AppError(404, "Slot not found", "NOT_FOUND");
  }

  const doctor = await tx.query.doctors.findFirst({
    where: and(eq(doctors.id, input.doctorId), eq(doctors.tenantId, tenantId)),
  });
  if (!doctor || doctor.clinicId !== input.clinicId) {
    throw new AppError(400, "Doctor does not belong to this clinic", "INVALID_CLINIC");
  }

  const claimed = await tx
    .update(slots)
    .set({ status: "booked" })
    .where(and(eq(slots.id, slot.id), eq(slots.status, "available")))
    .returning({ id: slots.id });
  if (claimed.length === 0) {
    throw new AppError(409, "Slot is no longer available", "SLOT_TAKEN");
  }

  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${input.doctorId}:${slot.date}`}))`);
  const [{ maxToken }] = await tx
    .select({ maxToken: sql<number>`coalesce(max(${appointments.tokenNumber}), 0)::int` })
    .from(appointments)
    .innerJoin(slots, eq(appointments.slotId, slots.id))
    .where(
      and(
        eq(appointments.doctorId, input.doctorId),
        eq(appointments.tenantId, tenantId),
        eq(slots.date, slot.date),
      ),
    );

  const [appointment] = await tx
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
      fileId: input.fileId,
      tokenNumber: maxToken + 1,
      status: "waiting",
    })
    .returning();
  return appointment;
}

/** Tell watchers a token was taken — only after the transaction has committed. */
function emitBookingCreated(
  appointment: { id: string; tokenNumber: number; patientName: string },
  doctorId: string,
) {
  try {
    const io = getIO();
    io.to(staffQueueRoom(doctorId)).emit(SOCKET_EVENTS.BOOKING_CREATED, {
      appointmentId: appointment.id,
      tokenNumber: appointment.tokenNumber,
      doctorId,
      patientName: appointment.patientName,
    });
    // Patients only learn that a token was taken, not who took it.
    io.to(publicQueueRoom(doctorId)).emit(SOCKET_EVENTS.BOOKING_CREATED, {
      tokenNumber: appointment.tokenNumber,
      doctorId,
    });
  } catch {
    // Socket may not be initialized in test environments
  }
}

export async function createBooking(
  tenantId: string,
  patientUserId: string | null,
  input: CreateBookingInput,
) {
  const appointment = await db.transaction((tx) => bookInTx(tx, tenantId, patientUserId, input));
  emitBookingCreated(appointment, input.doctorId);
  return appointment;
}

/** Patients may only touch their own bookings; admins any in their tenant; doctors only their own doctor's. */
async function assertOwnsAppointment(
  tx: Tx,
  tenantId: string,
  appointment: { patientUserId: string | null; doctorId: string },
  actor: Actor,
) {
  if (appointment.patientUserId === actor.userId) return;
  const doctor = await tx.query.doctors.findFirst({
    where: and(eq(doctors.id, appointment.doctorId), eq(doctors.tenantId, tenantId)),
  });
  if (!doctor || !staffManagesDoctor(actor, doctor)) {
    // 404, not 403: don't confirm that someone else's appointment id exists.
    throw new AppError(404, "Appointment not found", "NOT_FOUND");
  }
}

async function cancelInTx(tx: Tx, tenantId: string, appointmentId: string, actor: Actor) {
  const appointment = await tx.query.appointments.findFirst({
    where: and(eq(appointments.id, appointmentId), eq(appointments.tenantId, tenantId)),
  });
  if (!appointment) {
    throw new AppError(404, "Appointment not found", "NOT_FOUND");
  }
  await assertOwnsAppointment(tx, tenantId, appointment, actor);
  if (appointment.status === "cancelled" || appointment.status === "done") {
    throw new AppError(400, "Cannot cancel this appointment", "INVALID_STATUS");
  }

  await tx.update(slots).set({ status: "available" }).where(eq(slots.id, appointment.slotId));

  const [updated] = await tx
    .update(appointments)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(appointments.id, appointmentId))
    .returning();
  return updated;
}

export async function cancelBooking(tenantId: string, appointmentId: string, actor: Actor) {
  return db.transaction((tx) => cancelInTx(tx, tenantId, appointmentId, actor));
}

/** Cancel + rebook atomically: if the new slot is taken, the old booking is left untouched. */
export async function rescheduleBooking(
  tenantId: string,
  actor: Actor,
  input: RescheduleBookingInput,
) {
  const appointment = await db.transaction(async (tx) => {
    const old = await tx.query.appointments.findFirst({
      where: and(eq(appointments.id, input.appointmentId), eq(appointments.tenantId, tenantId)),
    });
    if (!old) {
      throw new AppError(404, "Appointment not found", "NOT_FOUND");
    }
    await assertOwnsAppointment(tx, tenantId, old, actor);
    if (old.status !== "waiting") {
      throw new AppError(400, "Can only reschedule waiting appointments", "INVALID_STATUS");
    }

    await cancelInTx(tx, tenantId, input.appointmentId, actor);

    // The booking stays with its original owner even if staff reschedules it.
    return bookInTx(tx, tenantId, old.patientUserId, {
      clinicId: old.clinicId,
      doctorId: old.doctorId,
      slotId: input.newSlotId,
      patientName: old.patientName,
      patientPhone: old.patientPhone ?? undefined,
      symptoms: old.symptoms ?? undefined,
      fileId: old.fileId ?? undefined,
    });
  });
  emitBookingCreated(appointment, appointment.doctorId);
  return appointment;
}
