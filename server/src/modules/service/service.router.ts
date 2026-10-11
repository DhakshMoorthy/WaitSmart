import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { requireTenant } from "../../middleware/tenant.js";
import * as serviceController from "./service.controller.js";

export const serviceRouter = Router();

serviceRouter.use(requireAuth, requireTenant);

// Anyone signed in can see what a doctor offers (the booking page needs it); only staff can change it.
serviceRouter.get("/", serviceController.list);
serviceRouter.post("/", requireRole("admin", "superadmin", "doctor"), serviceController.create);
serviceRouter.patch("/:id", requireRole("admin", "superadmin", "doctor"), serviceController.update);
serviceRouter.delete("/:id", requireRole("admin", "superadmin", "doctor"), serviceController.remove);
