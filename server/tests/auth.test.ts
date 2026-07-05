import { describe, it, expect, beforeAll } from "vitest";
import { api, createTestTenant, createTestUser } from "./helpers.js";

describe("Auth Module", () => {
  describe("POST /auth/register", () => {
    it("should register a new user", async () => {
      const res = await api.post("/auth/register").send({
        name: "New Patient",
        email: `register-${Date.now()}@test.com`,
        password: "Secure@123",
        phone: "+919876543210",
        role: "patient",
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("accessToken");
      expect(res.body).toHaveProperty("refreshToken");
      expect(res.body.user).toHaveProperty("id");
      expect(res.body.user.role).toBe("patient");
    });

    it("should reject duplicate email", async () => {
      const email = `dup-${Date.now()}@test.com`;
      await api.post("/auth/register").send({
        name: "User A",
        email,
        password: "Secure@123",
        role: "patient",
      });

      const res = await api.post("/auth/register").send({
        name: "User B",
        email,
        password: "Secure@123",
        role: "patient",
      });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("EMAIL_TAKEN");
    });

    it("should reject invalid input", async () => {
      const res = await api.post("/auth/register").send({
        name: "X",
        email: "not-an-email",
        password: "short",
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /auth/login", () => {
    const email = `login-${Date.now()}@test.com`;

    beforeAll(async () => {
      await api.post("/auth/register").send({
        name: "Login User",
        email,
        password: "Secure@123",
        role: "patient",
      });
    });

    it("should login with valid credentials", async () => {
      const res = await api.post("/auth/login").send({ email, password: "Secure@123" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("accessToken");
      expect(res.body).toHaveProperty("refreshToken");
      expect(res.body.user.email).toBe(email);
    });

    it("should reject wrong password", async () => {
      const res = await api.post("/auth/login").send({ email, password: "WrongPass1" });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("INVALID_CREDENTIALS");
    });

    it("should reject non-existent email", async () => {
      const res = await api.post("/auth/login").send({
        email: "ghost@test.com",
        password: "Secure@123",
      });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("INVALID_CREDENTIALS");
    });
  });

  describe("POST /auth/refresh", () => {
    it("should issue new tokens with valid refresh token", async () => {
      const regRes = await api.post("/auth/register").send({
        name: "Refresh User",
        email: `refresh-${Date.now()}@test.com`,
        password: "Secure@123",
        role: "patient",
      });

      const res = await api.post("/auth/refresh").send({
        refreshToken: regRes.body.refreshToken,
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("accessToken");
      expect(res.body).toHaveProperty("refreshToken");
    });

    it("should reject invalid refresh token", async () => {
      const res = await api.post("/auth/refresh").send({
        refreshToken: "invalid.token.value",
      });

      expect(res.status).toBe(401);
    });
  });

  describe("POST /auth/otp/send", () => {
    it("should accept a valid phone number", async () => {
      const res = await api.post("/auth/otp/send").send({
        phone: "+919876543211",
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("message");
    });

    it("should reject invalid phone format", async () => {
      const res = await api.post("/auth/otp/send").send({
        phone: "123",
      });

      expect(res.status).toBe(400);
    });
  });
});
