# Klinicals marketing website

Next.js App Router marketing site for Klinicals. Demo requests are validated on the server and saved to the `demo_leads` table in Supabase.

## Local development

1. Install dependencies with `npm install`.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Set `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in the server environment.
4. Start with `npm run dev`.

Demo and contact forms send submissions to `/api/contact-request` and are stored in `demo_leads`. Contact type and subject use the table's existing `current_system` and `goal` columns, so no schema migration is required. The secret key is used only by server routes and must never be exposed to browser code. The unlinked `/private-submissions` dashboard requires `ADMIN_DASHBOARD_PASSWORD` (defaults to `2921` if unset); it supports filters and CSV export.
