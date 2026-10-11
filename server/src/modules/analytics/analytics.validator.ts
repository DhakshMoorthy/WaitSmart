import { z } from "zod";

export const analyticsQuery = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const summaryQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD"),
  doctorId: z.string().uuid().optional(),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuery>;
