import { z } from "zod";

export const updateProfileBody = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/).optional(),
});

export const addFavoriteBody = z.object({
  doctorId: z.string().uuid(),
});

export const addFamilyMemberBody = z.object({
  name: z.string().min(2).max(120),
  relationship: z.string().min(2).max(60),
  age: z.number().int().min(0).max(150).optional(),
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileBody>;
export type AddFavoriteInput = z.infer<typeof addFavoriteBody>;
export type AddFamilyMemberInput = z.infer<typeof addFamilyMemberBody>;
