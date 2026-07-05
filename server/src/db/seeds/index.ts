import { db, pool } from "../../config/db.js";
import { tenants } from "../schema/tenants.js";
import { users } from "../schema/users.js";
import { clinics } from "../schema/clinics.js";
import { doctors } from "../schema/doctors.js";
import { doctorSchedules } from "../schema/doctorSchedules.js";
import { hashPassword } from "../../utils/hash.js";
import { logger } from "../../utils/logger.js";

async function seed() {
  logger.info("Seeding database...");

  // 1. Superadmin user (no tenant)
  const superadminPassword = await hashPassword("Admin@1234");
  const [superadmin] = await db
    .insert(users)
    .values({
      name: "Super Admin",
      email: "superadmin@waitsmart.app",
      phone: "+919999900000",
      passwordHash: superadminPassword,
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
  const adminPassword = await hashPassword("Admin@1234");
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

  // 4. Sample clinic
  const [clinic] = await db
    .insert(clinics)
    .values({
      tenantId: tenant.id,
      name: "Apollo Main Branch",
      address: "123 Health Street, Chennai 600001",
      hours: "Mon-Sat 9:00-18:00",
    })
    .returning();
  logger.info(`Created clinic: ${clinic.name}`);

  // 5. Doctor user
  const doctorPassword = await hashPassword("Doctor@1234");
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

  // 6b. Doctor weekly schedule (Mon–Sat, 9:00–17:00, 15-min slots)
  await db.insert(doctorSchedules).values(
    [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      tenantId: tenant.id,
      doctorId: doctor.id,
      dayOfWeek,
      startTime: "09:00",
      endTime: "17:00",
      slotDurationMinutes: 15,
    })),
  );
  logger.info("Created doctor schedule (Mon–Sat 09:00–17:00)");

  // 7. Patient user
  const patientPassword = await hashPassword("Patient@1234");
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
  logger.info("---");
  logger.info("Test credentials:");
  logger.info("  Superadmin: superadmin@waitsmart.app / Admin@1234");
  logger.info("  Admin:      admin@apollo.waitsmart.app / Admin@1234");
  logger.info("  Doctor:     priya@apollo.waitsmart.app / Doctor@1234");
  logger.info("  Patient:    rajesh@example.com / Patient@1234");

  await pool.end();
}

seed().catch((err) => {
  logger.error("Seed failed", { err });
  process.exit(1);
});
