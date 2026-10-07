import { z } from "zod";

export const createDoctorBody = z.object({
  clinicId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  name: z.string().min(2).max(200),
  specialization: z.string().min(2).max(200),
  experienceYears: z.number().int().min(0).max(80).default(0),
  gender: z.enum(["male", "female"]).nullable().optional(),
});

export const updateDoctorBody = createDoctorBody.partial().omit({ clinicId: true });

export const scheduleItemSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Format: HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Format: HH:MM"),
  slotDurationMinutes: z.number().int().min(5).max(120).default(15),
});

export const updateScheduleBody = z.object({
  schedules: z.array(scheduleItemSchema).min(1).max(7),
});

export const createBreakBody = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(500).optional(),
});

export type CreateDoctorInput = z.infer<typeof createDoctorBody>;
export type UpdateDoctorInput = z.infer<typeof updateDoctorBody>;
export type ScheduleItem = z.infer<typeof scheduleItemSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleBody>;
export type CreateBreakInput = z.infer<typeof createBreakBody>;
