import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { requireTenant } from "../../middleware/tenant.js";
import * as billingController from "./billing.controller.js";

export const billingRouter = Router();

billingRouter.get("/plans", billingController.plans);

billingRouter.post("/webhooks/razorpay", billingController.razorpayWebhook);

billingRouter.use(requireAuth, requireTenant, requireRole("admin", "superadmin"));
billingRouter.get("/subscription", billingController.getSubscription);
billingRouter.post("/subscribe", billingController.subscribe);
