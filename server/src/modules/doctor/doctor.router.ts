import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { requireTenant } from "../../middleware/tenant.js";
import * as doctorController from "./doctor.controller.js";
import { requireAdminOrOwnDoctor } from "./doctor.guard.js";

export const doctorRouter = Router();

doctorRouter.use(requireAuth, requireTenant);

doctorRouter.get("/", doctorController.list);
doctorRouter.get("/:id", doctorController.getOne);
doctorRouter.post("/", requireRole("admin", "superadmin"), doctorController.create);
doctorRouter.patch("/:id", requireAdminOrOwnDoctor, doctorController.update);
doctorRouter.delete("/:id", requireRole("admin", "superadmin"), doctorController.remove);

doctorRouter.get("/:id/schedules", doctorController.getSchedules);
doctorRouter.put("/:id/schedules", requireAdminOrOwnDoctor, doctorController.updateSchedules);
doctorRouter.get("/:id/breaks", doctorController.getBreaks);
doctorRouter.post("/:id/breaks", requireAdminOrOwnDoctor, doctorController.createBreak);
