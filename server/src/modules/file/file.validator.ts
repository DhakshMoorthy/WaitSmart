import { z } from "zod";

/** Allowed types and the ONLY extension we will ever store each one under. */
export const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export const ALLOWED_MIME_TYPES = Object.keys(MIME_TO_EXT);

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const fileIdParam = z.object({
  id: z.string().uuid(),
});

/**
 * Identify a file by its leading bytes ("magic numbers"). The client-declared MIME type
 * and the filename are attacker-controlled; the content is not.
 */
export function detectMime(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf.length >= 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("latin1") === "RIFF" &&
    buf.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp";
  }
  if (buf.length >= 5 && buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  return null;
}

/** Strip any path, control characters and quotes; keep it short. Used for display only. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f"<>:|?*]/g, "").trim();
  return cleaned.slice(0, 120) || "file";
}
