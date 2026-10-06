import { describe, it, expect, beforeAll } from "vitest";
import {
  api,
  createTestTenant,
  createTestUser,
  createTestClinic,
  createTestDoctor,
  createTestSchedule,
  adminToken,
  patientToken,
  superadminToken,
  nextWeekday,
} from "./helpers.js";
import { env } from "../src/config/env.js";

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

describe("Superadmin with no clinic configured", () => {
  it("answers 409 NO_TENANT (not a silent 403) when no default clinic exists and no header is sent", async () => {
    const res = await api.get("/doctors").set({ Authorization: `Bearer ${superadminToken()}` });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("NO_TENANT");
  });
});

describe("Superadmin on tenant-scoped routes (admin screen showed no doctors/bookings)", () => {
  const sa = { Authorization: `Bearer ${superadminToken()}` };
  let defaultTenantId: string;
  let defaultDoctorId: string;
  let defaultClinicId: string;
  let otherTenantId: string;
  let otherDoctorName: string;
  let date: string;
  let patientTkn: string;
  let slotId: string;

  beforeAll(async () => {
    const def = await createTestTenant({ slug: env.DEFAULT_TENANT_SLUG, subdomain: `def-${uniq()}` });
    defaultTenantId = def.id;
    defaultClinicId = (await createTestClinic(defaultTenantId)).id;
    defaultDoctorId = (await createTestDoctor(defaultTenantId, defaultClinicId, { name: "Dr Default" })).id;
    date = nextWeekday(1);
    await createTestSchedule(defaultTenantId, defaultDoctorId, 1, { startTime: "09:00", endTime: "11:00", slotDurationMinutes: 30 });

    const other = await createTestTenant({ slug: `other-${uniq()}`, subdomain: `o-${uniq()}` });
    otherTenantId = other.id;
    const oc = await createTestClinic(otherTenantId);
    otherDoctorName = "Dr Other";
    await createTestDoctor(otherTenantId, oc.id, { name: otherDoctorName });

    const patient = await createTestUser(defaultTenantId, "patient", { email: `p-${uniq()}@test.com` });
    patientTkn = patientToken(patient.id, defaultTenantId);
    const avail = await api.get("/avail").query({ doctorId: defaultDoctorId, date }).set("Authorization", `Bearer ${patientTkn}`);
    slotId = avail.body.data.slots[0].id;
  });

  it("defaults to the default clinic: lists its doctors and clinics", async () => {
    const docs = await api.get("/doctors").set(sa);
    expect(docs.status).toBe(200);
    expect(docs.body.data.map((d: { name: string }) => d.name)).toEqual(["Dr Default"]);

    const clinics = await api.get("/clinics").set(sa);
    expect(clinics.status).toBe(200);
    expect(clinics.body.data).toHaveLength(1);
  });

  it("sees a patient's booking with full details (the reported bug)", async () => {
    const book = await api
      .post("/book")
      .set("Authorization", `Bearer ${patientTkn}`)
      .send({ clinicId: defaultClinicId, doctorId: defaultDoctorId, slotId, patientName: "Booked Patient", symptoms: "cough" });
    expect(book.status).toBe(201);

    const avail = await api.get("/avail").query({ doctorId: defaultDoctorId, date }).set(sa);
    expect(avail.status).toBe(200);
    const booked = avail.body.data.slots.find((s: { id: string }) => s.id === slotId);
    expect(booked.appointment.patientName).toBe("Booked Patient");
    expect(booked.appointment.tokenNumber).toBe(1);

    // ...and can run the queue for that doctor
    const next = await api.post("/admin/next").set(sa).send({ doctorId: defaultDoctorId, date });
    expect(next.status).toBe(200);
    expect(next.body.data.nowServing).toBe(1);
  });

  it("x-tenant-id lets a superadmin switch clinic", async () => {
    const res = await api.get("/doctors").set({ ...sa, "x-tenant-id": otherTenantId });
    expect(res.status).toBe(200);
    expect(res.body.data.map((d: { name: string }) => d.name)).toEqual([otherDoctorName]);
  });

  it("rejects an unknown or malformed x-tenant-id", async () => {
    const unknown = await api.get("/doctors").set({ ...sa, "x-tenant-id": "00000000-0000-0000-0000-000000000099" });
    expect(unknown.status).toBe(404);
    expect(unknown.body.code).toBe("INVALID_TENANT");

    const bad = await api.get("/doctors").set({ ...sa, "x-tenant-id": "not-a-uuid" });
    expect(bad.status).toBe(400);
  });

  it("SECURITY: a clinic admin cannot hop to another clinic with x-tenant-id", async () => {
    const admin = await createTestUser(defaultTenantId, "admin", { email: `a-${uniq()}@test.com` });
    const res = await api
      .get("/doctors")
      .set({ Authorization: `Bearer ${adminToken(admin.id, defaultTenantId)}`, "x-tenant-id": otherTenantId });
    expect(res.status).toBe(200);
    expect(res.body.data.map((d: { name: string }) => d.name)).toEqual(["Dr Default"]);
  });

  it("SECURITY: a patient cannot use x-tenant-id either", async () => {
    const res = await api.get("/doctors").set({ Authorization: `Bearer ${patientTkn}`, "x-tenant-id": otherTenantId });
    expect(res.body.data.map((d: { name: string }) => d.name)).toEqual(["Dr Default"]);
  });
});
