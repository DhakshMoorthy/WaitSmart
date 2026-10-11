import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { requireTenant } from "../../middleware/tenant.js";
import * as analyticsController from "./analytics.controller.js";

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth, requireTenant);

// Clinic summary: staff see the whole clinic (or one doctor), a doctor only their own numbers.
analyticsRouter.get("/summary", requireRole("admin", "superadmin", "doctor"), analyticsController.summary);

analyticsRouter.use(requireRole("admin"));

analyticsRouter.get("/daily", analyticsController.daily);
analyticsRouter.get("/wait-times", analyticsController.waitTimes);
analyticsRouter.get("/no-show-rate", analyticsController.noShowRate);
analyticsRouter.get("/revenue", analyticsController.revenue);
