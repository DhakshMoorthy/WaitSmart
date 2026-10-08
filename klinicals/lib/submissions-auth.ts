import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

export const submissionsCookieName = 'klinicals_submissions_session'
const password = () => process.env.ADMIN_DASHBOARD_PASSWORD || '2921'

function sessionValue() {
  return createHmac('sha256', password()).update('klinicals-private-submissions-v1').digest('hex')
}

export function passwordMatches(candidate: string) {
  const expected = Buffer.from(password())
  const received = Buffer.from(candidate)
  return expected.length === received.length && timingSafeEqual(expected, received)
}

export function hasSubmissionsSession() {
  const received = cookies().get(submissionsCookieName)?.value
  if (!received) return false
  const expected = Buffer.from(sessionValue())
  const actual = Buffer.from(received)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export { sessionValue }
