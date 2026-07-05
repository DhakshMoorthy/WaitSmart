import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import path from "path";
import fs from "fs/promises";

const LOCAL_UPLOAD_DIR = path.resolve("uploads");

async function ensureLocalDir() {
  await fs.mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
}

export async function uploadFile(
  key: string,
  buffer: Buffer,
  _mimeType: string,
): Promise<string> {
  if (env.STORAGE_PROVIDER === "s3" || env.STORAGE_PROVIDER === "oci") {
    // Use S3-compatible SDK (future: @aws-sdk/client-s3)
    logger.warn("[STORAGE] S3/OCI upload not yet implemented, falling back to local");
  }

  // Local file storage fallback for development
  await ensureLocalDir();
  const filePath = path.join(LOCAL_UPLOAD_DIR, key);
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, buffer);
  logger.info(`File saved locally: ${filePath}`);
  return key;
}

export async function getFileBuffer(key: string): Promise<Buffer | null> {
  if (env.STORAGE_PROVIDER === "s3" || env.STORAGE_PROVIDER === "oci") {
    logger.warn("[STORAGE] S3/OCI download not yet implemented, falling back to local");
  }

  const filePath = path.join(LOCAL_UPLOAD_DIR, key);
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}
