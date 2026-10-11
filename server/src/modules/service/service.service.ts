import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "../../config/db.js";
import { clinics, doctors, services } from "../../db/schema/index.js";
import { AppError } from "../../types/index.js";
import type { Actor } from "../booking/booking.service.js";
import type { CreateServiceInput, UpdateServiceInput } from "./service.validator.js";

/** Services a patient can pick for one doctor: the doctor's own plus the clinic-wide ones. */
export async function listForDoctor(tenantId: string, doctorId: string) {
  const doctor = await db.query.doctors.findFirst({
    where: and(eq(doctors.id, doctorId), eq(doctors.tenantId, tenantId)),
  });
  if (!doctor) throw new AppError(404, "Doctor not found", "NOT_FOUND");
  return db.query.services.findMany({
    where: and(
      eq(services.tenantId, tenantId),
      eq(services.clinicId, doctor.clinicId),
      or(eq(services.doctorId, doctorId), isNull(services.doctorId)),
    ),
    orderBy: services.name,
  });
}

export async function listForClinic(tenantId: string, clinicId: string) {
  return db.query.services.findMany({
    where: and(eq(services.tenantId, tenantId), eq(services.clinicId, clinicId)),
    orderBy: services.name,
  });
}

/** admin / superadmin: anything in the tenant. doctor: only services of their own doctor profile. */
async function assertCanEdit(actor: Actor, tenantId: string, target: { doctorId: string | null }) {
  if (actor.role === "admin" || actor.role === "superadmin") return;
  if (actor.role === "doctor" && target.doctorId) {
    const own = await db.query.doctors.findFirst({
      where: and(eq(doctors.id, target.doctorId), eq(doctors.tenantId, tenantId), eq(doctors.userId, actor.userId)),
    });
    if (own) return;
  }
  throw new AppError(403, "You can only manage your own services", "FORBIDDEN");
}

export async function createService(tenantId: string, actor: Actor, input: CreateServiceInput) {
  const clinic = await db.query.clinics.findFirst({
    where: and(eq(clinics.id, input.clinicId), eq(clinics.tenantId, tenantId)),
  });
  if (!clinic) throw new AppError(400, "Clinic not found in this tenant", "INVALID_CLINIC");

  const doctorId = input.doctorId ?? null;
  if (doctorId) {
    const doctor = await db.query.doctors.findFirst({
      where: and(eq(doctors.id, doctorId), eq(doctors.tenantId, tenantId)),
    });
    if (!doctor || doctor.clinicId !== input.clinicId) {
      throw new AppError(400, "Doctor does not belong to this clinic", "INVALID_CLINIC");
    }
  }
  await assertCanEdit(actor, tenantId, { doctorId });

  const [row] = await db
    .insert(services)
    .values({ tenantId, clinicId: input.clinicId, doctorId, name: input.name, durationMinutes: input.durationMinutes })
    .returning();
  return row;
}

async function loadOwned(tenantId: string, actor: Actor, id: string) {
  const row = await db.query.services.findFirst({
    where: and(eq(services.id, id), eq(services.tenantId, tenantId)),
  });
  if (!row) throw new AppError(404, "Service not found", "NOT_FOUND");
  await assertCanEdit(actor, tenantId, row);
  return row;
}

export async function updateService(tenantId: string, actor: Actor, id: string, input: UpdateServiceInput) {
  await loadOwned(tenantId, actor, id);
  const [row] = await db.update(services).set(input).where(eq(services.id, id)).returning();
  return row;
}

export async function deleteService(tenantId: string, actor: Actor, id: string) {
  await loadOwned(tenantId, actor, id);
  const [row] = await db.delete(services).where(eq(services.id, id)).returning();
  return row;
}
