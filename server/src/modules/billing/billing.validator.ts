import { z } from "zod";

export const subscribeBody = z.object({
  planId: z.string().min(1),
});

export type SubscribeInput = z.infer<typeof subscribeBody>;
