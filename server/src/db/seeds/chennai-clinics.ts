import { readFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { db } from "../../config/db.js";
import { env } from "../../config/env.js";
import { clinics } from "../schema/clinics.js";
import { doctors } from "../schema/doctors.js";
import { doctorSchedules } from "../schema/doctorSchedules.js";
import { tenants } from "../schema/tenants.js";
import { logger } from "../../utils/logger.js";

interface ClinicSeed {
  name: string;
  address: string;
  hours: string;
  schedule: { days: number[]; start: string; end: string };
  sources: string[];
  doctors: { name: string; specialization: string; experienceYears: number }[];
}

const SLOT_MINUTES = 30;

function loadClinics(): ClinicSeed[] {
  const raw = readFileSync(new URL("./data/chennai-clinics.json", import.meta.url), "utf8");
  return (JSON.parse(raw) as { clinics: ClinicSeed[] }).clinics;
}

/**
 * Adds real Chennai clinics + doctors (public listing data, see data/chennai-clinics.json) to the
 * default tenant so patients signing in by phone can find and book them.
 * Idempotent: existing clinics/doctors (matched by name) are left untouched. Never deletes anything.
 * Set SEED_CHENNAI_CLINICS=false to skip.
 */
export async function seedChennaiClinics() {
  if (process.env.SEED_CHENNAI_CLINICS === "false") {
    logger.info("SEED_CHENNAI_CLINICS=false — skipping Chennai clinics");
    return;
  }

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, env.DEFAULT_TENANT_SLUG) });
  if (!tenant) {
    logger.warn(`Default tenant "${env.DEFAULT_TENANT_SLUG}" not found — skipping Chennai clinics`);
    return;
  }

  let newClinics = 0;
  let newDoctors = 0;

  for (const c of loadClinics()) {
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
      if (existing) continue;

      const [doctor] = await db
        .insert(doctors)
        .values({
          tenantId: tenant.id,
          clinicId: clinic.id,
          name: d.name,
          specialization: d.specialization,
          experienceYears: d.experienceYears,
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

  logger.info(`Chennai clinics seeded: ${newClinics} new clinics, ${newDoctors} new doctors`);
}
