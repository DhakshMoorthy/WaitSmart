import { z } from "zod";

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const fileIdParam = z.object({
  id: z.string().uuid(),
});
