import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const form = await request.formData()
  const response = NextResponse.redirect(new URL('/admin/leads', request.url), 303)
  return response
}
