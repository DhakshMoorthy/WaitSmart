import { z } from "zod";

export const testNotificationBody = z.object({
  channel: z.enum(["email", "push", "sms"]),
  to: z.string().min(1),
  message: z.string().min(1).max(500),
});

export type TestNotificationInput = z.infer<typeof testNotificationBody>;
