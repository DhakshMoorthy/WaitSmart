import type { Response, NextFunction } from "express";
import { and, eq, or } from "drizzle-orm";
import { db } from "../config/db.js";
import { env } from "../config/env.js";
import { tenants } from "../db/schema/index.js";
import { AppError, type AuthedRequest } from "../types/index.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Requires an authenticated request to carry a tenantId.
 *
 * A superadmin belongs to no clinic, so on tenant-scoped routes they act on a clinic chosen per
 * request: the one named by the `x-tenant-id` header, otherwise the default clinic
 * (DEFAULT_TENANT_SLUG). Without this every tenant route answered 403 NO_TENANT for them and the
 * admin screen silently showed no doctors.
 *
 * `x-tenant-id` is honoured ONLY for superadmin. For every other role the tenant always comes
 * from the signed token, whatever headers the client sends.
 */
export async function requireTenant(req: AuthedRequest, _res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError(401, "Not authenticated", "UNAUTHENTICATED");
    }

    if (req.user.role !== "superadmin") {
      if (!req.user.tenantId) {
        throw new AppError(403, "No tenant associated with this account", "NO_TENANT");
      }
      return next();
    }

    const header = req.headers["x-tenant-id"];
    const wanted = typeof header === "string" && header.length > 0 ? header : undefined;
    if (wanted && !UUID_RE.test(wanted)) {
      throw new AppError(400, "x-tenant-id must be a tenant UUID", "INVALID_TENANT");
    }

    const tenant = await db.query.tenants.findFirst({
      where: wanted
        ? eq(tenants.id, wanted)
        : or(eq(tenants.slug, env.DEFAULT_TENANT_SLUG), eq(tenants.subdomain, env.DEFAULT_TENANT_SLUG)),
    });
    if (!tenant || !tenant.isActive) {
      throw wanted
        ? new AppError(404, "Tenant not found", "INVALID_TENANT")
        : new AppError(409, "No default clinic is configured; send x-tenant-id", "NO_TENANT");
    }

    req.user = { ...req.user, tenantId: tenant.id };
    next();
  } catch (err) {
    next(err);
  }
}

/** Pulls tenantId to scope every downstream DB query — call after requireTenant. */
export function tenantScope(req: AuthedRequest): string {
  if (!req.user?.tenantId) {
    throw new AppError(403, "No tenant associated with this account", "NO_TENANT");
  }
  return req.user.tenantId;
}
