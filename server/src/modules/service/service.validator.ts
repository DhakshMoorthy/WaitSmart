import { z } from "zod";

export const listServicesQuery = z
  .object({
    doctorId: z.string().uuid().optional(),
    clinicId: z.string().uuid().optional(),
  })
  .refine((q) => q.doctorId || q.clinicId, { message: "doctorId or clinicId is required" });

export const createServiceBody = z.object({
  clinicId: z.string().uuid(),
  /** Omit for a service every doctor of the clinic offers (clinic admin only). */
  doctorId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(2).max(100),
  durationMinutes: z.number().int().min(5).max(240).default(15),
});

export const updateServiceBody = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  durationMinutes: z.number().int().min(5).max(240).optional(),
});

export type CreateServiceInput = z.infer<typeof createServiceBody>;
export type UpdateServiceInput = z.infer<typeof updateServiceBody>;
