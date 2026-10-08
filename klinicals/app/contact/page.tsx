'use client'

import { useState, type FormEvent } from 'react'
import { Logo } from '@/components/site'

export default function ContactPage() {
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = event.currentTarget
    const data = Object.fromEntries(new FormData(form).entries())
    try {
      const response = await fetch('/api/contact-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, requestType: 'contact' }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Please check your information and try again.')
      setSent(true)
      form.reset()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send your message. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="contact-page"><div className="contact-shell"><header><Logo/><a className="contact-back" href="/">Back to home</a></header><div className="contact-content">
    <section><span className="eyebrow">Contact Klinicals</span><h1 className="title">Let’s talk about your clinic.</h1><p className="lead">Send us a message and our team will follow up with you.</p></section>
    <section className="form-card card contact-card">{sent ? <div className="success"><div className="check">✓</div><h2>Message received.</h2><p>Thanks for contacting us. We’ll get back to you soon.</p></div> : <form onSubmit={submit}><div className="form-grid">
      <FormField label="Full name *" name="name" required/><FormField label="Work email *" name="email" type="email" required/><FormField label="Clinic / Practice name" name="clinic"/><FormField label="Phone number" name="phone" type="tel"/><FormField label="Subject *" name="subject" required wide/><FormField label="Message *" name="message" textarea required wide/>
    </div>{error && <p className="private-error" role="alert">{error}</p>}<button className="btn" disabled={busy}>{busy ? 'Sending…' : 'Send message'}</button></form>}</section>
  </div></div></main>
}

function FormField({ label, name, type = 'text', required = false, wide = false, textarea = false }: { label: string; name: string; type?: string; required?: boolean; wide?: boolean; textarea?: boolean }) {
  return <div className={`field ${wide ? 'wide' : ''}`}><label htmlFor={name}>{label}</label>{textarea ? <textarea id={name} name={name} required={required} rows={6}/> : <input id={name} name={name} type={type} required={required}/>}</div>
}
