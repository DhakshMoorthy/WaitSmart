import { eq, and, sql, inArray } from "drizzle-orm";
import { db } from "../../config/db.js";
import { queueState, appointments, slots, type QueueLastAction } from "../../db/schema/index.js";
import { AppError } from "../../types/index.js";
import { getIO } from "../../socket/index.js";
import { SOCKET_EVENTS } from "@waitsmart/shared";
import type {
  QueueActionInput,
  UpdateAppointmentStatusInput,
  UpdateDoctorNotesInput,
} from "./queue.validator.js";

async function getOrCreateQueueState(tenantId: string, doctorId: string, date: string) {
  let state = await db.query.queueState.findFirst({
    where: and(eq(queueState.doctorId, doctorId), eq(queueState.date, date)),
  });

  if (!state) {
    const appts = await db.query.appointments.findMany({
      where: and(
        eq(appointments.doctorId, doctorId),
        eq(appointments.tenantId, tenantId),
        sql`EXISTS (SELECT 1 FROM slots WHERE slots.id = appointments.slot_id AND slots.date = ${date})`,
      ),
    });

    const [inserted] = await db
      .insert(queueState)
      .values({ tenantId, doctorId, date, currentSlot: 0, lastSlot: appts.length, lastAction: null })
      .onConflictDoNothing()
      .returning();

    state =
      inserted ??
      (await db.query.queueState.findFirst({
        where: and(eq(queueState.doctorId, doctorId), eq(queueState.date, date)),
      }));
  }

  return state!;
}

async function appointmentsForDate(tenantId: string, doctorId: string, date: string) {
  const allAppts = await db.query.appointments.findMany({
    where: and(eq(appointments.doctorId, doctorId), eq(appointments.tenantId, tenantId)),
    orderBy: appointments.tokenNumber,
  });

  const todayAppts = [];
  for (const appt of allAppts) {
    const slot = await db.query.slots.findFirst({
      where: and(eq(slots.id, appt.slotId), eq(slots.date, date)),
    });
    if (slot) todayAppts.push(appt);
  }
  return todayAppts;
}

async function findInCabin(tenantId: string, doctorId: string, date: string) {
  const todayAppts = await appointmentsForDate(tenantId, doctorId, date);
  return todayAppts.find((a) => a.status === "in-cabin") ?? null;
}

async function findNextWaiting(tenantId: string, doctorId: string, date: string) {
  const todayAppts = await appointmentsForDate(tenantId, doctorId, date);
  return todayAppts.find((a) => a.status === "waiting") ?? null;
}

async function setLastAction(
  stateId: string,
  lastAction: QueueLastAction | null,
  currentSlot?: number,
) {
  await db
    .update(queueState)
    .set({
      ...(currentSlot !== undefined ? { currentSlot } : {}),
      lastAction,
      updatedAt: new Date(),
    })
    .where(eq(queueState.id, stateId));
}

async function emitQueueUpdate(doctorId: string, date: string, tenantId: string) {
  const state = await db.query.queueState.findFirst({
    where: and(eq(queueState.doctorId, doctorId), eq(queueState.date, date)),
  });

  const todayAppts = await appointmentsForDate(tenantId, doctorId, date);
  const waiting = todayAppts.filter((a) => a.status === "waiting");
  const current = todayAppts.find((a) => a.status === "in-cabin");

  const payload = {
    doctorId,
    date,
    nowServing: current?.tokenNumber ?? null,
    waitingCount: waiting.length,
    currentAppointment: current ?? null,
    lastAction: state?.lastAction ?? null,
    currentSlot: state?.currentSlot ?? 0,
    appointments: todayAppts.map((a) => ({
      id: a.id,
      tokenNumber: a.tokenNumber,
      patientName: a.patientName,
      status: a.status,
      doctorNotes: a.doctorNotes,
      fileId: a.fileId,
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

  const previousInCabin = await findInCabin(tenantId, doctorId, date);
  const nextAppt = await findNextWaiting(tenantId, doctorId, date);

  if (!nextAppt && !previousInCabin) {
    await setLastAction(
      state.id,
      {
        appointmentId: null,
        previousStatus: "waiting",
        previousCurrentSlot: state.currentSlot,
        previousSessionEnded: false,
      },
      state.lastSlot,
    );
    return { message: "No more patients waiting", ...(await emitQueueUpdate(doctorId, date, tenantId)) };
  }

  if (previousInCabin) {
    await db
      .update(appointments)
      .set({ status: "done", updatedAt: new Date() })
      .where(eq(appointments.id, previousInCabin.id));
  }

  if (!nextAppt) {
    await setLastAction(
      state.id,
      {
        appointmentId: previousInCabin?.id ?? null,
        previousStatus: previousInCabin?.status ?? "waiting",
        previousCurrentSlot: state.currentSlot,
        previousSessionEnded: false,
      },
      state.lastSlot,
    );
    return { message: "No more patients waiting", ...(await emitQueueUpdate(doctorId, date, tenantId)) };
  }

  await db
    .update(appointments)
    .set({ status: "in-cabin", updatedAt: new Date() })
    .where(eq(appointments.id, nextAppt.id));

  await setLastAction(
    state.id,
    {
      appointmentId: nextAppt.id,
      previousStatus: nextAppt.status,
      previousCurrentSlot: state.currentSlot,
      previousSessionEnded: false,
      secondaryAppointmentId: previousInCabin?.id ?? null,
      secondaryPreviousStatus: previousInCabin?.status ?? null,
    },
    nextAppt.tokenNumber,
  );

  return emitQueueUpdate(doctorId, date, tenantId);
}

export async function skipPatient(tenantId: string, input: QueueActionInput) {
  const { doctorId, date } = input;
  const state = await getOrCreateQueueState(tenantId, doctorId, date);
  const currentAppt = await findInCabin(tenantId, doctorId, date);

  if (!currentAppt) {
    throw new AppError(400, "No patient currently in cabin to skip", "NO_CURRENT_PATIENT");
  }

  await db
    .update(appointments)
    .set({ status: "skipped", updatedAt: new Date() })
    .where(eq(appointments.id, currentAppt.id));

  const nextAppt = await findNextWaiting(tenantId, doctorId, date);
  if (nextAppt) {
    await db
      .update(appointments)
      .set({ status: "in-cabin", updatedAt: new Date() })
      .where(eq(appointments.id, nextAppt.id));

    await setLastAction(
      state.id,
      {
        appointmentId: currentAppt.id,
        previousStatus: currentAppt.status,
        previousCurrentSlot: state.currentSlot,
        previousSessionEnded: false,
        secondaryAppointmentId: nextAppt.id,
        secondaryPreviousStatus: nextAppt.status,
      },
      nextAppt.tokenNumber,
    );
  } else {
    await setLastAction(
      state.id,
      {
        appointmentId: currentAppt.id,
        previousStatus: currentAppt.status,
        previousCurrentSlot: state.currentSlot,
        previousSessionEnded: false,
      },
      state.lastSlot,
    );
  }

  return emitQueueUpdate(doctorId, date, tenantId);
}

export async function noShowPatient(tenantId: string, input: QueueActionInput) {
  const { doctorId, date } = input;
  const state = await getOrCreateQueueState(tenantId, doctorId, date);
  const currentAppt = await findInCabin(tenantId, doctorId, date);

  if (!currentAppt) {
    throw new AppError(400, "No patient currently in cabin", "NO_CURRENT_PATIENT");
  }

  await db
    .update(appointments)
    .set({ status: "no-show", updatedAt: new Date() })
    .where(eq(appointments.id, currentAppt.id));

  const nextAppt = await findNextWaiting(tenantId, doctorId, date);
  if (nextAppt) {
    await db
      .update(appointments)
      .set({ status: "in-cabin", updatedAt: new Date() })
      .where(eq(appointments.id, nextAppt.id));

    await setLastAction(
      state.id,
      {
        appointmentId: currentAppt.id,
        previousStatus: currentAppt.status,
        previousCurrentSlot: state.currentSlot,
        previousSessionEnded: false,
        secondaryAppointmentId: nextAppt.id,
        secondaryPreviousStatus: nextAppt.status,
      },
      nextAppt.tokenNumber,
    );
  } else {
    await setLastAction(
      state.id,
      {
        appointmentId: currentAppt.id,
        previousStatus: currentAppt.status,
        previousCurrentSlot: state.currentSlot,
        previousSessionEnded: false,
      },
      state.lastSlot,
    );
  }

  return emitQueueUpdate(doctorId, date, tenantId);
}

export async function donePatient(tenantId: string, input: QueueActionInput) {
  const { doctorId, date } = input;
  const state = await getOrCreateQueueState(tenantId, doctorId, date);
  const currentAppt = await findInCabin(tenantId, doctorId, date);

  if (!currentAppt) {
    throw new AppError(400, "No patient currently in cabin", "NO_CURRENT_PATIENT");
  }

  await db
    .update(appointments)
    .set({ status: "done", updatedAt: new Date() })
    .where(eq(appointments.id, currentAppt.id));

  await setLastAction(
    state.id,
    {
      appointmentId: currentAppt.id,
      previousStatus: currentAppt.status,
      previousCurrentSlot: state.currentSlot,
      previousSessionEnded: false,
    },
    state.currentSlot,
  );

  return emitQueueUpdate(doctorId, date, tenantId);
}

export async function undoLastAction(tenantId: string, input: QueueActionInput) {
  const { doctorId, date } = input;
  const state = await getOrCreateQueueState(tenantId, doctorId, date);
  const lastAction = state.lastAction as QueueLastAction | null;

  if (!lastAction) {
    throw new AppError(400, "Nothing to undo", "NOTHING_TO_UNDO");
  }

  if (lastAction.appointmentId) {
    await db
      .update(appointments)
      .set({
        status: lastAction.previousStatus as
          | "waiting"
          | "in-cabin"
          | "done"
          | "skipped"
          | "no-show"
          | "cancelled",
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, lastAction.appointmentId));
  }

  // Reverse secondary change: if next/skip moved someone into cabin, put them back to waiting
  if (lastAction.secondaryAppointmentId && lastAction.secondaryPreviousStatus) {
    await db
      .update(appointments)
      .set({
        status: lastAction.secondaryPreviousStatus as
          | "waiting"
          | "in-cabin"
          | "done"
          | "skipped"
          | "no-show"
          | "cancelled",
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, lastAction.secondaryAppointmentId));
  }

  await setLastAction(state.id, null, lastAction.previousCurrentSlot);
  return emitQueueUpdate(doctorId, date, tenantId);
}

export async function resetQueue(tenantId: string, input: QueueActionInput) {
  const { doctorId, date } = input;
  const state = await getOrCreateQueueState(tenantId, doctorId, date);
  const todayAppts = await appointmentsForDate(tenantId, doctorId, date);

  const toCancel = todayAppts.filter((a) => a.status === "waiting" || a.status === "in-cabin");
  if (toCancel.length > 0) {
    const ids = toCancel.map((a) => a.id);
    const slotIds = toCancel.map((a) => a.slotId);

    await db
      .update(appointments)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(inArray(appointments.id, ids));

    await db
      .update(slots)
      .set({ status: "available" })
      .where(inArray(slots.id, slotIds));
  }

  await db
    .update(queueState)
    .set({
      currentSlot: 0,
      lastSlot: 0,
      lastAction: null,
      updatedAt: new Date(),
    })
    .where(eq(queueState.id, state.id));

  return emitQueueUpdate(doctorId, date, tenantId);
}

export async function updateAppointmentStatus(
  tenantId: string,
  input: UpdateAppointmentStatusInput,
) {
  const appointment = await db.query.appointments.findFirst({
    where: and(eq(appointments.id, input.appointmentId), eq(appointments.tenantId, tenantId)),
  });
  if (!appointment) {
    throw new AppError(404, "Appointment not found", "NOT_FOUND");
  }

  const slot = await db.query.slots.findFirst({ where: eq(slots.id, appointment.slotId) });
  if (!slot) {
    throw new AppError(404, "Slot not found", "NOT_FOUND");
  }

  // If marking cancelled, free the slot
  if (input.status === "cancelled" && appointment.status !== "cancelled") {
    await db.update(slots).set({ status: "available" }).where(eq(slots.id, appointment.slotId));
  }

  // Only one in-cabin at a time
  if (input.status === "in-cabin") {
    const todayAppts = await appointmentsForDate(tenantId, appointment.doctorId, slot.date);
    for (const other of todayAppts) {
      if (other.id !== appointment.id && other.status === "in-cabin") {
        await db
          .update(appointments)
          .set({ status: "waiting", updatedAt: new Date() })
          .where(eq(appointments.id, other.id));
      }
    }
  }

  const [updated] = await db
    .update(appointments)
    .set({ status: input.status, updatedAt: new Date() })
    .where(eq(appointments.id, input.appointmentId))
    .returning();

  const state = await getOrCreateQueueState(tenantId, appointment.doctorId, slot.date);
  const currentSlot =
    input.status === "in-cabin" ? updated.tokenNumber : state.currentSlot;

  await setLastAction(
    state.id,
    {
      appointmentId: appointment.id,
      previousStatus: appointment.status,
      previousCurrentSlot: state.currentSlot,
      previousSessionEnded: false,
    },
    currentSlot,
  );

  return emitQueueUpdate(appointment.doctorId, slot.date, tenantId);
}

export async function updateDoctorNotes(tenantId: string, input: UpdateDoctorNotesInput) {
  const appointment = await db.query.appointments.findFirst({
    where: and(eq(appointments.id, input.appointmentId), eq(appointments.tenantId, tenantId)),
  });
  if (!appointment) {
    throw new AppError(404, "Appointment not found", "NOT_FOUND");
  }

  const [updated] = await db
    .update(appointments)
    .set({
      doctorNotes: input.doctorNotes?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(appointments.id, input.appointmentId))
    .returning();

  const slot = await db.query.slots.findFirst({ where: eq(slots.id, appointment.slotId) });
  if (slot) {
    await emitQueueUpdate(appointment.doctorId, slot.date, tenantId);
  }

  return updated;
}
