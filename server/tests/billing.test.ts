import { describe, it, expect, beforeAll } from "vitest";
import { api, createTestTenant, createTestUser, adminToken } from "./helpers.js";

describe("Billing Module", () => {
  let tenantId: string;
  let token: string;

  beforeAll(async () => {
    const tenant = await createTestTenant();
    tenantId = tenant.id;
    const user = await createTestUser(tenantId, "admin");
    token = adminToken(user.id, tenantId);
  });

  describe("GET /billing/plans", () => {
    it("should return available plans (no auth required)", async () => {
      const res = await api.get("/billing/plans");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(3);
      expect(res.body.data[0]).toHaveProperty("id");
      expect(res.body.data[0]).toHaveProperty("name");
      expect(res.body.data[0]).toHaveProperty("priceMonthly");
    });
  });

  describe("GET /billing/subscription", () => {
    it("should return null when no subscription exists", async () => {
      const res = await api
        .get("/billing/subscription")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
    });
  });

  describe("POST /billing/subscribe", () => {
    it("should reject invalid plan ID", async () => {
      const res = await api
        .post("/billing/subscribe")
        .set("Authorization", `Bearer ${token}`)
        .send({ planId: "invalid_plan" });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_PLAN");
    });
  });

  describe("POST /billing/webhooks/razorpay", () => {
    it("should process webhook without signature gracefully", async () => {
      const res = await api
        .post("/billing/webhooks/razorpay")
        .send({
          event: "subscription.activated",
          payload: { subscription: { entity: { id: "sub_test" } } },
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });

    it("should reject webhook with invalid signature", async () => {
      const res = await api
        .post("/billing/webhooks/razorpay")
        .set("x-razorpay-signature", "invalid_sig")
        .send({
          event: "subscription.activated",
          payload: { subscription: { entity: { id: "sub_test" } } },
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_SIGNATURE");
    });
  });
});
