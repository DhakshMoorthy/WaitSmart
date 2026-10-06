import { describe, it, expect, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { api, createTestTenant, createTestUser, patientToken, nextWeekday } from "./helpers.js";
import { db } from "../src/config/db.js";
import { env } from "../src/config/env.js";
import { clinics, doctors, doctorSchedules } from "../src/db/schema/index.js";
import { seedChennaiClinics } from "../src/db/seeds/chennai-clinics.js";

describe("Chennai clinics seed", () => {
  let tenantId: string;
  let token: string;

  beforeAll(async () => {
    const tenant = await createTestTenant({ slug: env.DEFAULT_TENANT_SLUG, subdomain: `seed-${Date.now()}` });
    tenantId = tenant.id;
    const patient = await createTestUser(tenantId, "patient", { email: `seed-patient-${Date.now()}@test.com` });
    token = patientToken(patient.id, tenantId);
    await seedChennaiClinics();
  });

  it("creates 5 clinics with doctors and schedules", async () => {
    const cl = await db.select().from(clinics).where(eq(clinics.tenantId, tenantId));
    expect(cl).toHaveLength(5);
    expect(cl.map((c) => c.name)).toContain("Apollo Clinic - Velachery");

    const docs = await db.select().from(doctors).where(eq(doctors.tenantId, tenantId));
    expect(docs.length).toBeGreaterThanOrEqual(15);
    expect(docs.every((d) => d.experienceYears > 0 && d.specialization.length > 0)).toBe(true);

    const sched = await db.select().from(doctorSchedules).where(eq(doctorSchedules.tenantId, tenantId));
    expect(sched).toHaveLength(docs.length * 6); // Mon-Sat each
  });

  it("is idempotent: running it again adds nothing", async () => {
    const before = (await db.select().from(doctors).where(eq(doctors.tenantId, tenantId))).length;
    await seedChennaiClinics();
    await seedChennaiClinics();
    const after = (await db.select().from(doctors).where(eq(doctors.tenantId, tenantId))).length;
    const clinicCount = (await db.select().from(clinics).where(eq(clinics.tenantId, tenantId))).length;
    expect(after).toBe(before);
    expect(clinicCount).toBe(5);
  });

  it("a patient can list the clinics, see doctors, find slots and book a token", async () => {
    const h = { Authorization: `Bearer ${token}` };
    const list = await api.get("/clinics").set(h);
    expect(list.body.data).toHaveLength(5);

    const clinic = list.body.data.find((c: { name: string }) => c.name === "Apollo Clinic - Velachery");
    const docs = await api.get("/doctors").query({ clinicId: clinic.id }).set(h);
    expect(docs.body.data).toHaveLength(4);

    const date = nextWeekday(1);
    const avail = await api.get("/avail").query({ doctorId: docs.body.data[0].id, date }).set(h);
    expect(avail.body.data.slots).toHaveLength(16); // 10:00-18:00 in 30 min slots

    const book = await api.post("/book").set(h).send({
      clinicId: clinic.id,
      doctorId: docs.body.data[0].id,
      slotId: avail.body.data.slots[0].id,
      patientName: "Demo Patient",
    });
    expect(book.status).toBe(201);
    expect(book.body.data.tokenNumber).toBe(1);
  });
});
