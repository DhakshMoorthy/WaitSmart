import { NextResponse } from 'next/server'
import { contactRequestSchema } from '@/lib/validation'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let raw: unknown

  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Please submit a valid form.' }, { status: 400 })
  }

  const parsed = contactRequestSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Please check the required fields and try again.', fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  // Let the form be exercised during local development without requiring a
  // Supabase project. Local preview submissions are not stored or sent.
  const hasSupabaseConfig = Boolean(
    process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
  )
  if (process.env.NODE_ENV !== 'production' && !hasSupabaseConfig) {
    return NextResponse.json({ ok: true, localOnly: true }, { status: 201 })
  }

  try {
    const { error } = await supabaseAdmin().from('demo_leads').insert({
      name: parsed.data.name,
      clinic: parsed.data.clinic,
      email: parsed.data.email,
      phone: parsed.data.phone || '',
      country: '',
      doctor_count: parsed.data.doctorCount,
      locations: '',
      current_system: '',
      goal: '',
      preferred_date: parsed.data.preferredDate || '',
      preferred_time: parsed.data.preferredTime || '',
      message: parsed.data.message || '',
      status: 'new',
    })

    if (error) {
      console.error('Contact lead insert failed', error.message)
      return NextResponse.json({ error: 'We could not save your request right now. Please email contact@klinicals.com.' }, { status: 503 })
    }

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('Contact API not configured', error)
    return NextResponse.json({ error: 'Contact submissions are not configured yet. Please email contact@klinicals.com.' }, { status: 503 })
  }
}
