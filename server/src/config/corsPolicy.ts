import { corsOrigins } from "./env.js";

/**
 * Exact-match allowlist from CORS_ORIGINS (comma separated, full origins such as
 * https://app.klinicals.com). No wildcard / suffix matching: any other site, including
 * other people's *.onrender.com or *.vercel.app apps, is refused.
 * Requests without an Origin header (curl, server-to-server, same-origin) are allowed;
 * CORS only protects browsers.
 */
export function isAllowedCorsOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  return corsOrigins.includes(origin);
}

export function corsOriginCallback(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
) {
  // `false` (not an Error) so a blocked origin simply gets no CORS headers instead of a 500.
  callback(null, isAllowedCorsOrigin(origin));
}
