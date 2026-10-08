import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { contactRequestSchema } from '@/lib/validation'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Please submit a valid form.' }, { status: 400 })
  }

  const parsed = contactRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please check the required fields and try again.' }, { status: 400 })
  }

  try {
    const lead = parsed.data
    const { error } = await supabaseAdmin().from('demo_leads').insert({
      name: lead.name,
      clinic: lead.clinic || '',
      email: lead.email,
      phone: lead.phone,
      country: '',
      doctor_count: lead.doctorCount || '',
      // Reuse legacy optional fields so this works with the existing table
      // without requiring a database migration.
      current_system: lead.requestType === 'contact' ? 'contact' : '',
      goal: lead.subject || '',
      locations: '',
      preferred_date: lead.preferredDate,
      preferred_time: lead.preferredTime,
      message: lead.message,
      status: 'new',
    })

    if (error) {
      console.error('Demo lead insert failed:', error.message)
      return NextResponse.json({ error: 'We could not save your request right now. Please try again later.' }, { status: 503 })
    }

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('Demo request setup failed:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Requests are temporarily unavailable. Please try again later.' }, { status: 503 })
  }
}
