import { and, eq } from "drizzle-orm";
import { db } from "../../config/db.js";
import { env } from "../../config/env.js";
import { clinics } from "../schema/clinics.js";
import { doctors } from "../schema/doctors.js";
import { doctorSchedules } from "../schema/doctorSchedules.js";
import { tenants } from "../schema/tenants.js";
import { logger } from "../../utils/logger.js";
import { loadDataset, type DatasetId } from "./datasets.js";

const SLOT_MINUTES = 30;

/**
 * Adds the clinics + doctors of the active dataset (SEED_DATASET, see datasets.ts) to the default tenant
 * so patients signing in by phone can find and book them.
 * Idempotent: existing clinics/doctors (matched by name) are left untouched, except that a gender that is
 * now specified in the dataset is filled in. Never deletes anything.
 * Set SEED_CHENNAI_CLINICS=false to skip (kept for backwards compatibility).
 */
export async function seedDemoClinics(datasetId?: DatasetId) {
  if (process.env.SEED_CHENNAI_CLINICS === "false") {
    logger.info("SEED_CHENNAI_CLINICS=false - skipping demo clinics");
    return;
  }

  const dataset = loadDataset(datasetId);
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, env.DEFAULT_TENANT_SLUG) });
  if (!tenant) {
    logger.warn(`Default tenant "${env.DEFAULT_TENANT_SLUG}" not found - skipping demo clinics`);
    return;
  }

  let newClinics = 0;
  let newDoctors = 0;
  let genderFilled = 0;

  for (const c of dataset.clinics) {
    let clinic = await db.query.clinics.findFirst({
      where: and(eq(clinics.tenantId, tenant.id), eq(clinics.name, c.name)),
    });
    if (!clinic) {
      [clinic] = await db
        .insert(clinics)
        .values({ tenantId: tenant.id, name: c.name, address: c.address, hours: c.hours })
        .returning();
      newClinics++;
    }

    for (const d of c.doctors) {
      const existing = await db.query.doctors.findFirst({
        where: and(eq(doctors.tenantId, tenant.id), eq(doctors.clinicId, clinic.id), eq(doctors.name, d.name)),
      });
      if (existing) {
        if (d.gender && existing.gender !== d.gender) {
          await db.update(doctors).set({ gender: d.gender, updatedAt: new Date() }).where(eq(doctors.id, existing.id));
          genderFilled++;
        }
        continue;
      }

      const [doctor] = await db
        .insert(doctors)
        .values({
          tenantId: tenant.id,
          clinicId: clinic.id,
          name: d.name,
          specialization: d.specialization,
          experienceYears: d.experienceYears,
          gender: d.gender ?? null,
        })
        .returning();
      newDoctors++;

      await db.insert(doctorSchedules).values(
        c.schedule.days.map((dayOfWeek) => ({
          tenantId: tenant.id,
          doctorId: doctor.id,
          dayOfWeek,
          startTime: c.schedule.start,
          endTime: c.schedule.end,
          slotDurationMinutes: SLOT_MINUTES,
        })),
      );
    }
  }

  logger.info(
    `Demo clinics (${dataset.id}) seeded: ${newClinics} new clinics, ${newDoctors} new doctors, ${genderFilled} genders filled`,
  );
}
