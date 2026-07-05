import { eq, and } from "drizzle-orm";
import { db } from "../../config/db.js";
import { clinics } from "../../db/schema/index.js";
import { AppError } from "../../types/index.js";
import type { CreateClinicInput, UpdateClinicInput } from "./clinic.validator.js";

export async function listClinics(tenantId: string) {
  return db.query.clinics.findMany({
    where: eq(clinics.tenantId, tenantId),
    orderBy: clinics.name,
  });
}

export async function getClinic(tenantId: string, clinicId: string) {
  const clinic = await db.query.clinics.findFirst({
    where: and(eq(clinics.id, clinicId), eq(clinics.tenantId, tenantId)),
  });
  if (!clinic) {
    throw new AppError(404, "Clinic not found", "NOT_FOUND");
  }
  return clinic;
}

export async function createClinic(tenantId: string, input: CreateClinicInput) {
  const [clinic] = await db
    .insert(clinics)
    .values({ tenantId, ...input })
    .returning();
  return clinic;
}

export async function updateClinic(tenantId: string, clinicId: string, input: UpdateClinicInput) {
  const [clinic] = await db
    .update(clinics)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(clinics.id, clinicId), eq(clinics.tenantId, tenantId)))
    .returning();
  if (!clinic) {
    throw new AppError(404, "Clinic not found", "NOT_FOUND");
  }
  return clinic;
}

export async function deleteClinic(tenantId: string, clinicId: string) {
  const [clinic] = await db
    .delete(clinics)
    .where(and(eq(clinics.id, clinicId), eq(clinics.tenantId, tenantId)))
    .returning();
  if (!clinic) {
    throw new AppError(404, "Clinic not found", "NOT_FOUND");
  }
  return clinic;
}
