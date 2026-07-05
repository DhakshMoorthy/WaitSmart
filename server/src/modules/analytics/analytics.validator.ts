import { z } from "zod";

export const analyticsQuery = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuery>;
