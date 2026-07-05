import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import * as notificationController from "./notification.controller.js";

export const notificationRouter = Router();

notificationRouter.use(requireAuth);

notificationRouter.post("/test", requireRole("admin", "superadmin"), notificationController.testSend);
