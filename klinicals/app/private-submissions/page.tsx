import type { Metadata } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { hasSubmissionsSession } from '@/lib/submissions-auth'
import { SubmissionsLogin } from '@/components/submissions-login'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Private submissions', robots: { index: false, follow: false, noarchive: true } }

type Query = { q?: string; type?: string; status?: string; from?: string; to?: string }
type Lead = { id: string; created_at: string; request_type: string; current_system: string; name: string; clinic: string; email: string; phone: string; subject: string; goal: string; doctor_count: string; preferred_date: string; preferred_time: string; message: string; status: string }

export default async function PrivateSubmissionsPage({ searchParams }: { searchParams: Query }) {
  if (!hasSubmissionsSession()) return <SubmissionsLogin />

  let leads: Lead[] = []
  let error = ''
  try {
    let query = supabaseAdmin().from('demo_leads').select('*').order('created_at', { ascending: false }).limit(1000)
    if (searchParams.type === 'contact') query = query.eq('current_system', 'contact')
    if (searchParams.type === 'demo') query = query.neq('current_system', 'contact')
    if (searchParams.status) query = query.eq('status', searchParams.status)
    if (searchParams.from) query = query.gte('created_at', `${searchParams.from}T00:00:00`)
    if (searchParams.to) query = query.lte('created_at', `${searchParams.to}T23:59:59`)
    if (searchParams.q) { const search = searchParams.q.replace(/[(),.%]/g, ' ').trim(); if (search) query = query.or(`name.ilike.%${search}%,clinic.ilike.%${search}%,email.ilike.%${search}%,goal.ilike.%${search}%`) }
    const result = await query
    if (result.error) throw new Error(result.error.message)
    leads = (result.data || []).map((row) => { const lead = row as Omit<Lead, 'request_type' | 'subject'>; return { ...lead, request_type: lead.current_system === 'contact' ? 'contact' : 'demo', subject: lead.goal || '' } })
  } catch (cause) {
    error = cause instanceof Error ? cause.message : 'Could not load submissions.'
  }

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) if (value) params.set(key, value)

  return <main className="submissions-page"><div className="submissions-shell">
    <header className="submissions-header"><div><span className="eyebrow">Private database</span><h1>Contact submissions</h1><p>Showing {leads.length} {leads.length === 1 ? 'record' : 'records'} (up to 1,000).</p></div>
      <div className="submissions-actions"><a className="btn btn-light" href={`/api/private-submissions/export?${params.toString()}`}>Export CSV</a><form action="/api/private-submissions/logout" method="post"><button className="btn btn-light">Sign out</button></form></div>
    </header>
    <form className="submission-filters" method="get">
      <input name="q" defaultValue={searchParams.q} placeholder="Search name, clinic, email, subject" aria-label="Search submissions" />
      <select name="type" defaultValue={searchParams.type || ''} aria-label="Request type"><option value="">All types</option><option value="demo">Demo requests</option><option value="contact">Contact messages</option></select>
      <select name="status" defaultValue={searchParams.status || ''} aria-label="Status"><option value="">All statuses</option><option value="new">New</option><option value="contacted">Contacted</option><option value="demo_scheduled">Demo scheduled</option><option value="converted">Converted</option><option value="closed">Closed</option></select>
      <label>From<input type="date" name="from" defaultValue={searchParams.from} /></label><label>To<input type="date" name="to" defaultValue={searchParams.to} /></label>
      <button className="btn">Filter</button><a className="filter-reset" href="/private-submissions">Reset</a>
    </form>
    {error ? <p className="private-error" role="alert">Could not load records: {error}. Check that the demo_leads table exists and has its original columns.</p> : <div className="submission-table-wrap"><table className="submission-table"><thead><tr><th>Date</th><th>Type</th><th>Name / Clinic</th><th>Email / Phone</th><th>Subject / Doctors</th><th>Preferred demo</th><th>Message</th><th>Status</th></tr></thead><tbody>{leads.map((lead) => <tr key={lead.id}><td>{new Date(lead.created_at).toLocaleString()}</td><td><span className={`request-badge ${lead.request_type || 'demo'}`}>{lead.request_type || 'demo'}</span></td><td><b>{lead.name}</b><small>{lead.clinic || '—'}</small></td><td><span>{lead.email}</span><small>{lead.phone || '—'}</small></td><td>{lead.subject || '—'}<small>{lead.doctor_count ? `${lead.doctor_count} doctors` : ''}</small></td><td>{lead.preferred_date || '—'}<small>{lead.preferred_time || ''}</small></td><td className="submission-message">{lead.message || '—'}</td><td>{lead.status}</td></tr>)}</tbody></table>{leads.length === 0 && <p className="no-submissions">No submissions match these filters.</p>}</div>}
  </div></main>
}
