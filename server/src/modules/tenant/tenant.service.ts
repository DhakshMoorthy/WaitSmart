import { eq } from "drizzle-orm";
import { db } from "../../config/db.js";
import { tenants } from "../../db/schema/index.js";
import { AppError } from "../../types/index.js";
import type { CreateTenantInput, UpdateTenantInput } from "./tenant.validator.js";

export async function listTenants() {
  return db.query.tenants.findMany({ orderBy: (t, { desc }) => [desc(t.createdAt)] });
}

export async function getTenant(id: string) {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, id) });
  if (!tenant) {
    throw new AppError(404, "Tenant not found", "TENANT_NOT_FOUND");
  }
  return tenant;
}

export async function createTenant(input: CreateTenantInput) {
  const existing = await db.query.tenants.findFirst({ where: eq(tenants.slug, input.slug) });
  if (existing) {
    throw new AppError(409, "Tenant slug already in use", "SLUG_TAKEN");
  }
  const [tenant] = await db.insert(tenants).values(input).returning();
  return tenant;
}

export async function updateTenant(id: string, input: UpdateTenantInput) {
  await getTenant(id);
  const [tenant] = await db
    .update(tenants)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(tenants.id, id))
    .returning();
  return tenant;
}

export async function deactivateTenant(id: string) {
  await getTenant(id);
  const [tenant] = await db
    .update(tenants)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(tenants.id, id))
    .returning();
  return tenant;
}
