import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../../middleware/auth.js";
import { requireTenant } from "../../middleware/tenant.js";
import * as fileController from "./file.controller.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const fileRouter = Router();

fileRouter.use(requireAuth, requireTenant);

fileRouter.post("/upload", upload.single("file"), fileController.upload);
fileRouter.get("/:id", fileController.serve);
