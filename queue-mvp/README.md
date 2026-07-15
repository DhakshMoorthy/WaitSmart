# WaitSmart — Live Queue (queue-mvp)

Production frontend for WaitSmart. Mobile-first React UI (migrated from kvt-hospital design) connected to the WaitSmart Express/PostgreSQL/Redis backend on Render.

## Stack

- React 19 + TypeScript + Vite 6 + Tailwind CSS v4
- WaitSmart API (`VITE_API_URL`) — JWT auth, REST, Socket.io
- No Firebase — all data from Render backend

## Features

- **Patient flow** — OTP gate at login, clinic picker, doctor profiles, dynamic slot booking, live token tracking, saved tokens on home, appointment history at `/track`
- **Admin dashboard** — staff email/password login, calendar, queue control (Next / Skip / No Show / End)
- **Real-time sync** — Socket.io `queue:update` and `booking:created` with live badge
- **WaitSmart branding** — professional blue medical UI

## Local development

**Terminal 1 — backend** (from repo root):

```bash
cd server && pnpm dev
```

API runs at http://localhost:4000 (requires `DATABASE_URL` + `REDIS_URL`).

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

## Backend limitations (v1)

These kvt-hospital demo features are **not** available without backend changes:

| Feature | Status |
|---------|--------|
| Undo last action | Hidden — no API |
| Reset queue | Hidden — no API |
| Manual per-appointment status dropdown | Hidden — no PATCH endpoint |
| Doctor notes on appointments | Hidden — no DB column |
| Booking file attachments | Hidden — files not linked to appointments |
| Client-side demo OTP | Replaced by server 6-digit Redis OTP |
| Admin passcode | Replaced by JWT staff login |
| Browse/book without login | Replaced by OTP gate (backend requires JWT) |

## Deploy (production)

Render static site `waitsmart-web` builds from `queue-mvp/dist` (see root `render.yaml`).

| Field | Value |
|-------|--------|
| **Build Command** | `npm install -g pnpm@9.15.4 && cd queue-mvp && pnpm install && pnpm build` |
| **Publish Directory** | `queue-mvp/dist` |

API URL is set via `queue-mvp/.env.production` (`VITE_API_URL=https://waitsmart-api.onrender.com`).

## Architecture

```
src/pages/       — React routes (Home, Doctors, Book, Token, Track, Admin, Login, Verify)
src/components/  — UI components (Header, ClinicCard, LiveBadge, AdminCalendar, …)
src/lib/db.ts    — Backend adapter (kvt-compatible API surface → REST + Socket.io)
src/lib/api.ts   — fetch wrapper, JWT refresh, wakeApi()
src/lib/auth.ts  — localStorage JWT state
src/lib/mappers.ts — camelCase → snake_case, slot grouping
src/lib/socket.ts  — Socket.io client
```

The legacy vanilla JS frontend (`js/`, `css/`) has been replaced by this React app.
