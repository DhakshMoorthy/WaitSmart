import { z } from "zod";

export const queueActionBody = z.object({
  doctorId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD"),
});

export const updateAppointmentStatusBody = z.object({
  appointmentId: z.string().uuid(),
  status: z.enum(["waiting", "in-cabin", "done", "skipped", "no-show", "cancelled"]),
});

export const updateDoctorNotesBody = z.object({
  appointmentId: z.string().uuid(),
  doctorNotes: z.string().max(2000).nullable().optional(),
});

export type QueueActionInput = z.infer<typeof queueActionBody>;
export type UpdateAppointmentStatusInput = z.infer<typeof updateAppointmentStatusBody>;
export type UpdateDoctorNotesInput = z.infer<typeof updateDoctorNotesBody>;
