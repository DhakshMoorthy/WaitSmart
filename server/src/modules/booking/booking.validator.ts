import { z } from "zod";

export const availabilityQuery = z.object({
  doctorId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD"),
});

export const createBookingBody = z.object({
  clinicId: z.string().uuid(),
  doctorId: z.string().uuid(),
  slotId: z.string().uuid(),
  patientName: z.string().min(2).max(200),
  patientPhone: z.string().regex(/^\+?[1-9]\d{9,14}$/).optional(),
  symptoms: z.string().max(1000).optional(),
});

export const cancelBookingBody = z.object({
  appointmentId: z.string().uuid(),
});

export const rescheduleBookingBody = z.object({
  appointmentId: z.string().uuid(),
  newSlotId: z.string().uuid(),
});

export type AvailabilityQuery = z.infer<typeof availabilityQuery>;
export type CreateBookingInput = z.infer<typeof createBookingBody>;
export type CancelBookingInput = z.infer<typeof cancelBookingBody>;
export type RescheduleBookingInput = z.infer<typeof rescheduleBookingBody>;
