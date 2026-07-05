import type { Request, Response, NextFunction } from "express";
import type { AuthedRequest } from "../../types/index.js";
import { tenantScope } from "../../middleware/tenant.js";
import { AppError } from "../../types/index.js";
import { subscribeBody } from "./billing.validator.js";
import * as billingService from "./billing.service.js";
import { verifyWebhookSignature } from "../../services/razorpay.js";

export async function plans(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = billingService.getPlans();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getSubscription(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const data = await billingService.getSubscription(tenantId);
    res.json({ data: data ?? null });
  } catch (err) {
    next(err);
  }
}

export async function subscribe(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const body = subscribeBody.parse(req.body);
    const data = await billingService.subscribe(tenantId, body);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function razorpayWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const signature = req.headers["x-razorpay-signature"] as string;
    const rawBody = JSON.stringify(req.body);

    if (signature && !verifyWebhookSignature(rawBody, signature)) {
      throw new AppError(400, "Invalid webhook signature", "INVALID_SIGNATURE");
    }

    const { event, payload } = req.body;
    await billingService.handleWebhook(event, payload);
    res.json({ status: "ok" });
  } catch (err) {
    next(err);
  }
}
