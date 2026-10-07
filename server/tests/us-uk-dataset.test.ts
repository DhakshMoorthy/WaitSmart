import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { and, asc, eq } from "drizzle-orm";
import { api, createTestTenant, createTestUser, adminToken } from "./helpers.js";
import { db } from "../src/config/db.js";
import { env } from "../src/config/env.js";
import { appointments, clinics, doctorSchedules, doctors, users } from "../src/db/schema/index.js";
import { seedDemoClinics } from "../src/db/seeds/demo-clinics.js";
import { datasetIdFromEnv, loadDataset } from "../src/db/seeds/datasets.js";
import { seedTestData, testPatients, doctorLoginEmail } from "../src/db/seeds/test-data.js";

const ds = loadDataset("us-uk");

describe("US/UK test-environment dataset", () => {
  let tenantId: string;

  beforeAll(async () => {
    tenantId = (await createTestTenant({ slug: env.DEFAULT_TENANT_SLUG, subdomain: `usuk-${Date.now()}` })).id;
  });

  afterAll(() => {
    delete process.env.SEED_TEST_DATA;
    delete process.env.TEST_ACCOUNTS_PASSWORD;
    delete process.env.SEED_DATASET;
  });

  it("is selected with SEED_DATASET and rejects unknown names", () => {
    delete process.env.SEED_DATASET;
    expect(datasetIdFromEnv()).toBe("chennai"); // production default
    process.env.SEED_DATASET = "us-uk";
    expect(datasetIdFromEnv()).toBe("us-uk");
    process.env.SEED_DATASET = "mars";
    expect(() => datasetIdFromEnv()).toThrow(/Unknown SEED_DATASET/);
    delete process.env.SEED_DATASET;
  });

  it("describes well-known US and UK hospitals with fictional, gendered doctors", () => {
    const names = ds.clinics.map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "Mayo Clinic - Rochester",
        "Cleveland Clinic - Main Campus",
        "Massachusetts General Hospital",
        "Guy's Hospital - London",
        "Addenbrooke's Hospital - Cambridge",
        "Great Ormond Street Hospital - London",
      ]),
    );
    expect(ds.clinics).toHaveLength(6);

    // The doctors must stay labelled fictional so nobody mistakes them for real clinicians.
    const raw = JSON.parse(readFileSync(new URL("../src/db/seeds/data/us-uk-clinics.json", import.meta.url), "utf8"));
    expect(raw.clinics.every((c: { doctorsAreFictional?: boolean }) => c.doctorsAreFictional === true)).toBe(true);

    for (const c of ds.clinics) {
      expect(c.doctors.length).toBeGreaterThanOrEqual(3);
      expect(c.doctors.every((d) => d.gender === "male" || d.gender === "female")).toBe(true);
      expect(c.address.length).toBeGreaterThan(10);
    }
  });

  it("seeds 6 hospitals, 24 doctors with Mon-Fri schedules, and is idempotent", async () => {
    await seedDemoClinics("us-uk");
    await seedDemoClinics("us-uk");

    const cl = await db.select().from(clinics).where(eq(clinics.tenantId, tenantId));
    expect(cl).toHaveLength(6);
    const docs = await db.select().from(doctors).where(eq(doctors.tenantId, tenantId));
    expect(docs).toHaveLength(24);
    expect(docs.every((d) => d.gender === "male" || d.gender === "female")).toBe(true);

    const sched = await db.select().from(doctorSchedules).where(eq(doctorSchedules.tenantId, tenantId));
    expect(sched).toHaveLength(24 * 5);
    expect(sched.some((s) => s.dayOfWeek === 0 || s.dayOfWeek === 6)).toBe(false);
  });

  it("fills in a gender that was missing, without touching anything else", async () => {
    const d = await db.query.doctors.findFirst({ where: eq(doctors.name, "Dr. Marcus Reynolds") });
    await db.update(doctors).set({ gender: null }).where(eq(doctors.id, d!.id));
    await seedDemoClinics("us-uk");
    const after = await db.query.doctors.findFirst({ where: eq(doctors.id, d!.id) });
    expect(after?.gender).toBe("male");
    expect(after?.specialization).toBe("Cardiology");
  });

  it("builds test patients, doctor logins and a live queue for the US/UK hospitals", async () => {
    process.env.SEED_TEST_DATA = "true";
    process.env.TEST_ACCOUNTS_PASSWORD = "Demo#Pass99";
    await seedTestData("us-uk");

    const patients = testPatients(ds);
    expect(patients.map((p) => p.name)).toContain("James Carter");
    const mayoPatients = await db.select().from(users).where(eq(users.phone, patients[0].phone));
    expect(mayoPatients[0].name).toBe("James Carter");

    for (const c of ds.clinics) {
      const login = await db.query.users.findFirst({ where: eq(users.email, doctorLoginEmail(ds, c.key)) });
      expect(login?.role, c.key).toBe("doctor");
    }

    // Live queue on a Mon-Fri clinic, whatever day of the week the test runs on.
    const mayo = await db.query.clinics.findFirst({ where: and(eq(clinics.tenantId, tenantId), eq(clinics.name, "Mayo Clinic - Rochester")) });
    const doc = await db.query.doctors.findFirst({ where: eq(doctors.clinicId, mayo!.id), orderBy: asc(doctors.name) });
    const appts = await db.select().from(appointments).where(eq(appointments.doctorId, doc!.id));
    const by = (s: string) => appts.filter((a) => a.status === s).length;
    expect(by("in-cabin")).toBe(1);
    expect(by("done")).toBeGreaterThanOrEqual(3);
    expect(by("waiting")).toBeGreaterThanOrEqual(7);
    expect(appts.every((a) => patients.some((p) => p.name === a.patientName))).toBe(true);
  });

  it("the API returns each doctor's gender and validates it", async () => {
    const admin = await createTestUser(tenantId, "admin", { email: `usuk-admin-${Date.now()}@test.com` });
    const h = { Authorization: `Bearer ${adminToken(admin.id, tenantId)}` };

    const list = await api.get("/doctors").set(h);
    expect(list.status).toBe(200);
    const genders = new Set(list.body.data.map((d: { gender: string | null }) => d.gender));
    expect(genders).toEqual(new Set(["male", "female"]));

    const doc = list.body.data[0];
    const ok = await api.patch(`/doctors/${doc.id}`).set(h).send({ gender: "female" });
    expect(ok.status).toBe(200);
    expect(ok.body.data.gender).toBe("female");

    const bad = await api.patch(`/doctors/${doc.id}`).set(h).send({ gender: "robot" });
    expect(bad.status).toBe(400);
  });
});
