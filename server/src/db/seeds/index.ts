import { db, pool } from "../../config/db.js";
import { tenants } from "../schema/tenants.js";
import { users } from "../schema/users.js";
import { clinics } from "../schema/clinics.js";
import { doctors } from "../schema/doctors.js";
import { doctorSchedules } from "../schema/doctorSchedules.js";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { env } from "../../config/env.js";
import { hashPassword, comparePassword } from "../../utils/hash.js";
import { logger } from "../../utils/logger.js";

const isProd = env.NODE_ENV === "production";

// Well-known dev passwords. They must never be usable in production.
const KNOWN_DEV_PASSWORDS = ["Admin@1234", "Doctor@1234", "Patient@1234"];

/** Dev: the documented password. Production: random, unrecoverable (reset via admin flow). */
function seedPassword(devPassword: string): string {
  return isProd ? crypto.randomBytes(24).toString("hex") : devPassword;
}

/** Production only: rotate any account still using a published seed password. */
async function neutralizeKnownPasswords() {
  const all = await db.select().from(users);
  for (const u of all) {
    for (const known of KNOWN_DEV_PASSWORDS) {
      if (await comparePassword(known, u.passwordHash)) {
        const randomHash = await hashPassword(crypto.randomBytes(24).toString("hex"));
        await db.update(users).set({ passwordHash: randomHash, updatedAt: new Date() }).where(eq(users.id, u.id));
        logger.warn(`Rotated published seed password for ${u.email}`);
        break;
      }
    }
  }
}

/**
 * Superadmin credentials come from the environment.
 * Dev: falls back to the documented defaults. Production: skipped unless both are set.
 */
function superadminCredentials(): { email: string; password: string } | null {
  const email = process.env.SUPERADMIN_EMAIL || (isProd ? undefined : "superadmin@waitsmart.app");
  const password = process.env.SUPERADMIN_PASSWORD || (isProd ? undefined : "Admin@1234");
  if (!email || !password) return null;
  if (isProd && password.length < 12) {
    throw new Error("SUPERADMIN_PASSWORD must be at least 12 characters in production");
  }
  return { email, password };
}

async function seed() {
  logger.info("Seeding database...");

  if (isProd) await neutralizeKnownPasswords();

  // 1. Superadmin user (no tenant)
  const creds = superadminCredentials();
  if (!creds) {
    logger.warn("SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD not set � skipping superadmin creation");
  } else {
    const [superadmin] = await db
      .insert(users)
      .values({
        name: "Super Admin",
        email: creds.email,
        phone: "+919999900000",
        passwordHash: await hashPassword(creds.password),
        role: "superadmin",
        tenantId: null,
      })
      .onConflictDoNothing()
      .returning();

    if (superadmin) {
      logger.info(`Created superadmin: ${superadmin.email}`);
    } else {
      logger.info("Superadmin already exists, skipping");
    }
  }

  // 2. Sample tenant
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: "Apollo Clinic",
      slug: "apollo-clinic",
      subdomain: "apollo",
      branding: { primaryColor: "#2563eb", appName: "Apollo WaitSmart" },
    })
    .onConflictDoNothing()
    .returning();

  if (!tenant) {
    logger.info("Tenant already exists, skipping remaining seeds");
    await pool.end();
    return;
  }
  logger.info(`Created tenant: ${tenant.name} (${tenant.id})`);

  // 3. Admin user for the tenant
  const adminPassword = await hashPassword(seedPassword("Admin@1234"));
  const [admin] = await db
    .insert(users)
    .values({
      name: "Clinic Admin",
      email: "admin@apollo.waitsmart.app",
      phone: "+919999900001",
      passwordHash: adminPassword,
      role: "admin",
      tenantId: tenant.id,
    })
    .returning();
  logger.info(`Created admin: ${admin.email}`);

  // 4. Sample clinics
  const [clinic] = await db
    .insert(clinics)
    .values({
      tenantId: tenant.id,
      name: "Apollo Main Branch",
      address: "123 Health Street, Chennai 600001",
      hours: "9:00 AM – 2:00 PM • 4:00 PM – 6:00 PM",
    })
    .returning();
  logger.info(`Created clinic: ${clinic.name}`);

  const [clinic2] = await db
    .insert(clinics)
    .values({
      tenantId: tenant.id,
      name: "Apollo — Anna Nagar",
      address: "45 Anna Nagar West, Chennai 600040",
      hours: "9:00 AM – 2:00 PM • 4:00 PM – 6:00 PM",
    })
    .returning();
  logger.info(`Created clinic: ${clinic2.name}`);

  // 5. Doctor user
  const doctorPassword = await hashPassword(seedPassword("Doctor@1234"));
  const [doctorUser] = await db
    .insert(users)
    .values({
      name: "Dr. Priya Sharma",
      email: "priya@apollo.waitsmart.app",
      phone: "+919999900002",
      passwordHash: doctorPassword,
      role: "doctor",
      tenantId: tenant.id,
    })
    .returning();

  // 6. Doctor record
  const [doctor] = await db
    .insert(doctors)
    .values({
      tenantId: tenant.id,
      clinicId: clinic.id,
      userId: doctorUser.id,
      name: "Dr. Priya Sharma",
      specialization: "General Medicine",
      experienceYears: 8,
    })
    .returning();
  logger.info(`Created doctor: ${doctor.name}`);

  const [doctor2] = await db
    .insert(doctors)
    .values({
      tenantId: tenant.id,
      clinicId: clinic2.id,
      name: "Dr. Karthik Iyer",
      specialization: "General Physician",
      experienceYears: 12,
    })
    .returning();
  logger.info(`Created doctor: ${doctor2.name}`);

  // Doctor weekly schedules (Mon–Sat, 9:00–18:00, 30-min slots — aligns with queue-mvp UI)
  const scheduleDays = [1, 2, 3, 4, 5, 6];
  await db.insert(doctorSchedules).values(
    scheduleDays.flatMap((dayOfWeek) => [
      {
        tenantId: tenant.id,
        doctorId: doctor.id,
        dayOfWeek,
        startTime: "09:00",
        endTime: "18:00",
        slotDurationMinutes: 30,
      },
      {
        tenantId: tenant.id,
        doctorId: doctor2.id,
        dayOfWeek,
        startTime: "09:00",
        endTime: "18:00",
        slotDurationMinutes: 30,
      },
    ]),
  );
  logger.info("Created doctor schedules (Mon–Sat 09:00–18:00, 30-min slots)");

  // 7. Patient user
  const patientPassword = await hashPassword(seedPassword("Patient@1234"));
  const [patient] = await db
    .insert(users)
    .values({
      name: "Rajesh Kumar",
      email: "rajesh@example.com",
      phone: "+919876543210",
      passwordHash: patientPassword,
      role: "patient",
      tenantId: tenant.id,
    })
    .returning();
  logger.info(`Created patient: ${patient.email}`);

  logger.info("Seeding complete!");
  if (!isProd) {
    logger.info("---");
    logger.info("Test credentials (development only):");
    logger.info("  Superadmin: superadmin@waitsmart.app / Admin@1234");
    logger.info("  Admin:      admin@apollo.waitsmart.app / Admin@1234");
    logger.info("  Doctor:     priya@apollo.waitsmart.app / Doctor@1234");
    logger.info("  Patient:    rajesh@example.com / Patient@1234");
  }

  await pool.end();
}

seed().catch((err) => {
  logger.error("Seed failed", { err });
  process.exit(1);
});
