import crypto from "crypto";
import { eq } from "drizzle-orm";
import { redis } from "../../config/redis.js";
import { db } from "../../config/db.js";
import { env } from "../../config/env.js";
import { users, tenants, doctors } from "../../db/schema/index.js";
import { AppError } from "../../types/index.js";
import { issueTokens } from "./auth.tokens.js";
import { sendSms } from "../../services/notifications/sms.js";

const OTP_TTL_SECONDS = 300; // 5 minutes
const OTP_PREFIX = "otp:";
const OTP_ATTEMPTS_PREFIX = "otp_attempts:";
const OTP_SEND_PREFIX = "otp_send:";
const MAX_VERIFY_ATTEMPTS = 5; // wrong guesses before the code is burned
const MAX_SENDS_PER_HOUR = 5; // OTP requests per phone per hour
const DEFAULT_TENANT_SLUG = "apollo-clinic";

function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** Resolve the default clinic tenant for new OTP patients (seeded Apollo Clinic). */
async function resolveDefaultTenantId(): Promise<string | null> {
  const bySlug = await db.query.tenants.findFirst({
    where: eq(tenants.slug, DEFAULT_TENANT_SLUG),
  });
  if (bySlug) return bySlug.id;

  const any = await db.query.tenants.findFirst();
  return any?.id ?? null;
}

export async function sendOtp(phone: string) {
  const sendKey = `${OTP_SEND_PREFIX}${phone}`;
  const sends = await redis.incr(sendKey);
  if (sends === 1) await redis.expire(sendKey, 3600);
  if (sends > MAX_SENDS_PER_HOUR) {
    throw new AppError(429, "Too many OTP requests, try again later", "OTP_RATE_LIMITED");
  }

  const otp = generateOtp();
  const key = `${OTP_PREFIX}${phone}`;

  await redis.set(key, otp, { EX: OTP_TTL_SECONDS });
  await redis.del(`${OTP_ATTEMPTS_PREFIX}${phone}`);

  const smsConfigured = !!(env.SMS_PROVIDER && env.SMS_API_KEY && env.SMS_SENDER_ID);

  // OTP is already stored — don't hold the HTTP response on SMS provider latency.
  void sendSms({
    to: phone,
    message: `Your WaitSmart OTP is: ${otp}. Valid for 5 minutes.`,
  });

  // Never echo the code back in production — that would let anyone log in as any phone.
  const exposeDevOtp = env.NODE_ENV !== "production" && !smsConfigured;
  return {
    message: "OTP sent successfully",
    expiresInSeconds: OTP_TTL_SECONDS,
    ...(exposeDevOtp ? { devOtp: otp } : {}),
  };
}

export async function verifyAndLogin(phone: string, otp: string) {
  const key = `${OTP_PREFIX}${phone}`;
  const attemptsKey = `${OTP_ATTEMPTS_PREFIX}${phone}`;
  const stored = await redis.get(key);

  if (!stored) {
    throw new AppError(400, "OTP expired or not found", "OTP_EXPIRED");
  }
  if (!safeEqual(stored, otp)) {
    const attempts = await redis.incr(attemptsKey);
    if (attempts === 1) await redis.expire(attemptsKey, OTP_TTL_SECONDS);
    if (attempts >= MAX_VERIFY_ATTEMPTS) {
      await redis.del([key, attemptsKey]);
      throw new AppError(429, "Too many wrong attempts, request a new OTP", "OTP_LOCKED");
    }
    throw new AppError(400, "Invalid OTP", "INVALID_OTP");
  }

  // Consume OTP
  await redis.del([key, attemptsKey]);

  // Find or create user by phone
  let user = await db.query.users.findFirst({
    where: eq(users.phone, phone),
  });

  if (!user) {
    const tenantId = await resolveDefaultTenantId();
    if (!tenantId) {
      throw new AppError(
        503,
        "No clinic is configured yet. Run database seed first.",
        "NO_TENANT",
      );
    }

    const placeholderHash = crypto.randomBytes(32).toString("hex");
    const [newUser] = await db
      .insert(users)
      .values({
        name: `Patient ${phone.slice(-4)}`,
        email: `${phone.replace(/\+/g, "")}@otp.waitsmart.app`,
        phone,
        passwordHash: placeholderHash,
        role: "patient",
        tenantId,
      })
      .returning();
    user = newUser;
  } else if (!user.tenantId && user.role === "patient") {
    // Backfill tenant for patients created before default-tenant assignment
    const tenantId = await resolveDefaultTenantId();
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
