import { describe, it, expect, beforeAll } from "vitest";
import {
  api,
  createTestTenant,
  createTestUser,
  createTestClinic,
  createTestDoctor,
  patientToken,
} from "./helpers.js";

describe("Patient Module", () => {
  let tenantId: string;
  let patientUserId: string;
  let token: string;
  let doctorId: string;

  beforeAll(async () => {
    const tenant = await createTestTenant();
    tenantId = tenant.id;
    const patient = await createTestUser(tenantId, "patient", { name: "Test Patient" });
    patientUserId = patient.id;
    token = patientToken(patientUserId, tenantId);
    const clinic = await createTestClinic(tenantId);
    const doctor = await createTestDoctor(tenantId, clinic.id);
    doctorId = doctor.id;
  });

  describe("GET /patients/profile", () => {
    it("should return current user profile", async () => {
      const res = await api
        .get("/patients/profile")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(patientUserId);
      expect(res.body.data.name).toBe("Test Patient");
    });
  });

  describe("PATCH /patients/profile", () => {
    it("should update profile fields", async () => {
      const res = await api
        .patch("/patients/profile")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Updated Patient" });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Updated Patient");
    });
  });

  describe("GET /patients/history", () => {
    it("should return empty history initially", async () => {
      const res = await api
        .get("/patients/history")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe("Favorites", () => {
    it("should add a doctor to favorites", async () => {
      const res = await api
        .post("/patients/favorites")
        .set("Authorization", `Bearer ${token}`)
        .send({ doctorId });

      expect(res.status).toBe(201);
      expect(res.body.data.doctorId).toBe(doctorId);
    });

    it("should list favorites", async () => {
      const res = await api
        .get("/patients/favorites")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe("Family Members", () => {
    it("should add a family member", async () => {
      const res = await api
        .post("/patients/family")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Family Member",
          relationship: "spouse",
          phone: "+919876543299",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe("Family Member");
    });

    it("should list family members", async () => {
      const res = await api
        .get("/patients/family")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });
});
