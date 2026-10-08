import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export default async function ContactSubmissionsPage({ searchParams }: { searchParams?: { error?: string } }) {
  const expectedPassword = process.env.ADMIN_DASHBOARD_TOKEN
  const cookieValue = cookies().get('klinicals_admin')?.value

  if (!expectedPassword || cookieValue !== expectedPassword) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f7f9fc', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ width: 'min(420px, 90vw)', background: '#fff', border: '1px solid #dfeaf5', borderRadius: 18, padding: 28, boxShadow: '0 12px 30px rgba(16, 47, 86, 0.06)' }}>
          <div style={{ fontSize: 14, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#2272df', fontWeight: 800, marginBottom: 8 }}>Restricted access</div>
          <h1 style={{ margin: '0 0 12px', fontSize: 34, color: '#0d2540' }}>Contact submissions</h1>

          <p style={{ color: '#47627f', lineHeight: 1.6 }}>Sign in to the protected lead dashboard to view contact submissions.</p>
          <a href="/admin/leads" style={{ display: 'block', textAlign: 'center', marginTop: 18, padding: '14px 18px', borderRadius: 10, background: '#0e69d8', color: '#fff', textDecoration: 'none', fontSize: 16, fontWeight: 800 }}>Open lead dashboard</a>
        </div>
      </main>
    )
  }

  let rows: any[] = []
  let error = ''

  try {
    const result = await supabaseAdmin().from('demo_leads').select('*').order('created_at', { ascending: false })
    rows = result.data || []
    error = result.error?.message || ''
  } catch (e) {
    error = e instanceof Error ? e.message : 'Unable to load submissions.'
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f7f9fc', padding: '36px 24px', fontFamily: 'Inter, sans-serif', color: '#0d2540' }}>
      <div style={{ maxWidth: 1300, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#2272df', fontWeight: 800 }}>Internal</div>
            <h1 style={{ margin: '8px 0 0', fontSize: 38, letterSpacing: '-0.05em' }}>Contact submissions</h1>
          </div>
          <a href="/admin/leads" style={{ display: 'inline-block', padding: '10px 16px', borderRadius: 10, background: '#ecf3ff', color: '#134ea8', textDecoration: 'none', fontWeight: 700 }}>Open lead dashboard</a>
        </div>

        {error ? <p style={{ color: '#b42318', marginBottom: 18 }}>{error}</p> : null}

        <div style={{ overflowX: 'auto', borderRadius: 16, border: '1px solid #dfeaf5', background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
            <thead>
              <tr style={{ background: '#f3f7fb' }}>
                {['Name', 'Clinic', 'Email', 'Phone', 'Doctors', 'Preferred date', 'Preferred time', 'Message', 'Submitted'].map((heading) => (
                  <th key={heading} style={{ padding: '12px 14px', textAlign: 'left', borderBottom: '1px solid #e5edf6', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#58708a' }}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '20px 14px', color: '#5a7084' }}>No submissions yet.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid #edf1f6' }}>
                    <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>{row.name || '-'}</td>
                    <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>{row.clinic || '-'}</td>
                    <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>{row.email || '-'}</td>
                    <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>{row.phone || '-'}</td>
                    <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>{row.doctor_count || '-'}</td>
                    <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>{row.preferred_date || '-'}</td>
                    <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>{row.preferred_time || '-'}</td>
                    <td style={{ padding: '12px 14px', verticalAlign: 'top', whiteSpace: 'pre-wrap' }}>{row.message || '-'}</td>
                    <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>{row.created_at ? new Date(row.created_at).toLocaleString() : '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
