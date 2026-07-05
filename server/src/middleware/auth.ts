import type { Response, NextFunction } from "express";
import type { Role } from "@waitsmart/shared";
import { verifyAccessToken } from "../utils/jwt.js";
import { AppError, type AuthedRequest } from "../types/index.js";

export function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError(401, "Missing or invalid Authorization header", "UNAUTHENTICATED"));
  }
  try {
    req.user = verifyAccessToken(header.slice(7));
    next();
  } catch {
    next(new AppError(401, "Invalid or expired token", "UNAUTHENTICATED"));
  }
}

export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, "Not authenticated", "UNAUTHENTICATED"));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, "Insufficient permissions", "FORBIDDEN"));
    }
    next();
  };
}
