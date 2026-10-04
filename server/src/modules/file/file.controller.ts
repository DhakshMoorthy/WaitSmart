import type { Response, NextFunction } from "express";
import type { AuthedRequest } from "../../types/index.js";
import { tenantScope } from "../../middleware/tenant.js";
import * as fileService from "./file.service.js";

export async function upload(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: { code: "NO_FILE", message: "No file uploaded" } });
    }
    const data = await fileService.uploadFile(tenantId, req.user!.userId, file);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function serve(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const { buffer, mimeType, filename } = await fileService.serveFile(tenantId, req.params.id);
    res.setHeader("Content-Type", mimeType);
    // RFC 6266: ASCII fallback + UTF-8 name, so no raw user input is ever placed in the header.
    const ascii = filename.replace(/[^ -~]/g, "_").replace(/["\\]/g, "_");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}
