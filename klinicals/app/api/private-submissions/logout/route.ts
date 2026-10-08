import { NextResponse } from 'next/server'
import { submissionsCookieName } from '@/lib/submissions-auth'

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL('/private-submissions', request.url), 303)
  response.cookies.set(submissionsCookieName, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/private-submissions', maxAge: 0 })
  return response
}
