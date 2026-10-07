import crypto from "crypto";
import { and, eq, or } from "drizzle-orm";
import { redis, redisKey } from "../../config/redis.js";
import { db } from "../../config/db.js";
import { env } from "../../config/env.js";
import { users, tenants, doctors } from "../../db/schema/index.js";
import { AppError } from "../../types/index.js";
import { issueTokens } from "./auth.tokens.js";
import { sendSms, isSmsConfigured } from "../../services/notifications/sms.js";

const OTP_TTL_SECONDS = 300; // 5 minutes
const otpKey = (phone: string) => redisKey(`otp:${phone}`);
const attemptsKey = (phone: string) => redisKey(`otp_attempts:${phone}`);
const sendKey = (phone: string) => redisKey(`otp_send:${phone}`);
const MAX_VERIFY_ATTEMPTS = 5; // wrong guesses before the code is burned
const MAX_SENDS_PER_HOUR = 5; // OTP requests per phone per hour

function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/**
 * Which clinic a NEW phone-login patient joins:
 *  - the clinic the client names (slug or subdomain), if it exists and is active
 *  - otherwise the configured DEFAULT_TENANT_SLUG
 * There is deliberately no "first tenant in the table" fallback: that silently put patients
 * into whichever clinic happened to be created first.
 */
async function resolveTenantId(tenantSlug?: string): Promise<string | null> {
  const wanted = tenantSlug ?? env.DEFAULT_TENANT_SLUG;
  const tenant = await db.query.tenants.findFirst({
    where: and(eq(tenants.isActive, true), or(eq(tenants.slug, wanted), eq(tenants.subdomain, wanted))),
  });
  if (tenant) return tenant.id;
  if (tenantSlug) throw new AppError(400, "Unknown clinic", "INVALID_TENANT");
  return null;
}

/**
 * "Dev OTP" mode: the API returns the code in the response and the UI shows it, so no SMS is
 * needed. It is on automatically outside production when no SMS provider is configured, and in
 * production ONLY when EXPOSE_DEV_OTP=true is set deliberately (development stage).
 *
 * Because anyone can read the code in this mode, phone login must never reach privileged
 * accounts: see the patients-only check in verifyAndLogin.
 */
export function isDevOtpMode(): boolean {
  if (env.EXPOSE_DEV_OTP) return true;
  return env.NODE_ENV !== "production" && !isSmsConfigured();
}

export async function sendOtp(phone: string) {
  const sends = await redis.incr(sendKey(phone));
  if (sends === 1) await redis.expire(sendKey(phone), 3600);
  if (sends > MAX_SENDS_PER_HOUR) {
    throw new AppError(429, "Too many OTP requests, try again later", "OTP_RATE_LIMITED");
  }

  const otp = generateOtp();
  await redis.set(otpKey(phone), otp, { EX: OTP_TTL_SECONDS });
  await redis.del(attemptsKey(phone));

  // OTP is already stored — don't hold the HTTP response on SMS provider latency.
  void sendSms({
    to: phone,
    message: `Your WaitSmart OTP is: ${otp}. Valid for 5 minutes.`,
    otp,
  });

  return {
    message: "OTP sent successfully",
    expiresInSeconds: OTP_TTL_SECONDS,
    ...(isDevOtpMode() ? { devOtp: otp } : {}),
  };
}

export async function verifyAndLogin(phone: string, otp: string, tenantSlug?: string) {
  const key = otpKey(phone);
  const attKey = attemptsKey(phone);
  const stored = await redis.get(key);

  if (!stored) {
    throw new AppError(400, "OTP expired or not found", "OTP_EXPIRED");
  }
  if (!safeEqual(stored, otp)) {
    const attempts = await redis.incr(attKey);
    if (attempts === 1) await redis.expire(attKey, OTP_TTL_SECONDS);
    if (attempts >= MAX_VERIFY_ATTEMPTS) {
      await redis.del([key, attKey]);
      throw new AppError(429, "Too many wrong attempts, request a new OTP", "OTP_LOCKED");
    }
    throw new AppError(400, "Invalid OTP", "INVALID_OTP");
  }

  // Consume OTP
  await redis.del([key, attKey]);

  // A patient identity belongs to ONE clinic group (tenant): the same phone number is a separate patient
  // in each tenant. That keeps environments that share a database (prod and test) from leaking into each other.
  const targetTenantId = await resolveTenantId(tenantSlug);
  const matches = await db.select().from(users).where(eq(users.phone, phone));
  let user =
    matches.find((u) => u.role === "patient" && !!u.tenantId && u.tenantId === targetTenantId) ??
    matches.find((u) => u.role !== "patient") ?? // staff / superadmin keep working by phone (when not in dev-OTP mode)
    matches.find((u) => u.role === "patient" && !u.tenantId); // legacy patient without a clinic: backfilled below

  // With the code visible to the caller, OTP must not be a way into staff/superadmin accounts
  // (e.g. the seeded superadmin has a known phone number). Staff log in with email + password.
  if (user && user.role !== "patient" && isDevOtpMode()) {
    throw new AppError(403, "Staff accounts must sign in with email and password", "OTP_PATIENTS_ONLY");
  }

  if (!user) {
    const tenantId = targetTenantId;
    if (!tenantId) {
      throw new AppError(
        503,
        "No clinic is configured yet. Run database seed first.",
        "NO_TENANT",
      );
    }

    const placeholderHash = crypto.randomBytes(32).toString("hex");
    // users.email is not unique, but keep OTP patients' emails distinct across tenants anyway.
    const digits = phone.replace(/\+/g, "");
    const baseEmail = `${digits}@otp.waitsmart.app`;
    const emailTaken = await db.query.users.findFirst({ where: eq(users.email, baseEmail) });
    const [newUser] = await db
      .insert(users)
      .values({
        name: `Patient ${phone.slice(-4)}`,
        email: emailTaken ? `${digits}.${tenantId.slice(0, 8)}@otp.waitsmart.app` : baseEmail,
        phone,
        passwordHash: placeholderHash,
        role: "patient",
        tenantId,
      })
      .returning();
    user = newUser;
  } else if (!user.tenantId && user.role === "patient") {
    // Backfill tenant for patients created before default-tenant assignment
    const tenantId = targetTenantId;
    if (tenantId) {
      const [updated] = await db
        .update(users)
        .set({ tenantId, updatedAt: new Date() })
        .where(eq(users.id, user.id))
        .returning();
      user = updated;
    }
  }

  if (!user.tenantId && user.role !== "superadmin") {
    throw new AppError(
      403,
      "No clinic associated with this account. Contact support.",
      "NO_TENANT",
    );
  }

  let doctorId: string | null = null;
  if (user.role === "doctor") {
    const doctor = await db.query.doctors.findFirst({
      where: eq(doctors.userId, user.id),
    });
    doctorId = doctor?.id ?? null;
  }

  const tokens = await issueTokens(user);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      tenantId: user.tenantId,
      doctorId,
    },
    ...tokens,
  };
}
