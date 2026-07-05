import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireTenant } from "../../middleware/tenant.js";
import * as doctorController from "./doctor.controller.js";

export const doctorRouter = Router();

doctorRouter.use(requireAuth, requireTenant);

doctorRouter.get("/", doctorController.list);
doctorRouter.get("/:id", doctorController.getOne);
doctorRouter.post("/", doctorController.create);
doctorRouter.patch("/:id", doctorController.update);
doctorRouter.delete("/:id", doctorController.remove);

doctorRouter.get("/:id/schedules", doctorController.getSchedules);
doctorRouter.put("/:id/schedules", doctorController.updateSchedules);
doctorRouter.get("/:id/breaks", doctorController.getBreaks);
doctorRouter.post("/:id/breaks", doctorController.createBreak);
