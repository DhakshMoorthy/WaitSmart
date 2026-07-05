import { z } from "zod";
import { ROLE_LIST } from "../constants/roles.js";

export const emailSchema = z.string().email();
export const passwordSchema = z.string().min(8).max(72);
export const phoneSchema = z.string().regex(/^\+?[1-9]\d{9,14}$/, "Invalid phone number");

export const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema.optional(),
  role: z.enum(ROLE_LIST as [string, ...string[]]).default("patient"),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const tenantSchema = z.object({
  name: z.string().min(2).max(160),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  subdomain: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Subdomain must be lowercase alphanumeric with hyphens")
    .optional(),
  branding: z
    .object({
      logoUrl: z.string().url().optional(),
      primaryColor: z.string().optional(),
      appName: z.string().optional(),
    })
    .optional(),
});
