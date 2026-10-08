# Klinicals marketing website

Next.js App Router marketing site for Klinicals. Demo requests are validated on the server and saved to the `demo_leads` table in Supabase.

## Local development

1. Install dependencies with `npm install`.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Set `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in the server environment.
4. Start with `npm run dev`.

The demo form sends submissions to `/api/contact-request`. The secret key is used only by the server route and must never be exposed to browser code. If the database insert fails, the form reports an error and the server logs the database message.
