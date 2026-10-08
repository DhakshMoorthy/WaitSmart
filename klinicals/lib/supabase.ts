import { createClient } from '@supabase/supabase-js'

export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY in the deployment environment.')
  }

  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
