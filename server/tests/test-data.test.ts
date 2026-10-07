import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, asc, eq, inArray } from "drizzle-orm";
import { api, createTestTenant } from "./helpers.js";
import { db } from "../src/config/db.js";
import { env } from "../src/config/env.js";
import { appointments, clinics, doctors, slots, tenants, users } from "../src/db/schema/index.js";
import { seedDemoClinics } from "../src/db/seeds/demo-clinics.js";
import { loadDataset } from "../src/db/seeds/datasets.js";
import { cleanupLegacySampleData } from "../src/db/seeds/legacy-cleanup.js";
import { seedTestData, testPatients, adminLoginEmail } from "../src/db/seeds/test-data.js";

const PASSWORD = "demo-Password-123!";
const dataset = loadDataset("chennai");
const TEST_PATIENTS = testPatients(dataset);
const TEST_ADMIN_EMAIL = adminLoginEmail(dataset);
const count = async (rows: Promise<unknown[]>) => (await rows).length;

describe("Legacy cleanup + test data seed", () => {
  let tenantId: string;

  beforeAll(async () => {
    const tenant = await createTestTenant({ slug: env.DEFAULT_TENANT_SLUG, name: "Apollo Clinic", subdomain: `td-${Date.now()}` });
    tenantId = tenant.id;
    await seedDemoClinics("chennai");

    // The fake data from the ORIGINAL seed, as it exists in the live database.
    const [fake] = await db
      .insert(clinics)
      .values([
        { tenantId, name: "Apollo Main Branch", address: "123 Health Street, Chennai 600001" },
        { tenantId, name: "Apollo — Anna Nagar", address: "45 Anna Nagar West, Chennai 600040" },
      ])
      .returning();
    await db.insert(doctors).values({ tenantId, clinicId: fake.id, name: "Dr. Karthik Iyer", specialization: "General Physician", experienceYears: 12 });

    const hash = "x".repeat(60);
    await db.insert(users).values([
      { tenantId, name: "Clinic Admin", email: "admin@apollo.waitsmart.app", passwordHash: hash, role: "admin" },
      { tenantId, name: "Dr. Priya Sharma", email: "priya@apollo.waitsmart.app", passwordHash: hash, role: "doctor" },
      { tenantId, name: "Rajesh Kumar", email: "rajesh@example.com", passwordHash: hash, role: "patient" },
      { tenantId, name: "Probe User", email: "probe-123456@example.com", passwordHash: hash, role: "patient" },
      { tenantId, name: "Patient 0003", email: "919000000003@otp.waitsmart.app", phone: "+919000000003", passwordHash: hash, role: "patient" },
      // duplicate superadmin rows from the old seed bug
      { name: "Super Admin", email: "owner@example.com", passwordHash: hash, role: "superadmin" },
      { name: "Super Admin", email: "owner@example.com", passwordHash: hash, role: "superadmin" },
    ]);
  });

  afterAll(() => {
    delete process.env.SEED_TEST_DATA;
    delete process.env.TEST_ACCOUNTS_PASSWORD;
    delete process.env.SUPERADMIN_EMAIL;
  });

  it("does nothing unless SEED_TEST_DATA=true", async () => {
    delete process.env.SEED_TEST_DATA;
    await seedTestData();
    expect(await count(db.select().from(users).where(eq(users.phone, TEST_PATIENTS[0].phone)))).toBe(0);
  });

  it("removes only the fake sample data, keeps the real clinics, and tidies duplicates", async () => {
    process.env.SUPERADMIN_EMAIL = "owner@example.com";
    await cleanupLegacySampleData();

    const names = (await db.select().from(clinics).where(eq(clinics.tenantId, tenantId))).map((c) => c.name);
    expect(names).toHaveLength(5);
    expect(names).not.toContain("Apollo Main Branch");
    expect(names.some((n) => n.includes("Anna Nagar"))).toBe(false);
    expect(await count(db.select().from(doctors).where(eq(doctors.name, "Dr. Karthik Iyer")))).toBe(0);

    for (const email of ["admin@apollo.waitsmart.app", "priya@apollo.waitsmart.app", "rajesh@example.com", "probe-123456@example.com"]) {
      expect(await count(db.select().from(users).where(eq(users.email, email)))).toBe(0);
    }
    expect(await count(db.select().from(users).where(eq(users.phone, "+919000000003")))).toBe(0);
    expect(await count(db.select().from(users).where(eq(users.email, "owner@example.com")))).toBe(1); // duplicates collapsed

    const t = await db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
    expect(t?.name).toBe("Chennai Demo Clinics");
  });

  it("is safe to run the cleanup again", async () => {
    await cleanupLegacySampleData();
    expect(await count(db.select().from(clinics).where(eq(clinics.tenantId, tenantId)))).toBe(5);
  });

  it("refuses a weak / published staff password but still creates patients and bookings", async () => {
    process.env.SEED_TEST_DATA = "true";
    process.env.TEST_ACCOUNTS_PASSWORD = "Admin@1234";
    await seedTestData();
    expect(await count(db.select().from(users).where(eq(users.email, TEST_ADMIN_EMAIL)))).toBe(0);
    expect(await count(db.select().from(users).where(inArray(users.phone, TEST_PATIENTS.map((p) => p.phone))))).toBe(TEST_PATIENTS.length);
  });

  it("refuses a password shorter than the minimum, accepts 10 characters", async () => {
    process.env.TEST_ACCOUNTS_PASSWORD = "short12"; // 7 chars
    await seedTestData();
    expect(await count(db.select().from(users).where(eq(users.email, TEST_ADMIN_EMAIL)))).toBe(0);

    process.env.TEST_ACCOUNTS_PASSWORD = "Demo#1234x"; // 10 chars: the reported case
    await seedTestData();
    const login = await api.post("/auth/login").send({ email: TEST_ADMIN_EMAIL, password: "Demo#1234x" });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe("admin");
  });

  it("creates the admin and one doctor login per clinic", async () => {
    process.env.TEST_ACCOUNTS_PASSWORD = PASSWORD;
    await seedTestData();

    const admin = await db.query.users.findFirst({ where: eq(users.email, TEST_ADMIN_EMAIL) });
    expect(admin?.role).toBe("admin");

    const docLogins = await db.select().from(users).where(and(eq(users.role, "doctor"), eq(users.tenantId, tenantId)));
    expect(docLogins).toHaveLength(dataset.clinics.length);
    const linked = await db.select().from(doctors).where(inArray(doctors.userId, docLogins.map((u) => u.id)));
    expect(linked).toHaveLength(docLogins.length);
  });

  it("builds a realistic queue: done + in-cabin + waiting + history", async () => {
    const clinic = await db.query.clinics.findFirst({ where: and(eq(clinics.tenantId, tenantId), eq(clinics.name, "Apollo Clinic - Velachery")) });
    const doctor = await db.query.doctors.findFirst({ where: eq(doctors.clinicId, clinic!.id), orderBy: asc(doctors.name) });
    const appts = await db.select().from(appointments).where(eq(appointments.doctorId, doctor!.id));
    const by = (s: string) => appts.filter((a) => a.status === s).length;

    expect(by("in-cabin")).toBe(1);
    expect(by("done")).toBeGreaterThanOrEqual(3); // 2 yesterday + 1 served today
    expect(by("waiting")).toBeGreaterThanOrEqual(7); // 4 waiting today + 3 tomorrow
    expect(by("no-show")).toBe(1);
    expect(by("cancelled")).toBe(1);
    // names are real people, not placeholders
    expect(appts.every((a) => TEST_PATIENTS.some((p) => p.name === a.patientName))).toBe(true);
  });

  it("is idempotent: running again adds nothing", async () => {
    const before = [await count(db.select().from(appointments)), await count(db.select().from(users))];
    await seedTestData();
    await seedTestData();
    expect([await count(db.select().from(appointments)), await count(db.select().from(users))]).toEqual(before);
  });

  it("the seeded accounts can sign in and use the app", async () => {
    // clinic admin
    const adm = await api.post("/auth/login").send({ email: TEST_ADMIN_EMAIL, password: PASSWORD });
    expect(adm.status).toBe(200);
    expect(adm.body.user.role).toBe("admin");
    const h = { Authorization: `Bearer ${adm.body.accessToken}` };
    const docs = await api.get("/doctors").set(h);
    expect(docs.body.data.length).toBeGreaterThanOrEqual(18);

    // doctor can run THEIR queue, not another doctor's
    const dl = await api.post("/auth/login").send({ email: "doctor.apollo@demo.waitsmart.test", password: PASSWORD });
    expect(dl.status).toBe(200);
    expect(dl.body.user.role).toBe("doctor");
    const dh = { Authorization: `Bearer ${dl.body.accessToken}` };

    const own = await db.query.doctors.findFirst({ where: eq(doctors.userId, dl.body.user.id) });
    const inCabin = await db.query.appointments.findFirst({ where: and(eq(appointments.doctorId, own!.id), eq(appointments.status, "in-cabin")) });
    const slot = await db.query.slots.findFirst({ where: eq(slots.id, inCabin!.slotId) });
    const ok = await api.post("/admin/done").set(dh).send({ doctorId: own!.id, date: slot!.date });
    expect(ok.status).toBe(200);

    const someoneElse = (await db.select().from(doctors).where(eq(doctors.tenantId, tenantId))).find((d) => d.id !== own!.id)!;
    const denied = await api.post("/admin/next").set(dh).send({ doctorId: someoneElse.id, date: slot!.date });
    expect(denied.status).toBe(403);

    // patients have no password: phone + OTP only
    const pw = await api.post("/auth/login").send({ email: `${TEST_PATIENTS[0].phone.replace("+", "")}@otp.waitsmart.app`, password: PASSWORD });
    expect(pw.status).toBe(401);
  });
});
