import { describe, it, expect, beforeAll } from "vitest";
import { api, createTestTenant, createTestUser, superadminToken, adminToken } from "./helpers.js";

describe("Tenant Module", () => {
  let saToken: string;
  let saUserId: string;

  beforeAll(async () => {
    const user = await createTestUser(null, "superadmin");
    saUserId = user.id;
    saToken = superadminToken(user.id);
  });

  describe("POST /tenants", () => {
    it("should create a tenant as superadmin", async () => {
      const res = await api
        .post("/tenants")
        .set("Authorization", `Bearer ${saToken}`)
        .send({
          name: "New Tenant",
          slug: `tenant-${Date.now()}`,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body.name).toBe("New Tenant");
      expect(res.body.isActive).toBe(true);
    });

    it("should reject duplicate slug", async () => {
      const slug = `dup-slug-${Date.now()}`;
      await api
        .post("/tenants")
        .set("Authorization", `Bearer ${saToken}`)
        .send({ name: "T1", slug });

      const res = await api
        .post("/tenants")
        .set("Authorization", `Bearer ${saToken}`)
        .send({ name: "T2", slug });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("SLUG_TAKEN");
    });

    it("should reject non-superadmin", async () => {
      const tenant = await createTestTenant();
      const adminUser = await createTestUser(tenant.id, "admin");
      const token = adminToken(adminUser.id, tenant.id);

      const res = await api
        .post("/tenants")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Forbidden", slug: "forbidden" });

      expect(res.status).toBe(403);
    });

    it("should reject unauthenticated request", async () => {
      const res = await api
        .post("/tenants")
        .send({ name: "No Auth", slug: "no-auth" });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /tenants", () => {
    it("should list all tenants", async () => {
      const res = await api
        .get("/tenants")
        .set("Authorization", `Bearer ${saToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("GET /tenants/:id", () => {
    it("should get a single tenant", async () => {
      const tenant = await createTestTenant();

      const res = await api
        .get(`/tenants/${tenant.id}`)
        .set("Authorization", `Bearer ${saToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(tenant.id);
    });

    it("should 404 for non-existent tenant", async () => {
      const res = await api
        .get("/tenants/00000000-0000-0000-0000-000000000099")
        .set("Authorization", `Bearer ${saToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /tenants/:id", () => {
    it("should update a tenant", async () => {
      const tenant = await createTestTenant();

      const res = await api
        .patch(`/tenants/${tenant.id}`)
        .set("Authorization", `Bearer ${saToken}`)
        .send({ name: "Updated Name" });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Updated Name");
    });
  });

  describe("POST /tenants/:id/deactivate", () => {
    it("should deactivate a tenant", async () => {
      const tenant = await createTestTenant();

      const res = await api
        .post(`/tenants/${tenant.id}/deactivate`)
        .set("Authorization", `Bearer ${saToken}`);

      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(false);
    });
  });
});
