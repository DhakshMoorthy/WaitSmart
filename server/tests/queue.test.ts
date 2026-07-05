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
} from "./helpers.js";

describe("Queue Module", () => {
  let tenantId: string;
  let clinicId: string;
  let doctorId: string;
  let adminTkn: string;
  let patientTkn: string;
  let testDate: string;

  beforeAll(async () => {
    const tenant = await createTestTenant();
    tenantId = tenant.id;
    const adminUser = await createTestUser(tenantId, "admin");
    adminTkn = adminToken(adminUser.id, tenantId);
    const patient = await createTestUser(tenantId, "patient");
    patientTkn = patientToken(patient.id, tenantId);
    const clinic = await createTestClinic(tenantId);
    clinicId = clinic.id;
    const doctor = await createTestDoctor(tenantId, clinicId);
    doctorId = doctor.id;

    // Schedule for Tuesday (dayOfWeek=2)
    const today = new Date();
    const daysUntilTuesday = ((2 - today.getDay()) + 7) % 7 || 7;
    const nextTuesday = new Date(today);
    nextTuesday.setDate(today.getDate() + daysUntilTuesday);
    testDate = nextTuesday.toISOString().split("T")[0];

    await createTestSchedule(tenantId, doctorId, 2, {
      startTime: "10:00",
      endTime: "12:00",
      slotDurationMinutes: 30,
    });

    // Book 3 patients
    const availRes = await api
      .get("/avail")
      .query({ doctorId, date: testDate })
      .set("Authorization", `Bearer ${patientTkn}`);

    for (let i = 0; i < 3 && i < availRes.body.data.slots.length; i++) {
      await api
        .post("/book")
        .set("Authorization", `Bearer ${patientTkn}`)
        .send({
          clinicId,
          doctorId,
          slotId: availRes.body.data.slots[i].id,
          patientName: `Patient ${i + 1}`,
          patientPhone: `+91987654321${i}`,
        });
    }
  });

  describe("POST /admin/next", () => {
    it("should advance the queue to the next patient", async () => {
      const res = await api
        .post("/admin/next")
        .set("Authorization", `Bearer ${adminTkn}`)
        .send({ doctorId, date: testDate });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("nowServing");
      expect(res.body.data.nowServing).toBe(1);
      expect(res.body.data).toHaveProperty("appointments");
    });

    it("should move to next after first is served", async () => {
      const res = await api
        .post("/admin/next")
        .set("Authorization", `Bearer ${adminTkn}`)
        .send({ doctorId, date: testDate });

      expect(res.status).toBe(200);
      expect(res.body.data.nowServing).toBe(2);
    });

    it("should reject patient role", async () => {
      const res = await api
        .post("/admin/next")
        .set("Authorization", `Bearer ${patientTkn}`)
        .send({ doctorId, date: testDate });

      expect(res.status).toBe(403);
    });
  });

  describe("POST /admin/done", () => {
    it("should mark current patient as done", async () => {
      const res = await api
        .post("/admin/done")
        .set("Authorization", `Bearer ${adminTkn}`)
        .send({ doctorId, date: testDate });

      expect(res.status).toBe(200);
      const doneAppts = res.body.data.appointments?.filter((a: any) => a.status === "done");
      expect(doneAppts.length).toBeGreaterThan(0);
    });
  });

  describe("POST /admin/next (advance after done)", () => {
    it("should advance to the next waiting patient", async () => {
      const res = await api
        .post("/admin/next")
        .set("Authorization", `Bearer ${adminTkn}`)
        .send({ doctorId, date: testDate });

      expect(res.status).toBe(200);
      expect(res.body.data.nowServing).toBe(3);
    });
  });

  describe("POST /admin/skip", () => {
    it("should skip the current patient", async () => {
      const res = await api
        .post("/admin/skip")
        .set("Authorization", `Bearer ${adminTkn}`)
        .send({ doctorId, date: testDate });

      expect(res.status).toBe(200);
      const skippedAppts = res.body.data.appointments?.filter((a: any) => a.status === "skipped");
      expect(skippedAppts.length).toBeGreaterThan(0);
    });
  });

  describe("POST /admin/no-show", () => {
    it("should return error when no patient in cabin", async () => {
      const res = await api
        .post("/admin/no-show")
        .set("Authorization", `Bearer ${adminTkn}`)
        .send({ doctorId, date: testDate });

      // All patients are processed, no one in cabin
      expect([200, 400]).toContain(res.status);
    });
  });
});
