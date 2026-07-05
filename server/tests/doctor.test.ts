import { describe, it, expect, beforeAll } from "vitest";
import {
  api,
  createTestTenant,
  createTestUser,
  createTestClinic,
  createTestDoctor,
  adminToken,
} from "./helpers.js";

describe("Doctor Module", () => {
  let tenantId: string;
  let clinicId: string;
  let token: string;

  beforeAll(async () => {
    const tenant = await createTestTenant();
    tenantId = tenant.id;
    const user = await createTestUser(tenantId, "admin");
    token = adminToken(user.id, tenantId);
    const clinic = await createTestClinic(tenantId);
    clinicId = clinic.id;
  });

  describe("POST /doctors", () => {
    it("should create a doctor", async () => {
      const res = await api
        .post("/doctors")
        .set("Authorization", `Bearer ${token}`)
        .send({
          clinicId,
          name: "Dr. Smith",
          specialization: "Cardiology",
          experienceYears: 10,
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty("id");
      expect(res.body.data.name).toBe("Dr. Smith");
      expect(res.body.data.clinicId).toBe(clinicId);
    });

    it("should reject missing specialization", async () => {
      const res = await api
        .post("/doctors")
        .set("Authorization", `Bearer ${token}`)
        .send({ clinicId, name: "Dr. Nobody" });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /doctors", () => {
    it("should list doctors for the tenant", async () => {
      await createTestDoctor(tenantId, clinicId);

      const res = await api
        .get("/doctors")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe("GET /doctors/:id", () => {
    it("should get a single doctor", async () => {
      const doctor = await createTestDoctor(tenantId, clinicId);

      const res = await api
        .get(`/doctors/${doctor.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(doctor.id);
    });
  });

  describe("PATCH /doctors/:id", () => {
    it("should update a doctor", async () => {
      const doctor = await createTestDoctor(tenantId, clinicId);

      const res = await api
        .patch(`/doctors/${doctor.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ specialization: "Neurology" });

      expect(res.status).toBe(200);
      expect(res.body.data.specialization).toBe("Neurology");
    });
  });

  describe("DELETE /doctors/:id", () => {
    it("should delete a doctor", async () => {
      const doctor = await createTestDoctor(tenantId, clinicId);

      const res = await api
        .delete(`/doctors/${doctor.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(204);
    });
  });

  describe("Schedules", () => {
    it("should set and get schedules", async () => {
      const doctor = await createTestDoctor(tenantId, clinicId);

      const putRes = await api
        .put(`/doctors/${doctor.id}/schedules`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          schedules: [
            { dayOfWeek: 1, startTime: "09:00", endTime: "13:00", slotDurationMinutes: 15 },
            { dayOfWeek: 3, startTime: "14:00", endTime: "18:00", slotDurationMinutes: 20 },
          ],
        });

      expect(putRes.status).toBe(200);
      expect(putRes.body.data).toHaveLength(2);

      const getRes = await api
        .get(`/doctors/${doctor.id}/schedules`)
        .set("Authorization", `Bearer ${token}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data).toHaveLength(2);
    });
  });

  describe("Breaks", () => {
    it("should create and list breaks", async () => {
      const doctor = await createTestDoctor(tenantId, clinicId);

      const postRes = await api
        .post(`/doctors/${doctor.id}/breaks`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          startDate: "2026-08-01",
          endDate: "2026-08-05",
          reason: "Vacation",
        });

      expect(postRes.status).toBe(201);
      expect(postRes.body.data.reason).toBe("Vacation");

      const getRes = await api
        .get(`/doctors/${doctor.id}/breaks`)
        .set("Authorization", `Bearer ${token}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.length).toBeGreaterThan(0);
    });
  });
});
