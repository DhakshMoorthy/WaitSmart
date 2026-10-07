import crypto from "crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { env } from "../../config/env.js";
import { appointments, clinics, doctors, slots, tenants, users } from "../schema/index.js";
import { hashPassword } from "../../utils/hash.js";
import { logger } from "../../utils/logger.js";
import { createBooking, getAvailability } from "../../modules/booking/booking.service.js";
import { nextPatient } from "../../modules/queue/queue.service.js";
import { KNOWN_DEV_PASSWORDS } from "./known-passwords.js";
import { loadDataset, type Dataset, type DatasetId } from "./datasets.js";

/**
 * Development/test data for exercising every part of the app. Opt-in: SEED_TEST_DATA=true.
 *
 * Staff logins (email + password) additionally need TEST_ACCOUNTS_PASSWORD (8+ chars, set in the
 * environment, never committed). Patients have no password: they sign in with their phone number
 * and the on-screen OTP. Everything is idempotent and lives in the default tenant.
 *
 * Accounts (see docs/TEST_DATA.md):
 *   admin@<domain>                  clinic admin
 *   doctor.<clinic key>@<domain>    one doctor login per clinic (linked to that clinic's first doctor)
 *   8 test patients                 phone + OTP
 * Clinics, patient names, account names/phones and the demo time zone come from the active dataset
 * (SEED_DATASET, see datasets.ts); e.g. chennai uses @demo.waitsmart.test, us-uk uses @us-uk.demo.waitsmart.test.
 */

export const adminLoginEmail = (dataset: Dataset) => `admin@${dataset.testAccounts.emailDomain}`;

export const doctorLoginEmail = (dataset: Dataset, clinicKey: string) =>
  `doctor.${clinicKey}@${dataset.testAccounts.emailDomain}`;

/** Test patients: names from the dataset, phones from its patientPhoneBase (phone login is India-format in the UI). */
export const testPatients = (dataset: Dataset) =>
  dataset.patients.map((name, i) => ({ name, phone: `${dataset.testAccounts.patientPhoneBase}${i + 1}` }));

const SYMPTOMS = [
  "Fever and body ache for 2 days",
  "Routine check-up",
  "Follow-up consultation",
  "Persistent cough",
  "Back pain",
  "Skin rash",
  "Headache and dizziness",
  "Blood pressure review",
];

// ---- working-day helpers (clinics run Mon-Sat; dates are in Indian Standard Time) ----

/** Calendar date (YYYY-MM-DD) `offsetDays` from today in the dataset's time zone. */
function localDate(offsetDays: number, utcOffsetMinutes: number): string {
  const d = new Date(Date.now() + utcOffsetMinutes * 60 * 1000);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function isOpenDay(iso: string, openDays: number[]): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  return openDays.includes(new Date(Date.UTC(y, m - 1, d)).getUTCDay());
}

/** First offset starting at `from`, moving by `step`, that falls on a day the clinic is open. */
function workdayOffset(from: number, step: 1 | -1, utcOffsetMinutes: number, openDays: number[]): number {
  let o = from;
  for (let i = 0; i < 7 && !isOpenDay(localDate(o, utcOffsetMinutes), openDays); i++) o += step;
  return o;
}

// ---- users ----

async function ensureUser(input: {
  email: string;
  name: string;
  phone: string;
  role: "admin" | "doctor" | "patient";
  tenantId: string;
  passwordHash: string;
  refreshPassword?: boolean;
}) {
  const existing = await db.query.users.findFirst({ where: eq(users.email, input.email) });
  if (existing) {
    // Keep the login in sync with TEST_ACCOUNTS_PASSWORD so rotating the env var takes effect.
    if (input.refreshPassword) {
      await db.update(users).set({ passwordHash: input.passwordHash, updatedAt: new Date() }).where(eq(users.id, existing.id));
    }
    return existing;
  }
  const [created] = await db
    .insert(users)
    .values({
      tenantId: input.tenantId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash: input.passwordHash,
      role: input.role,
    })
    .returning();
  return created;
}

/** Test logins hold only demo data, so the bar is lower than for the superadmin (12+). */
export const MIN_TEST_PASSWORD_LENGTH = 8;

function validStaffPassword(): string | null {
  const pw = process.env.TEST_ACCOUNTS_PASSWORD;
  if (!pw) return null;
  if (pw.length < MIN_TEST_PASSWORD_LENGTH || KNOWN_DEV_PASSWORDS.includes(pw)) {
    logger.warn(
      `TEST_ACCOUNTS_PASSWORD must be ${MIN_TEST_PASSWORD_LENGTH}+ characters and not a published password - skipping staff test accounts (admin/doctor logins NOT created)`,
    );
    return null;
  }
  return pw;
}

// ---- demo bookings ----

async function bookDay(opts: {
  tenantId: string;
  clinicId: string;
  doctorId: string;
  date: string;
  slotIndexes: number[];
  patientRows: { id: string; name: string; phone: string | null }[];
  patientOffset: number;
}) {
  const already = await db
    .select({ id: appointments.id })
    .from(appointments)
    .innerJoin(slots, eq(appointments.slotId, slots.id))
    .where(and(eq(appointments.doctorId, opts.doctorId), eq(slots.date, opts.date)))
    .limit(1);
  if (already.length) return [];

  const avail = await getAvailability(opts.tenantId, opts.doctorId, opts.date, { userId: "seed", role: "superadmin" });
  const daySlots = avail.slots as { id: string; slotIndex: number; status: string }[];
  if (!daySlots.length) return []; // no schedule that day

  const created: { id: string; slotId: string }[] = [];
  for (const [i, idx] of opts.slotIndexes.entries()) {
    const slot = daySlots.find((s) => s.slotIndex === idx && s.status === "available");
    if (!slot) continue;
    const p = opts.patientRows[(opts.patientOffset + i) % opts.patientRows.length];
    const appt = await createBooking(opts.tenantId, p.id, {
      clinicId: opts.clinicId,
      doctorId: opts.doctorId,
      slotId: slot.id,
      patientName: p.name,
      patientPhone: p.phone ?? undefined,
      symptoms: SYMPTOMS[(opts.patientOffset + i) % SYMPTOMS.length],
    });
    created.push({ id: appt.id, slotId: slot.id });
  }
  return created;
}

export async function seedTestData(datasetId?: DatasetId) {
  if (process.env.SEED_TEST_DATA !== "true") {
    logger.info("SEED_TEST_DATA is not 'true' — skipping test data");
    return;
  }

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, env.DEFAULT_TENANT_SLUG) });
  if (!tenant) {
    logger.warn("Default tenant not found — skipping test data");
    return;
  }

  const dataset = loadDataset(datasetId);
  const patients = testPatients(dataset);

  // Patients: phone + OTP login, random unusable password.
  const patientRows = [];
  for (const p of patients) {
    patientRows.push(
      await ensureUser({
        email: `${p.phone.replace("+", "")}@otp.waitsmart.app`,
        name: p.name,
        phone: p.phone,
        role: "patient",
        tenantId: tenant.id,
        passwordHash: crypto.randomBytes(32).toString("hex"),
      }),
    );
  }

  // Staff logins.
  const staffPassword = validStaffPassword();
  let doctorLogins = 0;
  if (staffPassword) {
    const hash = await hashPassword(staffPassword);
    await ensureUser({
      email: adminLoginEmail(dataset),
      name: "Demo Clinic Admin",
      phone: dataset.testAccounts.adminPhone,
      role: "admin",
      tenantId: tenant.id,
      passwordHash: hash,
      refreshPassword: true,
    });

    let n = 1;
    for (const { key, name: clinicName } of dataset.clinics) {
      const clinic = await db.query.clinics.findFirst({ where: and(eq(clinics.tenantId, tenant.id), eq(clinics.name, clinicName)) });
      if (!clinic) continue;
      const doctor = await db.query.doctors.findFirst({ where: eq(doctors.clinicId, clinic.id), orderBy: asc(doctors.name) });
      if (!doctor) continue;
      const user = await ensureUser({
        email: doctorLoginEmail(dataset, key),
        name: doctor.name,
        phone: `${dataset.testAccounts.doctorPhoneBase}${n++}`,
        role: "doctor",
        tenantId: tenant.id,
        passwordHash: hash,
        refreshPassword: true,
      });
      if (doctor.userId !== user.id) await db.update(doctors).set({ userId: user.id }).where(eq(doctors.id, doctor.id));
      doctorLogins++;
    }
  } else {
    logger.warn("TEST_ACCOUNTS_PASSWORD not set — created test patients and bookings only, no admin/doctor logins");
  }

  // Demo bookings in different queue states for three clinics.
  const tz = dataset.utcOffsetMinutes;

  let booked = 0;
  let offset = 0;
  for (const clinicSeed of dataset.clinics.filter((c) => dataset.demoBookingClinics.includes(c.key))) {
    const clinicName = clinicSeed.name;
    const clinic = await db.query.clinics.findFirst({ where: and(eq(clinics.tenantId, tenant.id), eq(clinics.name, clinicName)) });
    if (!clinic) continue;
    const doctor = await db.query.doctors.findFirst({ where: eq(doctors.clinicId, clinic.id), orderBy: asc(doctors.name) });
    if (!doctor) continue;
    const base = { tenantId: tenant.id, clinicId: clinic.id, doctorId: doctor.id, patientRows, patientOffset: offset++ };

    // Dates follow this clinic's own open days (Mon-Sat in Chennai, Mon-Fri for the US/UK hospitals).
    const open = clinicSeed.schedule.days;
    const yesterday = localDate(workdayOffset(-1, -1, tz, open), tz);
    const todayOff = workdayOffset(0, 1, tz, open);
    const today = localDate(todayOff, tz);
    const tomorrow = localDate(workdayOffset(todayOff + 1, 1, tz, open), tz);

    // History: finished / no-show / cancelled.
    const past = await bookDay({ ...base, date: yesterday, slotIndexes: [1, 3, 4, 7] });
    const pastStatuses = ["done", "done", "no-show", "cancelled"] as const;
    for (const [i, a] of past.entries()) {
      await db.update(appointments).set({ status: pastStatuses[i], updatedAt: new Date() }).where(eq(appointments.id, a.id));
      if (pastStatuses[i] === "cancelled") await db.update(slots).set({ status: "available" }).where(eq(slots.id, a.slotId));
    }
    booked += past.length;

    // Today: one done, one in the cabin, the rest waiting (a live queue to play with).
    const now = await bookDay({ ...base, date: today, slotIndexes: [2, 3, 5, 6, 9, 11] });
    if (now.length >= 3) {
      await nextPatient(tenant.id, { doctorId: doctor.id, date: today });
      await nextPatient(tenant.id, { doctorId: doctor.id, date: today });
    }
    booked += now.length;

    // Tomorrow: all waiting.
    booked += (await bookDay({ ...base, date: tomorrow, slotIndexes: [1, 4, 8] })).length;
  }

  logger.info(
    `Test data (${dataset.id}): ${patientRows.length} patients, ${staffPassword ? `admin + ${doctorLogins} doctor logins` : "no staff logins"}, ${booked} new demo bookings`,
  );
}

/** Used by tests: how many appointments a doctor has on a date, grouped by status. */
export async function statusCounts(doctorId: string, date: string) {
  const rows = await db
    .select({ status: appointments.status, n: sql<number>`count(*)::int` })
    .from(appointments)
    .innerJoin(slots, eq(appointments.slotId, slots.id))
    .where(and(eq(appointments.doctorId, doctorId), eq(slots.date, date), inArray(appointments.status, ["waiting", "in-cabin", "done", "no-show", "cancelled", "skipped"])))
    .groupBy(appointments.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Record<string, number>;
}
