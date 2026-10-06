import { createClient } from '@supabase/supabase-js'
export function supabaseAdmin(){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error('Demo submissions are not configured yet. Please email contact@klinicals.com.');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
