import { describe, it, expect, beforeAll } from "vitest";
import { api, createTestTenant, createTestUser, createTestClinic, adminToken } from "./helpers.js";

describe("Clinic Module", () => {
  let tenantId: string;
  let token: string;

  beforeAll(async () => {
    const tenant = await createTestTenant();
    tenantId = tenant.id;
    const user = await createTestUser(tenantId, "admin");
    token = adminToken(user.id, tenantId);
  });

  describe("POST /clinics", () => {
    it("should create a clinic", async () => {
      const res = await api
        .post("/clinics")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Main Branch", address: "100 Main St" });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty("id");
      expect(res.body.data.name).toBe("Main Branch");
      expect(res.body.data.tenantId).toBe(tenantId);
    });

    it("should reject missing fields", async () => {
      const res = await api
        .post("/clinics")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "No Address" });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /clinics", () => {
    it("should list clinics for the tenant", async () => {
      await createTestClinic(tenantId);

      const res = await api
        .get("/clinics")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((c: any) => c.tenantId === tenantId)).toBe(true);
    });
  });

  describe("GET /clinics/:id", () => {
    it("should get a single clinic", async () => {
      const clinic = await createTestClinic(tenantId);

      const res = await api
        .get(`/clinics/${clinic.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(clinic.id);
    });

    it("should 404 for wrong tenant", async () => {
      const otherTenant = await createTestTenant();
      const clinic = await createTestClinic(otherTenant.id);

      const res = await api
        .get(`/clinics/${clinic.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /clinics/:id", () => {
    it("should update a clinic", async () => {
      const clinic = await createTestClinic(tenantId);

      const res = await api
        .patch(`/clinics/${clinic.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Updated Branch" });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Updated Branch");
    });
  });

  describe("DELETE /clinics/:id", () => {
    it("should delete a clinic", async () => {
      const clinic = await createTestClinic(tenantId);

      const res = await api
        .delete(`/clinics/${clinic.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(204);

      const getRes = await api
        .get(`/clinics/${clinic.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(getRes.status).toBe(404);
    });
  });
});
