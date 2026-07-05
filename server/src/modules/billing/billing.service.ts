import { eq, and } from "drizzle-orm";
import { db } from "../../config/db.js";
import { subscriptions, payments } from "../../db/schema/index.js";
import { AppError } from "../../types/index.js";
import * as razorpayService from "../../services/razorpay.js";
import { logger } from "../../utils/logger.js";
import type { SubscribeInput } from "./billing.validator.js";

const PLANS = [
  { id: "plan_basic", name: "Basic", priceMonthly: 999, features: ["1 clinic", "2 doctors", "100 bookings/mo"] },
  { id: "plan_pro", name: "Pro", priceMonthly: 2999, features: ["5 clinics", "20 doctors", "unlimited bookings"] },
  { id: "plan_enterprise", name: "Enterprise", priceMonthly: 9999, features: ["unlimited clinics", "unlimited doctors", "priority support"] },
];

export function getPlans() {
  return PLANS;
}

export async function getSubscription(tenantId: string) {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.tenantId, tenantId),
    orderBy: subscriptions.createdAt,
  });
  return sub;
}

export async function subscribe(tenantId: string, input: SubscribeInput) {
  // Check if plan exists
  const plan = PLANS.find((p) => p.id === input.planId);
  if (!plan) {
    throw new AppError(400, "Invalid plan", "INVALID_PLAN");
  }

  // Check for existing active subscription
  const existing = await db.query.subscriptions.findFirst({
    where: and(eq(subscriptions.tenantId, tenantId), eq(subscriptions.status, "active")),
  });
  if (existing) {
    throw new AppError(409, "Tenant already has an active subscription", "ALREADY_SUBSCRIBED");
  }

  // Create Razorpay subscription
  const rpSub = await razorpayService.createSubscription(input.planId);

  const [subscription] = await db
    .insert(subscriptions)
    .values({
      tenantId,
      planId: input.planId,
      razorpaySubscriptionId: rpSub.id,
      status: "trialing",
    })
    .returning();

  return subscription;
}

export async function handleWebhook(event: string, payload: any) {
  logger.info(`Razorpay webhook: ${event}`);

  switch (event) {
    case "subscription.activated": {
      const subId = payload.subscription?.entity?.id;
      if (subId) {
        await db
          .update(subscriptions)
          .set({ status: "active", updatedAt: new Date() })
          .where(eq(subscriptions.razorpaySubscriptionId, subId));
      }
      break;
    }
    case "subscription.cancelled": {
      const subId = payload.subscription?.entity?.id;
      if (subId) {
        await db
          .update(subscriptions)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(subscriptions.razorpaySubscriptionId, subId));
      }
      break;
    }
    case "payment.captured": {
      const pay = payload.payment?.entity;
      if (pay) {
        // Find subscription by razorpay subscription ID
        const sub = await db.query.subscriptions.findFirst({
          where: eq(subscriptions.razorpaySubscriptionId, pay.subscription_id),
        });
        if (sub) {
          await db.insert(payments).values({
            tenantId: sub.tenantId,
            subscriptionId: sub.id,
            razorpayPaymentId: pay.id,
            razorpayOrderId: pay.order_id,
            amountPaise: pay.amount,
            currency: pay.currency ?? "INR",
            status: "paid",
          });
        }
      }
      break;
    }
    default:
      logger.debug(`Unhandled webhook event: ${event}`);
  }
}
