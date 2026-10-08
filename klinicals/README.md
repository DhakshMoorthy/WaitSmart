# Klinicals marketing website

Next.js App Router marketing site for Klinicals. Demo requests are validated server-side, stored in Supabase, and optionally notified through Resend.

## Local development

1. Install dependencies with `npm install`.
2. Copy `.env.local.example` to `.env.local` and fill in service credentials.
3. Run the SQL in `supabase/schema.sql` in the Supabase SQL editor.
4. Start with `npm run dev`.

Without Supabase configured, local forms show a preview confirmation and do not save submissions. Configure Supabase locally to test database writes. Email notifications are optional; configure Resend with a verified sender to enable them.

## Vercel environment variables

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (server only; `SUPABASE_SERVICE_ROLE_KEY` is also accepted as a legacy name)
- `ADMIN_DASHBOARD_TOKEN` (long random secret)
- `RESEND_API_KEY` (optional until email notifications are activated)
- `RESEND_FROM_EMAIL` (optional verified sender)

Run `supabase/schema.sql` in the Supabase SQL editor to create the lead table. The table has row level security enabled and no public policies. Only server routes using the server-side secret key can access it. `/admin/leads` requires `ADMIN_DASHBOARD_TOKEN`, stored in an HttpOnly, Secure-in-production, SameSite cookie after sign-in. Configure that token separately from the Supabase key; the sign-in page reports when it is missing or incorrect.
