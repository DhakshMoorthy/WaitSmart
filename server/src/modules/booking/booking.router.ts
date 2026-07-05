import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireTenant } from "../../middleware/tenant.js";
import * as bookingController from "./booking.controller.js";

export const bookingRouter = Router();

// Auth applied per-route — this router is mounted at `/`, so a router-level
// `use(requireAuth)` would block every other public route (e.g. /billing/plans).
bookingRouter.get("/avail", requireAuth, requireTenant, bookingController.availability);
bookingRouter.post("/book", requireAuth, requireTenant, bookingController.create);
bookingRouter.post("/cancel", requireAuth, requireTenant, bookingController.cancel);
bookingRouter.post("/reschedule", requireAuth, requireTenant, bookingController.reschedule);
