export const QUEUE_STATUS = {
  WAITING: "waiting",
  IN_CABIN: "in-cabin",
  DONE: "done",
  SKIPPED: "skipped",
  NO_SHOW: "no-show",
} as const;

export type QueueStatus = (typeof QUEUE_STATUS)[keyof typeof QUEUE_STATUS];

export const SLOT_STATUS = {
  AVAILABLE: "available",
  BOOKED: "booked",
  CANCELLED: "cancelled",
} as const;

export type SlotStatus = (typeof SLOT_STATUS)[keyof typeof SLOT_STATUS];

export const SUBSCRIPTION_STATUS = {
  TRIALING: "trialing",
  ACTIVE: "active",
  PAST_DUE: "past_due",
  CANCELLED: "cancelled",
} as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];
