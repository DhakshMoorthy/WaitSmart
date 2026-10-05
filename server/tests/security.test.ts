import { describe, it, expect } from "vitest";
import { api } from "./helpers.js";
import { redis } from "../src/config/redis.js";

describe("Security hardening", () => {
  describe("POST /auth/register role lock", () => {
    it.each(["superadmin", "admin", "doctor"])("ignores role=%s and creates a patient", async (role) => {
      const res = await api.post("/auth/register").send({
        name: "Attacker",
        email: `attacker-${role}-${Date.now()}@test.com`,
        password: "Secure@123",
        role,
      });

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe("patient");
    });

    it("issues a token that cannot reach superadmin routes", async () => {
      const reg = await api.post("/auth/register").send({
        name: "Attacker",
        email: `attacker-tenants-${Date.now()}@test.com`,
        password: "Secure@123",
        role: "superadmin",
      });
      const res = await api.get("/tenants").set("Authorization", `Bearer ${reg.body.accessToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe("OTP hardening", () => {
    it("burns the OTP after 5 wrong guesses", async () => {
      const phone = "+919876500001";
      await api.post("/auth/otp/send").send({ phone });
      const real = await redis.get(`otp:${phone}`);
      const wrong = real === "000000" ? "111111" : "000000";

      for (let i = 0; i < 4; i++) {
        const r = await api.post("/auth/otp/verify").send({ phone, otp: wrong });
        expect(r.body.code).toBe("INVALID_OTP");
      }
      const locked = await api.post("/auth/otp/verify").send({ phone, otp: wrong });
      expect(locked.status).toBe(429);
      expect(locked.body.code).toBe("OTP_LOCKED");

      // Correct code no longer works once locked
      const after = await api.post("/auth/otp/verify").send({ phone, otp: real! });
      expect(after.body.code).toBe("OTP_EXPIRED");
    });

    it("rate limits OTP sends per phone", async () => {
      const phone = "+919876500002";
      for (let i = 0; i < 5; i++) {
        expect((await api.post("/auth/otp/send").send({ phone })).status).toBe(200);
      }
      const res = await api.post("/auth/otp/send").send({ phone });
      expect(res.status).toBe(429);
      expect(res.body.code).toBe("OTP_RATE_LIMITED");
    });
  });
});
