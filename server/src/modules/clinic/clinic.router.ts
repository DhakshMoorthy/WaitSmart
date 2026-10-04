import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { requireTenant } from "../../middleware/tenant.js";
import * as clinicController from "./clinic.controller.js";

export const clinicRouter = Router();

clinicRouter.use(requireAuth, requireTenant);

clinicRouter.get("/", clinicController.list);
clinicRouter.get("/:id", clinicController.getOne);
clinicRouter.post("/", requireRole("admin", "superadmin"), clinicController.create);
clinicRouter.patch("/:id", requireRole("admin", "superadmin"), clinicController.update);
clinicRouter.delete("/:id", requireRole("admin", "superadmin"), clinicController.remove);
