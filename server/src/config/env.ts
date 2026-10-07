import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("noreply@waitsmart.app"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  // SMS (MSG91 / Twilio)
  SMS_PROVIDER: z.enum(["msg91", "twilio", ""]).optional(),
  SMS_API_KEY: z.string().optional(),
  SMS_SENDER_ID: z.string().optional(),
  SMS_TEMPLATE_ID: z.string().optional(),
  // Prepended to every Redis key. Lets several environments (prod, test) share one Redis safely.
  REDIS_KEY_PREFIX: z.string().default(""),
  // DEVELOPMENT ONLY: return the OTP in the API response (and show it in the UI) instead of
  // sending an SMS. Anyone can then log in as any patient phone number. Never enable with real patients.
  EXPOSE_DEV_OTP: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  // Clinic that new phone/OTP patients join when the client does not say which clinic.
  DEFAULT_TENANT_SLUG: z.string().default("apollo-clinic"),
  // Object storage (Oracle OCI / S3-compatible)
  STORAGE_PROVIDER: z.enum(["oci", "s3", ""]).optional(),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_REGION: z.string().optional(),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  STORAGE_ENDPOINT: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;

export const corsOrigins = env.CORS_ORIGINS.split(",").map((o) => o.trim());
