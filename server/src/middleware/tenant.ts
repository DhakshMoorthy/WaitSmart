import type { Response, NextFunction } from "express";
import { AppError, type AuthedRequest } from "../types/index.js";

/** Requires an authenticated request to carry a tenantId (all roles except superadmin). */
export function requireTenant(req: AuthedRequest, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new AppError(401, "Not authenticated", "UNAUTHENTICATED"));
  }
  if (req.user.role === "superadmin") {
    return next();
  }
  if (!req.user.tenantId) {
    return next(new AppError(403, "No tenant associated with this account", "NO_TENANT"));
  }
  next();
}

/** Pulls tenantId to scope every downstream DB query — call after requireTenant. */
export function tenantScope(req: AuthedRequest): string {
  if (!req.user?.tenantId) {
    throw new AppError(403, "No tenant associated with this account", "NO_TENANT");
  }
  return req.user.tenantId;
}
