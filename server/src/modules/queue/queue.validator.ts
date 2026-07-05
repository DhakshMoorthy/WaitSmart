import { z } from "zod";

export const queueActionBody = z.object({
  doctorId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD"),
});

export type QueueActionInput = z.infer<typeof queueActionBody>;
