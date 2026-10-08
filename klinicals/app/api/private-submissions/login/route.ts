import { NextResponse } from 'next/server'
import { passwordMatches, sessionValue, submissionsCookieName } from '@/lib/submissions-auth'

export async function POST(request: Request) {
  let body: { password?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Enter the dashboard password.' }, { status: 400 })
  }

  if (typeof body.password !== 'string' || !passwordMatches(body.password)) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(submissionsCookieName, sessionValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/private-submissions',
    maxAge: 60 * 60 * 12,
  })
  return response
}
