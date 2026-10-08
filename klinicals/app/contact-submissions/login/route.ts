import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const form = await request.formData()
  const token = String(form.get('token') || '')
  const expected = process.env.ADMIN_DASHBOARD_TOKEN

  if (!expected || token !== expected) {
    return NextResponse.redirect(new URL('/admin/leads?error=unauthorized', request.url), 303)
  }

  const response = NextResponse.redirect(new URL('/contact-submissions', request.url), 303)
  response.cookies.set('klinicals_admin', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 8,
  })
  return response
}
