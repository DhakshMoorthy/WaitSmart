# WaitSmart — Production Architecture

Reference diagram: [WaitSmart_Architecture-screenshot.png](./WaitSmart_Architecture-screenshot.png)

Multi-tenant SaaS for doctor appointment booking with a live queue.

## Layer overview

| Layer | Components | Repo location |
|-------|------------|---------------|
| Clients | Patient App, Doctor App (Expo), Admin Dashboard (Next.js), Super Admin (Next.js) | `mobile/`, `admin/`, `superadmin/` |
| Gateway | Nginx (SSL, rate limit, proxy), Auth middleware (JWT, RBAC, tenant), Socket.io | `infra/nginx/`, `server/src/middleware/`, `server/src/socket/` |
| API services | 10 domain modules on Express + TypeScript | `server/src/modules/` |
| Data | PostgreSQL, Redis, Object storage (OCI/S3) | `server/src/db/`, `infra/docker/`, env `STORAGE_*` |
| External | Razorpay, Firebase FCM, SMTP, SMS, Oracle compute | `server/.env` |

## API services ↔ code modules

| Architecture service | Module path | Status |
|---------------------|-------------|--------|
| Auth Service (login, register, OTP, refresh, RBAC) | `server/src/modules/auth/` | Partial — login/register/refresh done; OTP pending |
| Tenant Service (onboard, config, branding, subdomain) | `server/src/modules/tenant/` | Partial — CRUD done; branding/subdomain schema added |
| Clinic Service (branches, hours, doctor assignment) | `server/src/modules/clinic/` | Stub |
| Doctor Service (CRUD, schedules, availability, breaks) | `server/src/modules/doctor/` | Stub |
| Booking Engine (slots, tokens, cancel, reschedule, waitlist) | `server/src/modules/booking/` | Stub |
| Queue Engine (state machine, next, skip, no-show) | `server/src/modules/queue/` | Stub — Socket.io subscribe rooms exist |
| Notification Svc (push, email, SMS) | `server/src/modules/notification/` | Stub |
| Billing Service (plans, subscriptions, Razorpay webhooks) | `server/src/modules/billing/` | Stub — DB schema exists |
| Analytics Service (daily stats, wait times, no-show, revenue) | `server/src/modules/analytics/` | Stub |
| Patient Service (profile, history, favorites, family) | `server/src/modules/patient/` | Stub |
| File Service (upload, serve, photos, prescriptions) | `server/src/modules/file/` | Stub |

## Data layer alignment

| Store | Architecture use | Implementation |
|-------|------------------|----------------|
| PostgreSQL | Tenants, users, bookings; row-level tenant isolation | Drizzle schema with `tenantId` on all tenant-scoped tables; `requireTenant` + `tenantScope` middleware |
| Redis | Queue state, sessions, rate limiting, caching | Connected at startup; not yet used in business logic |
| Object storage | Images, documents (OCI/S3) | Env vars defined; module stub only |

## External services alignment

| Service | Env vars | Dependency | Status |
|---------|----------|------------|--------|
| Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | `razorpay` | Package installed; webhook route stub |
| Firebase FCM | `FIREBASE_*` | `firebase-admin` | Package installed; not wired |
| SMTP | `SMTP_*` | `nodemailer` | Package installed; not wired |
| SMS (MSG91/Twilio) | `SMS_PROVIDER`, `SMS_*` | TBD | Env defined; not wired |
| Oracle compute | Deploy target | N/A | Documented in infra README |

## Booking flow (15 steps)

See [API.md](./API.md) for endpoint contracts.

```
Patient App → GET /clinics → pick clinic → GET /doctors → pick doctor
→ GET /avail → pick slot + name/symptoms → POST /book
→ DB insert + WS event → push/SMS notify → ticket screen (WS)
→ queue:update (now_serving) → POST /admin/next → WS broadcast
→ push "You're next!" → status done → analytics + feedback
```

Socket events (planned):

| Event | Direction | Purpose |
|-------|-----------|---------|
| `queue:subscribe` | Client → Server | Join `queue:{doctorId}` room |
| `queue:unsubscribe` | Client → Server | Leave room |
| `queue:update` | Server → Client | Now serving, position changes |
| `booking:created` | Server → Client | New booking in queue |

## Client apps

Architecture shows two Expo apps (Patient + Doctor). The monorepo uses a **single Expo app** (`mobile/`) with role-based navigation — functionally equivalent, easier to maintain.

| App | Screens (planned) | Package |
|-----|-------------------|---------|
| Patient | Book, Track, Notify, Ticket | `mobile/` (patient role) |
| Doctor | Queue, Schedule | `mobile/` (doctor role) |
| Admin | Manage clinics/doctors, analytics | `admin/` |
| Super Admin | Tenants, billing | `superadmin/` |

## Implementation progress

| Area | ~Complete |
|------|-----------|
| Monorepo + shared package | 100% |
| Server foundation (middleware, auth, tenant) | 40% |
| DB schema design | 75% |
| DB migrations + seeds | 0% |
| API business modules | 15% |
| Socket.io live queue | 10% |
| Client apps | 0% |
| Gateway (Nginx) | 5% |
| External integrations | 0% |

## Next implementation order

1. `pnpm db:generate` + `pnpm db:migrate` + seed superadmin
2. Clinic → Doctor → Booking (`GET /avail`, `POST /book`) → Queue (`POST /admin/next` + WS emits)
3. Notification service (push + SMS on book / next)
4. Expo mobile (patient booking + ticket screen)
5. Admin dashboard (queue controls)
6. Billing (Razorpay webhooks) + Super Admin UI
