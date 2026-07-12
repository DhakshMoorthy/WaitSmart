import { corsOrigins } from "./env.js";

/** Allow listed origins plus any HTTPS Render static site (*.onrender.com). */
export function isAllowedCorsOrigin(origin: string | undefined): boolean {
  if (!origin) return true;

  if (corsOrigins.includes(origin)) return true;

  try {
    const url = new URL(origin);
    return url.protocol === "https:" && url.hostname.endsWith(".onrender.com");
  } catch {
    return false;
  }
}

export function corsOriginCallback(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
) {
  if (isAllowedCorsOrigin(origin)) {
    callback(null, true);
  } else {
    callback(new Error(`Blocked by CORS: ${origin}`));
  }
}
