import crypto from "crypto";
import { eq } from "drizzle-orm";
import { redis } from "../../config/redis.js";
import { db } from "../../config/db.js";
import { users, tenants, doctors } from "../../db/schema/index.js";
import { AppError } from "../../types/index.js";
import { signAccessToken, signRefreshToken } from "../../utils/jwt.js";
import { sendSms } from "../../services/notifications/sms.js";
import { logger } from "../../utils/logger.js";

const OTP_TTL_SECONDS = 300; // 5 minutes
const OTP_PREFIX = "otp:";
const DEFAULT_TENANT_SLUG = "apollo-clinic";

function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
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
  const otp = generateOtp();
  const key = `${OTP_PREFIX}${phone}`;

  await redis.set(key, otp, { EX: OTP_TTL_SECONDS });
  logger.info(`[OTP] Generated for ${phone}: ${otp}`);

  // OTP is already stored — don't hold the HTTP response on SMS provider latency.
  void sendSms({
    to: phone,
    message: `Your WaitSmart OTP is: ${otp}. Valid for 5 minutes.`,
  });

  // Return OTP in response when no SMS provider is configured (OTP can't reach user otherwise)
  const smsConfigured = !!(process.env.SMS_PROVIDER && process.env.SMS_API_KEY);
  return {
    message: "OTP sent successfully",
    expiresInSeconds: OTP_TTL_SECONDS,
    ...(!smsConfigured ? { devOtp: otp } : {}),
  };
}

export async function verifyAndLogin(phone: string, otp: string) {
  const key = `${OTP_PREFIX}${phone}`;
  const stored = await redis.get(key);

  if (!stored) {
    throw new AppError(400, "OTP expired or not found", "OTP_EXPIRED");
  }
  if (stored !== otp) {
    throw new AppError(400, "Invalid OTP", "INVALID_OTP");
  }

  // Consume OTP
  await redis.del(key);

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

  const payload = {
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
    email: user.email,
  };

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
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}
