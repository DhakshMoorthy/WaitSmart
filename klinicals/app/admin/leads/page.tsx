import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { AdminStatus } from '@/components/admin-status'

export const dynamic = 'force-dynamic'

const statuses = ['new', 'contacted', 'demo_scheduled', 'converted', 'closed']

export default async function Leads({
  searchParams,
}: {
  searchParams: { status?: string; error?: string }
}) {
  const token = process.env.ADMIN_DASHBOARD_TOKEN
  const authenticated = Boolean(token && cookies().get('klinicals_admin')?.value === token)

  if (!authenticated) {
    const message = !token
      ? 'Admin access is not configured. Add ADMIN_DASHBOARD_TOKEN in Vercel, then redeploy.'
      : searchParams.error === 'unauthorized'
        ? 'That access token was not accepted. Check the value of ADMIN_DASHBOARD_TOKEN in Vercel.'
        : ''

    return (
      <main className="admin">
        <div className="wrap">
          <h1>Lead dashboard</h1>
          <p>This internal page requires an authorized session.</p>
          {message && <p role="alert" style={{ color: '#b42318' }}>{message}</p>}
          {token && (
            <form action="/admin/login" method="post">
              <label htmlFor="admin-token">Admin access token</label>
              <input
                id="admin-token"
                type="password"
                name="token"
                required
                autoComplete="current-password"
                style={{ margin: '0 12px', padding: 10, border: '1px solid #dce5ef', borderRadius: 8 }}
              />
              <button className="btn">Sign in</button>
            </form>
          )}
        </div>
      </main>
    )
  }

  const status = statuses.includes(searchParams.status || '') ? searchParams.status || '' : ''
  let leads: any[] = []
  let error = ''

  try {
    let query = supabaseAdmin().from('demo_leads').select('*').order('created_at', { ascending: false })
    if (status) query = query.eq('status', status)
    const result = await query
    leads = result.data || []
    error = result.error?.message || ''
  } catch (cause) {
    error = cause instanceof Error ? cause.message : 'Unable to load leads.'
  }

  return (
    <main className="admin">
      <div className="wrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="eyebrow">Internal</span>
            <h1>Demo requests</h1>
          </div>
          <a href="/" className="btn btn-light">View site</a>
        </div>
        <form style={{ margin: '18px 0' }}>
          <label htmlFor="status">Filter by status </label>
          <select id="status" name="status" defaultValue={status} style={{ padding: 9, border: '1px solid #dce5ef', borderRadius: 7 }}>
            <option value="">All leads</option>
            {statuses.map((value) => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}
          </select>
          <button className="btn" style={{ marginLeft: 8, padding: '10px 14px' }}>Apply</button>
        </form>
        {error && <p role="alert" style={{ color: '#b42318' }}>{error}</p>}
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                {['Name', 'Clinic', 'Email', 'Phone', 'Doctors', 'Preferred date', 'Preferred time', 'Submitted', 'Status'].map((heading) => (
                  <th key={heading}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>{lead.name}</td>
                  <td>{lead.clinic}</td>
                  <td><a href={`mailto:${lead.email}`}>{lead.email}</a></td>
                  <td>{lead.phone || '—'}</td>
                  <td>{lead.doctor_count}</td>
                  <td>{lead.preferred_date || '—'}</td>
                  <td>{lead.preferred_time || '—'}</td>
                  <td>{new Date(lead.created_at).toLocaleString()}</td>
                  <td>
                    <AdminStatus id={lead.id} status={lead.status} />
                    <details style={{ marginTop: 6 }}>
                      <summary style={{ cursor: 'pointer', fontSize: 10 }}>Details</summary>
                      <p style={{ maxWidth: 260, whiteSpace: 'pre-wrap' }}>{lead.message || 'No additional message'}</p>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {leads.length === 0 && !error && <p>No demo requests yet.</p>}
      </div>
    </main>
  )
}
