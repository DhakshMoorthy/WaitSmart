# KVT Hospital — Live Queue

Production-ready hospital queue & appointment system. Mobile-first, real-time, deployable.

## Features

- **Patient app** — clinic cards, doctor profiles, 30-min slot booking, live token tracking
- **Admin dashboard** — passcode protected (`4321`), slot control, queue management
- **Real-time sync** — live updates across patient & admin tabs (WebSocket-style via BroadcastChannel + polling)
- **Per-day queues** — separate queue state per doctor per date
- **KVT branding** — professional blue medical UI

## Branches & Doctors

| Branch | Doctors |
|--------|---------|
| **Moolakadai** | Dr. Karthik Iyer (General Physician), Dr. Vandana Rao (Pediatrician) |
| **Erukenchery** | Dr. Hari Prasad (General Medicine) |

**Hours:** 9 AM – 2 PM, 4 PM – 6 PM · **Slots:** 30 minutes

## Run locally

```bash
pnpm install
pnpm dev:mvp
```

- Patient: http://localhost:5173
- Admin: http://localhost:5173/admin (passcode: **4321**)

## Deploy

```bash
cd queue-mvp && pnpm build
```

Deploy `dist/` to Vercel, Firebase Hosting, or Emergent. Enable SPA rewrites for `/admin`.

## Firebase (production)

1. Copy `.env.example` → `.env`
2. `pnpm seed` — seeds KVT data
3. Deploy Firestore rules + indexes

Without Firebase, runs in local demo mode (browser storage, auto-seeded).

## Admin capabilities

- Select doctor & date
- View Now Serving / Booked / Waiting stats
- Next · Skip · No Show
- Reset queue
- Full bookings list with status chips
