import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import * as tenantController from "./tenant.controller.js";

export const tenantRouter = Router();

// Superadmin-only: tenant provisioning & lifecycle management.
tenantRouter.use(requireAuth, requireRole("superadmin"));

tenantRouter.get("/", tenantController.list);
tenantRouter.get("/:id", tenantController.getOne);
tenantRouter.post("/", tenantController.create);
tenantRouter.patch("/:id", tenantController.update);
tenantRouter.post("/:id/deactivate", tenantController.deactivate);
