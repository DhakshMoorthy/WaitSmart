import { z } from 'zod'

const leadRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  clinic: z.string().trim().min(2).max(180),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).optional().default(''),
  doctorCount: z.string().trim().min(1).max(20),
  preferredDate: z.string().trim().max(80).optional().default(''),
  preferredTime: z.string().trim().max(80).optional().default(''),
  message: z.string().trim().max(3000).optional().default(''),
})

export const demoRequestSchema = leadRequestSchema
export const contactRequestSchema = leadRequestSchema
export type DemoRequest = z.infer<typeof demoRequestSchema>
export type ContactRequest = z.infer<typeof contactRequestSchema>
