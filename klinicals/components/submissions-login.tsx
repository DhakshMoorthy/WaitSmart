'use client'

import { useState, type FormEvent } from 'react'

export function SubmissionsLogin() {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const password = new FormData(event.currentTarget).get('password')
    try {
      const response = await fetch('/api/private-submissions/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not sign in.')
      window.location.reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="private-login"><form className="private-login-card" onSubmit={submit}>
    <span className="eyebrow">Private area</span><h1 className="title">Contact submissions</h1>
    <p className="lead">Enter the dashboard password to continue.</p>
    <label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required />
    {error && <p className="private-error" role="alert">{error}</p>}
    <button className="btn" disabled={busy}>{busy ? 'Checking…' : 'Sign in'}</button>
  </form></main>
}
