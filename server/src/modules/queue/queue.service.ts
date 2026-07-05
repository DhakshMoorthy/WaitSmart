import { eq, and, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { queueState, appointments, slots } from "../../db/schema/index.js";
import { AppError } from "../../types/index.js";
import { getIO } from "../../socket/index.js";
import { SOCKET_EVENTS } from "@waitsmart/shared";
import type { QueueActionInput } from "./queue.validator.js";

async function getOrCreateQueueState(tenantId: string, doctorId: string, date: string) {
  let state = await db.query.queueState.findFirst({
    where: and(eq(queueState.doctorId, doctorId), eq(queueState.date, date)),
  });

  if (!state) {
    // Count total appointments for this doctor+date to set lastSlot
    const appts = await db.query.appointments.findMany({
      where: and(
        eq(appointments.doctorId, doctorId),
        eq(appointments.tenantId, tenantId),
        sql`EXISTS (SELECT 1 FROM slots WHERE slots.id = appointments.slot_id AND slots.date = ${date})`,
      ),
    });

    const [inserted] = await db
      .insert(queueState)
      .values({ tenantId, doctorId, date, currentSlot: 0, lastSlot: appts.length })
      .onConflictDoNothing()
      .returning();

    state = inserted ?? await db.query.queueState.findFirst({
      where: and(eq(queueState.doctorId, doctorId), eq(queueState.date, date)),
    });
  }

  return state!;
}

function getWaitingAppointments(doctorId: string, date: string) {
  return db.query.appointments.findMany({
    where: and(
      eq(appointments.doctorId, doctorId),
      eq(appointments.status, "waiting"),
    ),
    orderBy: appointments.tokenNumber,
  });
}

async function emitQueueUpdate(doctorId: string, date: string, tenantId: string) {
  const state = await db.query.queueState.findFirst({
    where: and(eq(queueState.doctorId, doctorId), eq(queueState.date, date)),
  });

  const allAppts = await db.query.appointments.findMany({
    where: and(
      eq(appointments.doctorId, doctorId),
      eq(appointments.tenantId, tenantId),
    ),
    orderBy: appointments.tokenNumber,
  });

  // Filter to only today's appointments by checking slot date
  const todayAppts = [];
  for (const appt of allAppts) {
    const slot = await db.query.slots.findFirst({
      where: and(eq(slots.id, appt.slotId), eq(slots.date, date)),
    });
    if (slot) todayAppts.push(appt);
  }

  const waiting = todayAppts.filter((a) => a.status === "waiting");
  const current = todayAppts.find((a) => a.status === "in-cabin");

  const payload = {
    doctorId,
    date,
    nowServing: current?.tokenNumber ?? null,
    waitingCount: waiting.length,
    currentAppointment: current ?? null,
    appointments: todayAppts.map((a) => ({
      id: a.id,
      tokenNumber: a.tokenNumber,
      patientName: a.patientName,
      status: a.status,
    })),
  };

  try {
    getIO().to(`queue:${doctorId}`).emit(SOCKET_EVENTS.QUEUE_UPDATE, payload);
  } catch {
    // Socket may not be initialized in test environments
  }
  return payload;
}

export async function nextPatient(tenantId: string, input: QueueActionInput) {
  const { doctorId, date } = input;
  const state = await getOrCreateQueueState(tenantId, doctorId, date);

  // Mark current in-cabin as done
  await db
    .update(appointments)
    .set({ status: "done", updatedAt: new Date() })
    .where(
      and(
        eq(appointments.doctorId, doctorId),
        eq(appointments.tenantId, tenantId),
        eq(appointments.status, "in-cabin"),
      ),
    );

  // Find the next waiting patient (lowest token number)
  const allAppts = await db.query.appointments.findMany({
    where: and(
      eq(appointments.doctorId, doctorId),
      eq(appointments.tenantId, tenantId),
      eq(appointments.status, "waiting"),
    ),
    orderBy: appointments.tokenNumber,
  });

  // Filter to today's slots
  let nextAppt = null;
  for (const appt of allAppts) {
    const slot = await db.query.slots.findFirst({
      where: and(eq(slots.id, appt.slotId), eq(slots.date, date)),
    });
    if (slot) {
      nextAppt = appt;
      break;
    }
  }

  if (!nextAppt) {
    // Update state
    await db
      .update(queueState)
      .set({ currentSlot: state.lastSlot, updatedAt: new Date() })
      .where(eq(queueState.id, state.id));
    const payload = await emitQueueUpdate(doctorId, date, tenantId);
    return { message: "No more patients waiting", ...payload };
  }

  // Mark next as in-cabin
  await db
    .update(appointments)
    .set({ status: "in-cabin", updatedAt: new Date() })
    .where(eq(appointments.id, nextAppt.id));

  // Update queue state
  await db
    .update(queueState)
    .set({ currentSlot: nextAppt.tokenNumber, updatedAt: new Date() })
    .where(eq(queueState.id, state.id));

  const payload = await emitQueueUpdate(doctorId, date, tenantId);
  return payload;
}

export async function skipPatient(tenantId: string, input: QueueActionInput) {
  const { doctorId, date } = input;

  // Find current in-cabin
  const allAppts = await db.query.appointments.findMany({
    where: and(
      eq(appointments.doctorId, doctorId),
      eq(appointments.tenantId, tenantId),
      eq(appointments.status, "in-cabin"),
    ),
  });

  const currentAppt = allAppts[0];
  if (!currentAppt) {
    throw new AppError(400, "No patient currently in cabin to skip", "NO_CURRENT_PATIENT");
  }

  // Mark as skipped
  await db
    .update(appointments)
    .set({ status: "skipped", updatedAt: new Date() })
    .where(eq(appointments.id, currentAppt.id));

  // Advance to next
  return nextPatient(tenantId, input);
}

export async function noShowPatient(tenantId: string, input: QueueActionInput) {
  const { doctorId, date } = input;

  const allAppts = await db.query.appointments.findMany({
    where: and(
      eq(appointments.doctorId, doctorId),
      eq(appointments.tenantId, tenantId),
      eq(appointments.status, "in-cabin"),
    ),
  });

  const currentAppt = allAppts[0];
  if (!currentAppt) {
    throw new AppError(400, "No patient currently in cabin", "NO_CURRENT_PATIENT");
  }

  await db
    .update(appointments)
    .set({ status: "no-show", updatedAt: new Date() })
    .where(eq(appointments.id, currentAppt.id));

  return nextPatient(tenantId, input);
}

export async function donePatient(tenantId: string, input: QueueActionInput) {
  const { doctorId, date } = input;

  const allAppts = await db.query.appointments.findMany({
    where: and(
      eq(appointments.doctorId, doctorId),
      eq(appointments.tenantId, tenantId),
      eq(appointments.status, "in-cabin"),
    ),
  });

  const currentAppt = allAppts[0];
  if (!currentAppt) {
    throw new AppError(400, "No patient currently in cabin", "NO_CURRENT_PATIENT");
  }

  await db
    .update(appointments)
    .set({ status: "done", updatedAt: new Date() })
    .where(eq(appointments.id, currentAppt.id));

  const payload = await emitQueueUpdate(doctorId, date, tenantId);
  return payload;
}
