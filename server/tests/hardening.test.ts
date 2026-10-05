import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { api, createTestTenant, createTestUser, patientToken } from "./helpers.js";
import { redis } from "../src/config/redis.js";
import { db } from "../src/config/db.js";
import { env } from "../src/config/env.js";
import { users } from "../src/db/schema/index.js";
import { sendSms } from "../src/services/notifications/sms.js";

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

describe("CORS allowlist (M2)", () => {
  it("allows an origin that is explicitly listed", async () => {
    const res = await api.get("/health").set("Origin", "http://localhost:3000");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });

  it.each([
    "https://evil.onrender.com",
    "https://attacker.vercel.app",
    "https://klinicals.com.evil.io",
  ])("refuses %s (no CORS headers, no 500)", async (origin) => {
    const res = await api.get("/health").set("Origin", origin);
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("File upload hardening (M3)", () => {
  let token: string;

  beforeAll(async () => {
    const tenant = await createTestTenant();
    const user = await createTestUser(tenant.id, "patient", { email: `file-${uniq()}@test.com` });
    token = patientToken(user.id, tenant.id);
  });

  const upload = (buf: Buffer, filename: string, contentType: string) =>
    api.post("/files/upload").set("Authorization", `Bearer ${token}`).attach("file", buf, { filename, contentType });

  it("rejects content that does not match the declared type", async () => {
    const res = await upload(PNG, "scan.pdf", "application/pdf");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_FILE_TYPE");
  });

  it("rejects a script disguised as an image", async () => {
    const res = await upload(Buffer.from("<script>alert(1)</script>"), "x.png", "image/png");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_FILE_TYPE");
  });

  it("returns 413 for oversized files", async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(10 * 1024 * 1024)]);
    const res = await upload(big, "big.png", "image/png");
    expect(res.status).toBe(413);
    expect(res.body.code).toBe("FILE_TOO_LARGE");
  });

  it("sanitises the stored filename and never reflects it raw in headers", async () => {
    const up = await upload(PNG, '../../etc/pa"ss\r\nX-Evil: 1.png', "image/png");
    expect(up.status).toBe(201);
    expect(up.body.data.filename).not.toMatch(/[\\/"\r\n]/);
    // Extension comes from the allowlist, not the client's filename.
    expect(up.body.data.storageKey).toMatch(/\.png$/);

    const get = await api.get(`/files/${up.body.data.id}`).set("Authorization", `Bearer ${token}`);
    expect(get.status).toBe(200);
    expect(get.headers["x-evil"]).toBeUndefined();
    expect(get.headers["x-content-type-options"]).toBe("nosniff");
  });
});

describe("OTP tenant assignment (M9)", () => {
  const otpFor = async (phone: string) => {
    await api.post("/auth/otp/send").send({ phone });
    return (await redis.get(`otp:${phone}`))!;
  };

  it("assigns a new patient to the clinic they name", async () => {
    const tenant = await createTestTenant({ slug: `clinic-${uniq()}` });
    const phone = "+919811100001";
    const res = await api.post("/auth/otp/verify").send({ phone, otp: await otpFor(phone), tenantSlug: tenant.slug });
    expect(res.status).toBe(200);
    expect(res.body.user.tenantId).toBe(tenant.id);
  });

  it("rejects an unknown clinic", async () => {
    const phone = "+919811100002";
    const res = await api.post("/auth/otp/verify").send({ phone, otp: await otpFor(phone), tenantSlug: "no-such-clinic" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_TENANT");
  });

  it("does not fall back to an arbitrary tenant when the default clinic is missing", async () => {
    const phone = "+919811100003";
    const res = await api.post("/auth/otp/verify").send({ phone, otp: await otpFor(phone) });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("NO_TENANT");
    expect(await db.query.users.findFirst({ where: eq(users.phone, phone) })).toBeUndefined();
  });

  it("uses DEFAULT_TENANT_SLUG when no clinic is named", async () => {
    const def = await createTestTenant({ slug: env.DEFAULT_TENANT_SLUG, subdomain: `def-${uniq()}` });
    const phone = "+919811100004";
    const res = await api.post("/auth/otp/verify").send({ phone, otp: await otpFor(phone) });
    expect(res.status).toBe(200);
    expect(res.body.user.tenantId).toBe(def.id);
  });
});

describe("Dev OTP mode (development stage)", () => {
  const original = { ...env };
  afterEach(() => {
    Object.assign(env, original);
  });

  it("production without the flag never returns the OTP", async () => {
    Object.assign(env, { NODE_ENV: "production", EXPOSE_DEV_OTP: false });
    const res = await api.post("/auth/otp/send").send({ phone: "+919811100020" });
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("devOtp");
  });

  it("production WITH EXPOSE_DEV_OTP=true returns the OTP so it can be typed in", async () => {
    Object.assign(env, { NODE_ENV: "production", EXPOSE_DEV_OTP: true });
    const res = await api.post("/auth/otp/send").send({ phone: "+919811100021" });
    expect(res.status).toBe(200);
    expect(res.body.devOtp).toMatch(/^\d{6}$/);
  });

  it("patients can log in with the visible OTP", async () => {
    Object.assign(env, { NODE_ENV: "production", EXPOSE_DEV_OTP: true });
    const tenant = await createTestTenant({ slug: `dev-otp-${uniq()}` });
    const phone = "+919811100022";
    const send = await api.post("/auth/otp/send").send({ phone });
    const res = await api.post("/auth/otp/verify").send({ phone, otp: send.body.devOtp, tenantSlug: tenant.slug });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("patient");
  });

  it.each(["superadmin", "admin", "doctor"] as const)(
    "a visible OTP can NOT be used to log in as %s",
    async (role) => {
      Object.assign(env, { NODE_ENV: "production", EXPOSE_DEV_OTP: true });
      const tenant = await createTestTenant({ slug: `dev-otp-staff-${uniq()}` });
      const phone = `+9198111${String(Math.floor(Math.random() * 90000) + 10000)}`;
      await createTestUser(role === "superadmin" ? null : tenant.id, role, {
        email: `staff-${role}-${uniq()}@test.com`,
        phone,
      });
      const send = await api.post("/auth/otp/send").send({ phone });
      const res = await api.post("/auth/otp/verify").send({ phone, otp: send.body.devOtp });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("OTP_PATIENTS_ONLY");
    },
  );
});

describe("SMS providers (M8)", () => {
  const original = { ...env };
  afterEach(() => {
    Object.assign(env, original);
    vi.unstubAllGlobals();
  });

  it("MSG91: sends the OTP to the template API, with the authkey in a header (not the URL)", async () => {
    Object.assign(env, { SMS_PROVIDER: "msg91", SMS_API_KEY: "SECRET-AUTHKEY", SMS_TEMPLATE_ID: "tpl123", SMS_SENDER_ID: "WAITSM" });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ type: "success" }) });
    vi.stubGlobal("fetch", fetchMock);

    const ok = await sendSms({ to: "+919876543210", message: "ignored", otp: "123456" });
    expect(ok).toBe(true);

    const [url, init] = fetchMock.mock.calls[0];
    const u = new URL(String(url));
    expect(u.origin + u.pathname).toBe("https://control.msg91.com/api/v5/otp");
    expect(u.searchParams.get("template_id")).toBe("tpl123");
    expect(u.searchParams.get("mobile")).toBe("919876543210");
    expect(u.searchParams.get("otp")).toBe("123456");
    expect(String(url)).not.toContain("SECRET-AUTHKEY");
    expect(init.headers.authkey).toBe("SECRET-AUTHKEY");
  });

  it("MSG91: reports failure when the provider rejects the request", async () => {
    Object.assign(env, { SMS_PROVIDER: "msg91", SMS_API_KEY: "k", SMS_TEMPLATE_ID: "t" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ type: "error", message: "bad" }) }));
    expect(await sendSms({ to: "+919876543210", message: "x", otp: "123456" })).toBe(false);
  });

  it("an unconfigured provider sends nothing", async () => {
    Object.assign(env, { SMS_PROVIDER: undefined, SMS_API_KEY: undefined });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendSms({ to: "+919876543210", message: "x", otp: "123456" })).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no devOtp is returned once SMS is configured", async () => {
    Object.assign(env, { SMS_PROVIDER: "msg91", SMS_API_KEY: "k", SMS_TEMPLATE_ID: "t" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ type: "success" }) }));
    const res = await api.post("/auth/otp/send").send({ phone: "+919811100010" });
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("devOtp");
  });
});
