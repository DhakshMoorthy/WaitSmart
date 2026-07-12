# WaitSmart — Live Queue (queue-mvp)

Production frontend for WaitSmart. Mobile-first queue UI connected to the WaitSmart Express/PostgreSQL backend.

## Features

- **Patient flow** — OTP login, clinic picker, doctor profiles, slot booking, live token tracking
- **Admin dashboard** — email/password login (admin or doctor role), queue control (Next / Skip / No Show)
- **Real-time sync** — Socket.io `queue:update` and `booking:created` events
- **WaitSmart branding** — professional blue medical UI (from queue-mvp)

## Local development

**Terminal 1 — backend** (from repo root):

```bash
# Docker Postgres + Redis, or your existing local stack
cd server && pnpm dev
```

API runs at http://localhost:4000

**Terminal 2 — frontend**:

```bash
cd queue-mvp
cp .env.example .env
pnpm install
pnpm dev
```

App opens at http://localhost:5173

### Test credentials (from backend seed)

| Role | Login method | Credentials |
|------|--------------|-------------|
| Patient | OTP at `/login` | Any phone; use `devOtp` shown when SMS is not configured |
| Admin | `/admin` email login | `admin@apollo.waitsmart.app` / `Admin@1234` |
| Doctor | `/admin` email login | `priya@apollo.waitsmart.app` / `Doctor@1234` |

## Deploy (production)

### Option A — Render static site (recommended; works on free tier)

1. Render Dashboard → **New** → **Static Site**
2. Connect GitHub repo `WaitSmart`
3. Settings:
   - **Name:** `waitsmart-web`
   - **Root Directory:** leave blank (repo root)
   - **Build Command:** `npm install -g pnpm@9.15.4 && cd queue-mvp && pnpm install && pnpm build`
   - **Publish Directory:** `queue-mvp/dist`
4. Add **Rewrite rule:** `/*` → `/index.html` (SPA routing for `/admin`, `/login`, etc.)
5. Deploy — URL will be like `https://waitsmart-web.onrender.com`
6. Add that URL to Render API `CORS_ORIGINS` on `waitsmart-api`

API URL is baked in via `queue-mvp/.env.production` (`VITE_API_URL=https://waitsmart-api.onrender.com`).

### Option B — Vercel (personal account only)

Vercel **Hobby teams** cannot promote production deployments. Use a **personal** Vercel account (not a team), or upgrade to Pro.

1. Move/import project to personal account
2. Root Directory → `queue-mvp`
3. Disable Deployment Protection for production
4. Redeploy

## Deploy (Vercel — if using personal account)

1. Set Vercel project **Root Directory** to `queue-mvp`
2. Environment variable: `VITE_API_URL=https://waitsmart-api.onrender.com`
3. Add the Vercel URL to Render `CORS_ORIGINS`
4. Redeploy Vercel (clear build cache if env changed)

## Architecture

- UI pages: `js/pages/*.js` (unchanged queue-mvp screens)
- Data layer: `js/db.js` — REST + Socket.io adapter to WaitSmart backend
- Auth: `js/auth.js` + `js/api.js` (JWT with auto-refresh)
- Mapping: `js/mappers.js` — translates backend camelCase to MVP snake_case shapes

The legacy Firebase/localStorage code path has been removed. The previous `web/` UI remains in the repo for reference.
