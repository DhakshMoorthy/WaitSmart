import Razorpay from "razorpay";
import crypto from "crypto";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

let razorpayInstance: Razorpay | null = null;

function getRazorpay(): Razorpay | null {
  if (razorpayInstance) return razorpayInstance;
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    return null;
  }
  razorpayInstance = new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  });
  return razorpayInstance;
}

export async function createSubscription(planId: string, totalCount: number = 12) {
  const rp = getRazorpay();
  if (!rp) {
    logger.warn("[RAZORPAY-DEV] Razorpay not configured, returning mock subscription");
    return { id: `sub_mock_${Date.now()}`, planId, status: "created" };
  }

  const subscription = await rp.subscriptions.create({
    plan_id: planId,
    total_count: totalCount,
    quantity: 1,
  });
  return subscription;
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  if (!env.RAZORPAY_KEY_SECRET) return false;

  const expected = crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
