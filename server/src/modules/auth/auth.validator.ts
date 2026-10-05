import { z } from "zod";
import { registerSchema, loginSchema, phoneSchema } from "@waitsmart/shared";

// Public self-registration can only ever create patients: `role` is dropped by Zod's
// default key stripping. Staff accounts are provisioned by admins / seeds, never here.
export const registerBody = registerSchema.omit({ role: true });
export const loginBody = loginSchema;

export const refreshBody = z.object({
  refreshToken: z.string().min(1),
});

export const otpSendBody = z.object({
  phone: phoneSchema,
});

export const otpVerifyBody = z.object({
  phone: phoneSchema,
  otp: z.string().length(6),
  // Which clinic a brand-new patient joins (slug or subdomain). Optional: falls back to the default clinic.
  tenantSlug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

export type RegisterInput = z.infer<typeof registerBody>;
export type LoginInput = z.infer<typeof loginBody>;
export type RefreshInput = z.infer<typeof refreshBody>;
export type OtpSendInput = z.infer<typeof otpSendBody>;
export type OtpVerifyInput = z.infer<typeof otpVerifyBody>;
