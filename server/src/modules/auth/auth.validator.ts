import { z } from "zod";
import { registerSchema, loginSchema, phoneSchema } from "@waitsmart/shared";

export const registerBody = registerSchema;
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
});

export type RegisterInput = z.infer<typeof registerBody>;
export type LoginInput = z.infer<typeof loginBody>;
export type RefreshInput = z.infer<typeof refreshBody>;
export type OtpSendInput = z.infer<typeof otpSendBody>;
export type OtpVerifyInput = z.infer<typeof otpVerifyBody>;
