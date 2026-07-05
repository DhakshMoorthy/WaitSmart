import { z } from "zod";
import { tenantSchema } from "@waitsmart/shared";

export const createTenantBody = tenantSchema;

export const updateTenantBody = tenantSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantBody>;
export type UpdateTenantInput = z.infer<typeof updateTenantBody>;
