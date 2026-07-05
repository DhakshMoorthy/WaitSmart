# KVT Hospital — Live Queue MVP

Mobile-first hospital queue system for **KVT Hospital** with real-time token tracking.

## Branches

| Branch | Doctors |
|--------|---------|
| **Moolakadai** | Dr. Hari Prasad (General Medicine, 30 min slots) |
| **Erukenchery** | — (no doctors yet) |

**Hours:** 9 AM – 2 PM, 4 PM – 6 PM

## Quick start

```bash
cd queue-mvp
pnpm install
pnpm dev
```

Open http://localhost:5173

### Patient flow
1. Home → pick **Moolakadai** branch
2. Select **Dr. Hari Prasad**
3. Enter name → get token
4. Watch live queue (30 min estimated wait per patient ahead)

### Admin dashboard
- URL: http://localhost:5173/admin
- Passcode: **4321**
- Manage Dr. Hari Prasad's queue: Next / Skip / No Show

## Deploy

```bash
pnpm build
# Deploy dist/ to Vercel, Firebase Hosting, or Emergent
```

Ensure SPA rewrites are enabled so `/admin` routes correctly.

## Firebase (optional)

Copy `.env.example` → `.env`, then:

```bash
pnpm seed   # seeds KVT branches + Dr. Hari Prasad
```

Without Firebase, demo mode uses browser localStorage (auto-seeded on first visit).
