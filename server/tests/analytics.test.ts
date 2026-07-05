import { describe, it, expect, beforeAll } from "vitest";
import { api, createTestTenant, createTestUser, adminToken, patientToken } from "./helpers.js";

describe("Analytics Module", () => {
  let tenantId: string;
  let token: string;

  beforeAll(async () => {
    const tenant = await createTestTenant();
    tenantId = tenant.id;
    const user = await createTestUser(tenantId, "admin");
    token = adminToken(user.id, tenantId);
  });

  describe("GET /analytics/daily", () => {
    it("should return daily stats for admin", async () => {
      const res = await api
        .get("/analytics/daily")
        .query({ startDate: "2026-07-01", endDate: "2026-07-04" })
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should reject non-admin", async () => {
      const patient = await createTestUser(tenantId, "patient");
      const pToken = patientToken(patient.id, tenantId);

      const res = await api
        .get("/analytics/daily")
        .query({ startDate: "2026-07-01", endDate: "2026-07-04" })
        .set("Authorization", `Bearer ${pToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe("GET /analytics/wait-times", () => {
    it("should return wait time stats", async () => {
      const res = await api
        .get("/analytics/wait-times")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("avgWaitMinutes");
      expect(typeof res.body.data.avgWaitMinutes).toBe("number");
    });
  });

  describe("GET /analytics/no-show-rate", () => {
    it("should return no-show rate", async () => {
      const res = await api
        .get("/analytics/no-show-rate")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("total");
      expect(res.body.data).toHaveProperty("noShows");
      expect(res.body.data).toHaveProperty("ratePercent");
    });
  });

  describe("GET /analytics/revenue", () => {
    it("should return revenue stats", async () => {
      const res = await api
        .get("/analytics/revenue")
        .query({ startDate: "2026-07-01", endDate: "2026-07-04" })
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("totalPaise");
      expect(res.body.data).toHaveProperty("totalRupees");
      expect(res.body.data).toHaveProperty("paymentCount");
    });
  });
});
