# Klinicals marketing website

Next.js App Router marketing site for Klinicals. Demo requests are validated server-side, stored in Supabase, and optionally notified through Resend.

## Local development

1. Install dependencies with `npm install`.
2. Copy `.env.local.example` to `.env.local` and fill in service credentials.
3. Run the SQL in `supabase/schema.sql` in the Supabase SQL editor.
4. Start with `npm run dev`.

Without Supabase configured, the form returns a clear configuration error and does not claim that an enquiry was received. Email notifications are optional; configure Resend with a verified sender to enable them.

## Vercel environment variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `ADMIN_DASHBOARD_TOKEN` (long random secret)
- `RESEND_API_KEY` (optional until email notifications are activated)
- `RESEND_FROM_EMAIL` (optional verified sender)

The lead table has row level security enabled and no public policies. Only server routes using the service role can access it. `/admin/leads` uses an environment token sent as an HttpOnly, Secure-in-production, SameSite cookie. Restrict and rotate this token as part of production operations.
