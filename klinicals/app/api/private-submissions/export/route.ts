import { NextResponse } from 'next/server'
import { hasSubmissionsSession } from '@/lib/submissions-auth'
import { supabaseAdmin } from '@/lib/supabase'

function csv(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}

export async function GET(request: Request) {
  if (!hasSubmissionsSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url = new URL(request.url)
  const params = url.searchParams
  let query = supabaseAdmin().from('demo_leads').select('*').order('created_at', { ascending: false }).limit(10000)
  const type = params.get('type')
  const status = params.get('status')
  const search = params.get('q')
  if (type === 'contact') query = query.eq('current_system', 'contact')
  if (type === 'demo') query = query.neq('current_system', 'contact')
  if (status) query = query.eq('status', status)
  if (params.get('from')) query = query.gte('created_at', `${params.get('from')}T00:00:00`)
  if (params.get('to')) query = query.lte('created_at', `${params.get('to')}T23:59:59`)
  if (search) { const safeSearch = search.replace(/[(),.%]/g, ' ').trim(); if (safeSearch) query = query.or(`name.ilike.%${safeSearch}%,clinic.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,goal.ilike.%${safeSearch}%`) }
  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Could not export submissions.' }, { status: 500 })
  const columns = ['created_at','request_type','status','name','clinic','email','phone','subject','doctor_count','preferred_date','preferred_time','message']
  const rows = [columns, ...(data || []).map((row) => { const lead = row as Record<string, unknown>; return columns.map((column) => column === 'request_type' ? (lead.current_system === 'contact' ? 'contact' : 'demo') : column === 'subject' ? lead.goal : lead[column]) })]
  const body = rows.map((row) => row.map(csv).join(',')).join('\r\n')
  return new NextResponse(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="klinicals-submissions.csv"', 'Cache-Control': 'no-store' } })
}
