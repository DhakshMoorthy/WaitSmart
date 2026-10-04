import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";
import type { JwtPayload } from "@waitsmart/shared";

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL as SignOptions["expiresIn"],
  });
}

/** `jti` uniquely identifies this refresh token so the server can rotate/revoke it. */
export function signRefreshToken(payload: JwtPayload, jti: string): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL as SignOptions["expiresIn"],
    jwtid: jti,
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload & { jti?: string; exp?: number } {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload & { jti?: string; exp?: number };
}
