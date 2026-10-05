import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db } from "../../config/db.js";
import { files } from "../../db/schema/index.js";
import { AppError } from "../../types/index.js";
import * as storage from "../../services/storage.js";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE, MIME_TO_EXT, detectMime, sanitizeFilename } from "./file.validator.js";

export async function uploadFile(
  tenantId: string,
  userId: string,
  file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new AppError(400, `File type not allowed: ${file.mimetype}`, "INVALID_FILE_TYPE");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new AppError(400, "File too large (max 10MB)", "FILE_TOO_LARGE");
  }

  // Trust the bytes, not the client: content must match the declared type.
  const detected = detectMime(file.buffer);
  if (detected !== file.mimetype) {
    throw new AppError(400, "File content does not match its declared type", "INVALID_FILE_TYPE");
  }

  // Extension comes from our own allowlist, never from the uploaded filename.
  const storageKey = `${tenantId}/${uuid()}.${MIME_TO_EXT[detected]}`;

  await storage.uploadFile(storageKey, file.buffer, file.mimetype);

  const [record] = await db
    .insert(files)
    .values({
      tenantId,
      uploadedBy: userId,
      filename: sanitizeFilename(file.originalname),
      mimeType: file.mimetype,
      sizeBytes: file.size,
      storageKey,
    })
    .returning();

  return record;
}

export async function serveFile(tenantId: string, fileId: string) {
  const record = await db.query.files.findFirst({
    where: and(eq(files.id, fileId), eq(files.tenantId, tenantId)),
  });
  if (!record) {
    throw new AppError(404, "File not found", "NOT_FOUND");
  }

  const buffer = await storage.getFileBuffer(record.storageKey);
  if (!buffer) {
    throw new AppError(404, "File data not found in storage", "STORAGE_ERROR");
  }

  return { buffer, mimeType: record.mimeType, filename: record.filename };
}
