import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireTenant } from "../../middleware/tenant.js";
import * as clinicController from "./clinic.controller.js";

export const clinicRouter = Router();

clinicRouter.use(requireAuth, requireTenant);

clinicRouter.get("/", clinicController.list);
clinicRouter.get("/:id", clinicController.getOne);
clinicRouter.post("/", clinicController.create);
clinicRouter.patch("/:id", clinicController.update);
clinicRouter.delete("/:id", clinicController.remove);
