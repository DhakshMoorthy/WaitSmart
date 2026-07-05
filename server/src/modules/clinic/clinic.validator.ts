import { z } from "zod";

export const createClinicBody = z.object({
  name: z.string().min(2).max(200),
  address: z.string().min(5).max(500),
  hours: z.string().max(200).optional(),
});

export const updateClinicBody = createClinicBody.partial();

export type CreateClinicInput = z.infer<typeof createClinicBody>;
export type UpdateClinicInput = z.infer<typeof updateClinicBody>;
