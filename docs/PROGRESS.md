# WaitSmart Backend — Implementation Progress

Tracks completion of each phase from the implementation plan.

---

## Phase 0 — Database Foundation

**Status:** Complete  
**Completed:** 2026-07-04

**Tasks:**
- [x] Create seed script (`server/src/db/seeds/index.ts`)
- [x] Seeds: superadmin, tenant (Apollo Clinic), admin, doctor (Dr. Priya), patient (Rajesh)
- [ ] Generate Drizzle migrations (`pnpm db:generate`) — requires running Docker
- [ ] Run migrations + seed — requires running Docker

**Routes activated:** 0 (infrastructure)  
**Notes:** Migrations auto-generate from schema. Run `docker compose up -d` then `pnpm db:generate && pnpm db:migrate && pnpm db:seed`.

---

## Phase 1 — Clinic + Doctor CRUD

**Status:** Complete  
**Completed:** 2026-07-04

**Tasks:**
- [x] `clinic.validator.ts` — create/update Zod schemas
- [x] `clinic.service.ts` — CRUD with `tenantScope()`
- [x] `clinic.controller.ts` — validate + respond
- [x] `clinic.router.ts` — real handlers replacing stubs
- [x] `doctor.validator.ts` — CRUD + schedule + break schemas
- [x] `doctor.service.ts` — CRUD, schedules, breaks
- [x] `doctor.controller.ts`
- [x] `doctor.router.ts` — 9 routes active
- [x] `doctorSchedules.ts` schema (day-of-week, start/end, slot duration)
- [x] `doctorBreaks.ts` schema (date range + reason)

**Routes activated:** 14 (5 clinic + 9 doctor)

---

## Phase 2 — Booking Engine

**Status:** Complete  
**Completed:** 2026-07-04

**Tasks:**
- [x] `booking.validator.ts` — availability, create, cancel, reschedule
- [x] `booking.service.ts` — slot generation from schedule, booking with token#, cancel, reschedule
- [x] `booking.controller.ts`
- [x] `booking.router.ts` — 4 routes active
- [x] Socket.io `booking:created` emit on new booking

**Routes activated:** 4 (`GET /avail`, `POST /book`, `POST /cancel`, `POST /reschedule`)  
**Key logic:** Slots auto-generated from doctor schedule on first availability query. Token number increments per doctor/date.

---

## Phase 3 — Queue Engine + Socket.io

**Status:** Complete  
**Completed:** 2026-07-04

**Tasks:**
- [x] `queue.validator.ts` — doctorId + date body schema
- [x] `queue.service.ts` — next, skip, no-show, done (state machine)
- [x] `queue.controller.ts`
- [x] `queue.router.ts` — 4 routes active
- [x] Socket.io `queue:update` emits after every state change
- [x] `getIO()` now actively used for real-time broadcasts

**Routes activated:** 4 (`POST /admin/next`, `/skip`, `/no-show`, `/done`)  
**Socket events live:** `queue:update`, `booking:created`

---

## Phase 4 — Notification Service

**Status:** Complete  
**Completed:** 2026-07-04

**Tasks:**
- [x] `services/notifications/email.ts` — Nodemailer wrapper (dev: console log)
- [x] `services/notifications/push.ts` — Firebase FCM (dev: console log)
- [x] `services/notifications/sms.ts` — Twilio wrapper (dev: console log)
- [x] `services/notifications/index.ts` — multi-channel dispatch facade
- [x] `notification.validator.ts` + `notification.controller.ts` + `notification.router.ts`
- [x] `notifyBookingConfirmed()` + `notifyYourTurnNext()` helper functions

**Routes activated:** 1 (`POST /notifications/test`)  
**Notes:** All channels log to console in dev mode. Wire real providers via env vars.

---

## Phase 5 — Patient Module

**Status:** Complete  
**Completed:** 2026-07-04

**Tasks:**
- [x] `patientFavorites.ts` schema (unique per patient+doctor)
- [x] `familyMembers.ts` schema (name, relationship, age, phone)
- [x] `patient.validator.ts` — profile, favorites, family schemas
- [x] `patient.service.ts` — profile, history, favorites, family CRUD
- [x] `patient.controller.ts`
- [x] `patient.router.ts` — 7 routes active

**Routes activated:** 7

---

## Phase 6 — Billing (Razorpay)

**Status:** Complete  
**Completed:** 2026-07-04

**Tasks:**
- [x] `services/razorpay.ts` — create subscription, verify webhook signature
- [x] `billing.validator.ts`
- [x] `billing.service.ts` — plans, subscribe, webhook handler
- [x] `billing.controller.ts`
- [x] `billing.router.ts` — 4 routes active
- [x] Webhook signature verification (HMAC SHA256)
- [x] Plan catalog (Basic/Pro/Enterprise)

**Routes activated:** 4 (`GET /billing/plans`, `POST /billing/subscribe`, `GET /billing/subscription`, `POST /billing/webhooks/razorpay`)

---

## Phase 7 — Analytics + File Service

**Status:** Complete  
**Completed:** 2026-07-04

**Tasks:**
- [x] `analytics.validator.ts` + `analytics.service.ts` + `analytics.controller.ts` + `analytics.router.ts`
- [x] Aggregate queries: daily stats, avg wait time, no-show rate, revenue
- [x] `files.ts` schema (metadata: filename, mime, size, storage key)
- [x] `services/storage.ts` — local fallback + S3/OCI placeholder
- [x] `file.validator.ts` + `file.service.ts` + `file.controller.ts` + `file.router.ts`
- [x] Multer memory storage + 10MB limit

**Routes activated:** 6 (4 analytics + 2 file)

---

## Phase 8 — Auth OTP + Production Hardening

**Status:** Complete  
**Completed:** 2026-07-04

**Tasks:**
- [x] `auth.otp.service.ts` — Redis-backed OTP (5min TTL), auto-register on verify
- [x] `auth.validator.ts` updated — `otpSendBody`, `otpVerifyBody`
- [x] `auth.controller.ts` updated — `otpSend`, `otpVerify` handlers
- [x] `auth.router.ts` — OTP stubs replaced with real handlers
- [x] `_shared/pagination.ts` utility

**Routes activated:** 2 (`POST /auth/otp/send`, `POST /auth/otp/verify`)  
**Notes:** OTP stored in Redis with TTL. New user auto-created on first OTP login.

---

## Summary

| Metric | Value |
|--------|-------|
| Total routes implemented | **50 of 52** |
| Modules complete | **11 of 11** |
| Schema tables | **15** (10 original + 5 new) |
| Service wrappers | 4 (notifications x3 + razorpay + storage) |
| Socket events live | 2 (`queue:update`, `booking:created`) |

**Remaining (infrastructure only):**
- Run Docker + generate migrations + run seed (requires Docker running)
- Wire real external API keys when ready to test integrations
- Redis-backed rate limiting + Socket.io Redis adapter (production scaling)

---

## Integration Testing

**Status:** PASSED — 72/72 tests  
**Executed:** 2026-07-04

**Results:**
```
Test Files  10 passed (10)
     Tests  72 passed (72)
```

**Bugs found and fixed during the run:**
1. Booking router mounted at `/` applied `requireAuth` to all routes (blocked public `/billing/plans` and webhooks) — auth moved to per-route
2. Token numbers always `1` because count used `createdAt` date instead of slot date — fixed to join `slots` and filter by `slots.date`
3. Queue actions returned 500 when Socket.io was not initialized (tests) — emit wrapped in try/catch
4. `drizzle-kit push` requires TTY — added non-interactive `tests/schema.sql` + `tests/push-test-schema.ts`

**Setup:**
- Docker: Postgres 16 + Redis 7 (`infra/docker/docker-compose.yml`)
- Test DB: `waitsmart_test` (auto-created by `pretest`)
- Schema applied via `pnpm db:push:test`
- Vitest + Supertest, Redis DB 1, table truncate between runs

**Test coverage:**
| File | Module | Cases |
|------|--------|-------|
| `auth.test.ts` | Register, Login, Refresh, OTP | 10 |
| `tenant.test.ts` | CRUD, Deactivate, Auth guards | 9 |
| `clinic.test.ts` | CRUD, Tenant isolation | 7 |
| `doctor.test.ts` | CRUD, Schedules, Breaks | 8 |
| `booking.test.ts` | Availability, Book, Cancel, Reschedule | 9 |
| `queue.test.ts` | Next, Done, Skip, No-Show, RBAC | 7 |
| `patient.test.ts` | Profile, History, Favorites, Family | 7 |
| `billing.test.ts` | Plans, Subscribe, Webhooks | 5 |
| `analytics.test.ts` | Daily, Wait times, No-shows, Revenue | 5 |
| `file.test.ts` | Upload, Serve, Type validation | 5 |
| **Total** | | **72** |

**Re-run:**
```bash
docker compose -f infra/docker/docker-compose.yml up -d
cd E:\WaitSmart\server
pnpm test
```

**Next steps (completed in E2E pass):**
- [x] Seed data on main DB (`pnpm db:seed`)
- [x] Mobile web OTP login (dev OTP shown on verify screen)
- [x] Patient booking + doctor queue verified end-to-end via API

---

## Mobile Frontend (Expo)

**Status:** Complete — all screens implemented  
**Completed:** 2026-07-04

**Tech stack:**
- Expo ~52, Expo Router ~4 (file-based navigation)
- React Native 0.76 (New Architecture)
- Zustand (state management)
- Axios (HTTP with auth interceptor + token refresh)
- Socket.io Client (real-time queue updates)
- Expo Secure Store (token persistence)
- dayjs (date formatting)

**Architecture:**
- `src/theme/` — design tokens (colors, typography, spacing, radius)
- `src/components/ui/` — reusable components (Button, Input, Card, Badge, LoadingScreen, EmptyState)
- `src/services/api.ts` — Axios instance with JWT interceptor + automatic token refresh
- `src/services/socket.ts` — Socket.io client with queue subscription helpers
- `src/stores/auth.ts` — Zustand auth store (hydration from SecureStore)
- `src/stores/queue.ts` — Zustand queue state for real-time updates
- `src/utils/storage.ts` — SecureStore wrapper for tokens/user data

**Navigation (role-based):**
- `(auth)/` — Login (OTP), Verify (6-digit code)
- `(patient)/` — Tabs: Home, Bookings, Profile + nested: Clinics, Doctors, Slots, BookConfirm, Ticket
- `(doctor)/` — Tabs: Queue, Schedule, Profile

**Screens implemented:**

| Route | Screen | Features |
|-------|--------|----------|
| `(auth)/login` | OTP Phone Login | Phone input, +91 prefix, OTP send |
| `(auth)/verify` | OTP Verification | 6-digit code input, auto-submit, resend timer |
| `(patient)/home` | Patient Home | Greeting, book CTA, quick actions, "how it works" |
| `(patient)/clinics` | Clinic List | Fetch clinics, tap to select |
| `(patient)/doctors` | Doctor List | Doctors by clinic, queue status badges |
| `(patient)/slots` | Slot Selection | 7-day date picker, time slot grid |
| `(patient)/book-confirm` | Booking Form | Patient details, symptoms, confirm |
| `(patient)/ticket` | Live Ticket | Token display, Socket.io queue tracking |
| `(patient)/bookings` | Booking History | Past/active appointments list |
| `(patient)/profile` | Patient Profile | User info, logout |
| `(doctor)/queue` | Queue Management | Now serving, waiting list, Next/Done/Skip/No-Show |
| `(doctor)/schedule` | Schedule View | Weekly hours, breaks |
| `(doctor)/doctor-profile` | Doctor Profile | User info, logout |

**To run the mobile app:**
```bash
cd E:\WaitSmart
pnpm install
cd mobile
pnpm start         # Expo dev server
pnpm android       # Android emulator
pnpm ios           # iOS simulator
```

**Requires backend running on port 4000 for API calls.**

### E2E fixes (2026-07-04)

- OTP patients auto-assigned to default tenant (`apollo-clinic`) so clinics/booking work
- OTP response includes `doctorId` for doctor accounts
- Doctor queue/schedule use `doctorId` (not `users.id`)
- Availability API attaches appointment details on booked slots
- Patient history returns doctor name + slot date/time
- Dev OTP shown on verify screen (no SMS provider required)
- Slot times stored/displayed as wall-clock UTC

**Try it (web):**
1. Patient: phone `9876543210` → OTP on screen → Book Now → clinic → doctor → slot → confirm
2. Doctor: phone `9999900002` → OTP on screen → Queue → Call Next / Done

Keep API (`pnpm dev` in `server/`) and Expo (`pnpm web` in `mobile/`) running.
