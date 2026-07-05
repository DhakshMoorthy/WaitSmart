import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { requireTenant } from "../../middleware/tenant.js";
import * as analyticsController from "./analytics.controller.js";

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth, requireTenant, requireRole("admin"));

analyticsRouter.get("/daily", analyticsController.daily);
analyticsRouter.get("/wait-times", analyticsController.waitTimes);
analyticsRouter.get("/no-show-rate", analyticsController.noShowRate);
analyticsRouter.get("/revenue", analyticsController.revenue);
