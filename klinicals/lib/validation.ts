import { z } from 'zod'

export const contactRequestSchema = z.object({
  requestType: z.enum(['demo', 'contact']).optional().default('demo'),
  name: z.string().trim().min(2).max(120),
  clinic: z.string().trim().max(180).optional().default(''),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).optional().default(''),
  doctorCount: z.string().trim().max(20).optional().default(''),
  subject: z.string().trim().max(180).optional().default(''),
  preferredDate: z.string().trim().max(80).optional().default(''),
  preferredTime: z.string().trim().max(80).optional().default(''),
  message: z.string().trim().max(3000).optional().default(''),
}).superRefine((lead, ctx) => {
  if (lead.requestType === 'demo') {
    if (lead.clinic.length < 2) ctx.addIssue({ code: 'custom', path: ['clinic'], message: 'Clinic name is required.' })
    if (lead.doctorCount.length < 1) ctx.addIssue({ code: 'custom', path: ['doctorCount'], message: 'Doctor count is required.' })
  } else {
    if (lead.subject.length < 2) ctx.addIssue({ code: 'custom', path: ['subject'], message: 'Subject is required.' })
    if (lead.message.length < 2) ctx.addIssue({ code: 'custom', path: ['message'], message: 'Message is required.' })
  }
})
