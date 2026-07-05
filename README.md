# WaitSmart

Multi-tenant doctor appointment booking + live queue SaaS.

Architecture reference: [docs/WaitSmart_Architecture-screenshot.png](docs/WaitSmart_Architecture-screenshot.png)  
Alignment matrix: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)  
API contract: [docs/API.md](docs/API.md)

## Structure

| Package | Stack | Purpose |
|---------|-------|---------|
| `server/` | Node.js + Express + TypeScript | API — 10 domain modules |
| `mobile/` | React Native + Expo | Patient + Doctor app (role-based) |
| `admin/` | Next.js | Clinic admin dashboard |
| `superadmin/` | Next.js | Tenant + billing management |
| `packages/shared/` | TypeScript | Types, validators, constants |
| `queue-mvp/` | Vite + Firebase Firestore | **Simplified queue MVP** (no auth, live tokens) |
| `infra/` | Docker, Nginx | Postgres, Redis, production gateway |

## API modules (server)

| Module | Routes | Status |
|--------|--------|--------|
| auth | `/auth/*` | Login, register, refresh done; OTP stub |
| tenant | `/tenants/*` | Superadmin CRUD done |
| clinic | `/clinics` | Stub |
| doctor | `/doctors` | Stub |
| booking | `/avail`, `/book` | Stub |
| queue | `/admin/next`, skip, done | Stub |
| notification | `/notifications` | Stub |
| billing | `/billing` | Stub |
| analytics | `/analytics` | Stub |
| patient | `/patients` | Stub |
| file | `/files` | Stub |

## Setup

```bash
pnpm install
docker compose -f infra/docker/docker-compose.yml up -d
cp server/.env.example server/.env
# Set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET (min 16 chars)
pnpm db:generate
pnpm db:migrate
pnpm dev:server    # API on :4000
pnpm dev:mvp       # Queue MVP on :5173 (no backend needed)
pnpm dev:mobile     # Expo on :8081
pnpm dev:admin      # Admin on :3000
pnpm dev:superadmin # Super Admin on :3001
```

## Booking flow (architecture)

```
GET /clinics → GET /doctors → GET /avail → POST /book
→ WS booking:created → notify → ticket screen
→ WS queue:update → POST /admin/next → push → done
```

Socket events are defined in `@waitsmart/shared` (`SOCKET_EVENTS`).
