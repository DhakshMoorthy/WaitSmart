import { NextResponse } from 'next/server'
import { demoRequestSchema } from '@/lib/validation'
import { supabaseAdmin } from '@/lib/supabase'
import { sendDemoEmails } from '@/lib/email'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Please submit a valid form.' }, { status: 400 })
  }

  const parsed = demoRequestSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Please check the required fields and try again.', fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  try {
    const lead = parsed.data
    const { error } = await supabaseAdmin().from('demo_leads').insert({
      name: lead.name,
      clinic: lead.clinic,
      email: lead.email,
      phone: lead.phone || '',
      country: '',
      doctor_count: lead.doctorCount,
      locations: '',
      current_system: '',
      goal: '',
      preferred_date: lead.preferredDate || '',
      preferred_time: lead.preferredTime || '',
      message: lead.message || '',
      status: 'new',
    })
    if (error) {
      console.error('Lead insert failed', error.message)
      return NextResponse.json({ error: 'We could not save your request right now. Please email contact@klinicals.com.' }, { status: 503 })
    }

    try {
      await sendDemoEmails(lead)
    } catch (emailError) {
      console.error('Demo email notification failed', emailError)
    }
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('Demo API not configured', error)
    return NextResponse.json({ error: 'Demo submissions are not configured yet. Please email contact@klinicals.com.' }, { status: 503 })
  }
}
