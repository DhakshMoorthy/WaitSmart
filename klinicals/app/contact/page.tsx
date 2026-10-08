'use client'

import { useState } from 'react'

const fieldStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #cfe0ef',
  borderRadius: 12,
  padding: '14px 14px',
  fontSize: 16,
  background: '#fff',
  color: '#16314f',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 700,
  fontSize: 14,
  color: '#1b2d3d',
  marginBottom: 8,
}

export default function ContactPage() {
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')

    const form = event.currentTarget
    const data = Object.fromEntries(new FormData(form).entries())

    try {
      const response = await fetch('/api/contact-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Please check the required fields and try again.')
      }

      setSent(true)
      form.reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f7f9fc', color: '#0d2540', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 28px 60px' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0 18px' }}>
          <a href="/" aria-label="Klinicals home" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'inherit', textDecoration: 'none' }}><img src="/klinicals-mark.svg" alt="" width="42" height="42" /><span style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.04em', color: '#0d2540' }}>Klinicals</span></a>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1.12fr', gap: 64, alignItems: 'center', paddingTop: 16 }}>
          <div style={{ paddingRight: 10 }}>
            <a href="/" style={{ color: '#1e6fe7', fontWeight: 700, textDecoration: 'none' }}>← Back to home</a>
            <div style={{ fontSize: 14, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#1c6de0', fontWeight: 700, marginBottom: 22 }}>Book a free demo</div>
            <h1 style={{ margin: 0, fontSize: 'clamp(3.3rem, 5vw, 6rem)', lineHeight: 0.96, letterSpacing: '-0.07em', fontWeight: 800, color: '#0e2e4a' }}>See Klinicals in action.</h1>
            <p style={{ fontSize: 26, lineHeight: 1.45, color: '#36526c', maxWidth: 560, marginTop: 28 }}>
              Tell us a little about your clinic and we&apos;ll arrange a quick walkthrough.
            </p>

            <div style={{ marginTop: 28, fontSize: 15, color: '#3d5b76' }}>
              A member of our team will follow up to arrange a time. Submitting this form does not book a calendar appointment.
            </div>

            <div style={{ marginTop: 26, fontSize: 16, fontWeight: 700 }}>
              <a href="mailto:contact@klinicals.com" style={{ color: '#1e6fe7', textDecoration: 'none' }}>
                ✉ contact@klinicals.com
              </a>
            </div>
          </div>

          <div style={{ border: '1px solid #dbe7f2', borderRadius: 18, background: 'rgba(255,255,255,0.8)', boxShadow: '0 8px 24px rgba(10, 35, 70, 0.04)', padding: '24px 26px 20px' }}>
            {sent ? (
              <div style={{ textAlign: 'center', padding: '26px 12px' }}>
                <div style={{ width: 66, height: 66, borderRadius: '50%', background: '#eaf6eb', color: '#3ca35f', display: 'grid', placeItems: 'center', margin: '0 auto 18px', fontSize: 30, fontWeight: 800 }}>✓</div>
                <h3 style={{ margin: '0 0 10px', fontSize: 32, color: '#153756' }}>Your request is received.</h3>
                <p style={{ margin: 0, fontSize: 16, color: '#47627f', lineHeight: 1.6 }}>
                  We&apos;ll get back to you shortly to arrange your demo.
                </p>
              </div>
            ) : (
              <form onSubmit={onSubmit} noValidate>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                  <div>
                    <label style={labelStyle} htmlFor="name">Full name *</label>
                    <input id="name" name="name" required style={fieldStyle} autoComplete="name" />
                  </div>

                  <div>
                    <label style={labelStyle} htmlFor="clinic">Clinic / Practice name *</label>
                    <input id="clinic" name="clinic" required style={fieldStyle} />
                  </div>

                  <div>
                    <label style={labelStyle} htmlFor="email">Work email *</label>
                    <input id="email" name="email" type="email" required style={fieldStyle} autoComplete="email" />
                  </div>

                  <div>
                    <label style={labelStyle} htmlFor="phone">Phone number</label>
                    <input id="phone" name="phone" type="tel" style={fieldStyle} autoComplete="tel" />
                  </div>

                  <div>
                    <label style={labelStyle} htmlFor="doctorCount">Number of doctors *</label>
                    <select id="doctorCount" name="doctorCount" defaultValue="" required style={{ ...fieldStyle, appearance: 'auto' }}>
                      <option value="" disabled>Select...</option>
                      <option value="1">1</option>
                      <option value="2-5">2-5</option>
                      <option value="6-10">6-10</option>
                      <option value="11-20">11-20</option>
                      <option value="21+">21+</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle} htmlFor="preferredDate">Preferred demo date</label>
                    <input id="preferredDate" name="preferredDate" type="date" min={new Date().toISOString().slice(0, 10)} style={fieldStyle} />
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle} htmlFor="preferredTime">Preferred demo time</label>
                    <select id="preferredTime" name="preferredTime" defaultValue="" style={{ ...fieldStyle, appearance: 'auto' }}><option value="">No preference</option>{['9:00 AM','9:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','12:30 PM','1:00 PM','1:30 PM','2:00 PM','2:30 PM','3:00 PM','3:30 PM','4:00 PM','4:30 PM'].map(time => <option key={time} value={time}>{time}</option>)}</select>
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle} htmlFor="message">Additional message</label>
                    <textarea id="message" name="message" rows={4} style={{ ...fieldStyle, resize: 'vertical', minHeight: 112 }} />
                  </div>
                </div>

                {error ? (
                  <div style={{ marginTop: 16, padding: '10px 12px', borderRadius: 10, background: '#fff1f2', color: '#b42318', fontSize: 14, border: '1px solid #f3d7d8' }}>
                    {error}
                  </div>
                ) : null}

                <div style={{ marginTop: 18, fontSize: 12, color: '#6d7d8d', lineHeight: 1.5 }}>
                  By submitting, you agree that Klinicals may contact you about your demo request. Please do not include sensitive patient information.
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  style={{
                    width: '100%',
                    marginTop: 20,
                    border: 'none',
                    borderRadius: 12,
                    padding: '18px 20px',
                    background: '#0e69d8',
                    color: '#fff',
                    fontSize: 20,
                    fontWeight: 800,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    opacity: busy ? 0.8 : 1,
                  }}
                >
                  {busy ? 'Sending...' : 'Request My Free Demo'} →
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
