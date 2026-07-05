import { eq, and } from "drizzle-orm";
import { db } from "../../config/db.js";
import { doctors, doctorSchedules, doctorBreaks, clinics } from "../../db/schema/index.js";
import { AppError } from "../../types/index.js";
import type {
  CreateDoctorInput,
  UpdateDoctorInput,
  UpdateScheduleInput,
  CreateBreakInput,
} from "./doctor.validator.js";

export async function listDoctors(tenantId: string, clinicId?: string) {
  if (clinicId) {
    return db.query.doctors.findMany({
      where: and(eq(doctors.tenantId, tenantId), eq(doctors.clinicId, clinicId)),
      orderBy: doctors.name,
    });
  }
  return db.query.doctors.findMany({
    where: eq(doctors.tenantId, tenantId),
    orderBy: doctors.name,
  });
}

export async function getDoctor(tenantId: string, doctorId: string) {
  const doctor = await db.query.doctors.findFirst({
    where: and(eq(doctors.id, doctorId), eq(doctors.tenantId, tenantId)),
  });
  if (!doctor) {
    throw new AppError(404, "Doctor not found", "NOT_FOUND");
  }
  return doctor;
}

export async function createDoctor(tenantId: string, input: CreateDoctorInput) {
  // Verify clinic belongs to tenant
  const clinic = await db.query.clinics.findFirst({
    where: and(eq(clinics.id, input.clinicId), eq(clinics.tenantId, tenantId)),
  });
  if (!clinic) {
    throw new AppError(400, "Clinic not found in this tenant", "INVALID_CLINIC");
  }

  const [doctor] = await db
    .insert(doctors)
    .values({ tenantId, ...input })
    .returning();
  return doctor;
}

export async function updateDoctor(tenantId: string, doctorId: string, input: UpdateDoctorInput) {
  const [doctor] = await db
    .update(doctors)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(doctors.id, doctorId), eq(doctors.tenantId, tenantId)))
    .returning();
  if (!doctor) {
    throw new AppError(404, "Doctor not found", "NOT_FOUND");
  }
  return doctor;
}

export async function deleteDoctor(tenantId: string, doctorId: string) {
  const [doctor] = await db
    .delete(doctors)
    .where(and(eq(doctors.id, doctorId), eq(doctors.tenantId, tenantId)))
    .returning();
  if (!doctor) {
    throw new AppError(404, "Doctor not found", "NOT_FOUND");
  }
  return doctor;
}

export async function getSchedules(tenantId: string, doctorId: string) {
  await getDoctor(tenantId, doctorId); // verify exists
  return db.query.doctorSchedules.findMany({
    where: eq(doctorSchedules.doctorId, doctorId),
    orderBy: doctorSchedules.dayOfWeek,
  });
}

export async function updateSchedules(tenantId: string, doctorId: string, input: UpdateScheduleInput) {
  await getDoctor(tenantId, doctorId); // verify exists

  // Replace all schedules for this doctor
  await db.delete(doctorSchedules).where(eq(doctorSchedules.doctorId, doctorId));

  const rows = input.schedules.map((s) => ({
    tenantId,
    doctorId,
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    slotDurationMinutes: s.slotDurationMinutes,
  }));

  const inserted = await db.insert(doctorSchedules).values(rows).returning();
  return inserted;
}

export async function getBreaks(tenantId: string, doctorId: string) {
  await getDoctor(tenantId, doctorId);
  return db.query.doctorBreaks.findMany({
    where: eq(doctorBreaks.doctorId, doctorId),
    orderBy: doctorBreaks.startDate,
  });
}

export async function createBreak(tenantId: string, doctorId: string, input: CreateBreakInput) {
  await getDoctor(tenantId, doctorId);
  const [brk] = await db
    .insert(doctorBreaks)
    .values({ tenantId, doctorId, ...input })
    .returning();
  return brk;
}
