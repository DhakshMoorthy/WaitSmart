import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { requireTenant } from "../../middleware/tenant.js";
import * as queueController from "./queue.controller.js";

export const queueRouter = Router();

queueRouter.use(requireAuth, requireTenant, requireRole("admin", "doctor", "superadmin"));

queueRouter.post("/next", queueController.next);
queueRouter.post("/skip", queueController.skip);
queueRouter.post("/no-show", queueController.noShow);
queueRouter.post("/done", queueController.done);
queueRouter.post("/undo", queueController.undo);
queueRouter.post("/reset", queueController.reset);
queueRouter.patch("/appointment-status", queueController.updateStatus);
queueRouter.patch("/doctor-notes", queueController.updateNotes);
