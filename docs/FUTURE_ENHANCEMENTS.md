# WaitSmart — Future Enhancements

Items deferred for later phases: external integrations, production infrastructure packages, and optional paid services. The core booking + queue flow can be built and tested with **PostgreSQL**, **Redis**, and the **self-hosted API** only.

Related docs: [ARCHITECTURE.md](./ARCHITECTURE.md) · [API.md](./API.md)

---

## Licensing & usage (npm packages)

Most backend npm dependencies are **open source** (MIT, Apache 2.0, ISC, etc.) and can be used in the application without purchasing a license.

| Category | Examples | License / cost |
|----------|----------|----------------|
| Core stack | Express, Drizzle, pg, Redis client, Socket.io, Zod, bcryptjs, JWT, Winston, Multer, dayjs | Open source — free to use |
| Integration SDKs | `firebase-admin`, `razorpay`, `nodemailer`, Twilio SDK, `@aws-sdk/client-s3` | SDK is open source; **connected service may be paid** |

**Note:** Free npm packages ≠ free external services. Razorpay, Firebase, SMTP, SMS, and object storage require vendor accounts and often usage-based billing.

---

## API services — what we build vs what we integrate

### Built in-house (not third-party)

The WaitSmart API is implemented in `server/` — Express + TypeScript domain modules. Clients (`mobile/`, `admin/`, `superadmin/`) call this API.

| Module | Route prefix | Enhancement status |
|--------|--------------|-------------------|
| Auth | `/auth` | OTP auth pending |
| Tenant | `/tenants` | Branding / subdomain fields in schema; full onboarding UX pending |
| Clinic | `/clinics` | Stub — implement CRUD |
| Doctor | `/doctors` | Stub — schedules, availability, breaks |
| Booking | `/avail`, `/book` | Stub — cancel, reschedule, waitlist |
| Queue | `/admin/*` | Stub — next, skip, no-show, done + WS emits |
| Notification | `/notifications` | Stub — push, email, SMS |
| Billing | `/billing` | Stub — Razorpay webhooks |
| Analytics | `/analytics` | Stub — daily stats, wait times, revenue |
| Patient | `/patients` | Stub — profile, history, favorites, family |
| File | `/files` | Stub — upload, serve |

### External APIs (future integrations)

Connect from the backend using env vars in `server/.env`. Add when the corresponding product feature is ready.

| Service | Provider options | Purpose | Env vars |
|---------|------------------|---------|----------|
| Payments | Razorpay | Subscriptions, payment webhooks | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` |
| Push notifications | Firebase FCM | Queue alerts (“Your turn is next”) | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` |
| Email | SMTP (SES, Resend, etc.) | Booking confirmations | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, … |
| SMS | MSG91 or Twilio | Booking / queue SMS | `SMS_PROVIDER`, `SMS_API_KEY`, `SMS_SENDER_ID` |
| Object storage | Oracle OCI or S3-compatible | Photos, prescriptions | `STORAGE_PROVIDER`, `STORAGE_BUCKET`, … |

---

## Infrastructure (current vs future)

### In use now (local development)

| Component | Technology | Location |
|-----------|------------|----------|
| Primary database | **PostgreSQL 16** | `infra/docker/docker-compose.yml` |
| Cache / sessions / jobs (planned) | **Redis 7** | Same Docker Compose file |
| API | Node.js + Express | `server/` — `pnpm dev:server` |
| Reverse proxy (production) | **Nginx** | `infra/nginx/nginx.conf` |

Start local data services:

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

### Future production hosting

Architecture diagram targets **Oracle** for compute and VCN. Alternatives are acceptable:

- Docker on Oracle Cloud, AWS, Azure, or any VPS
- Managed PostgreSQL / Redis instead of self-hosted containers
- Nginx (or cloud load balancer) in front of the API + Socket.io

---

## npm packages — add when scaling (future)

Already installed in `server/package.json` for core + most integrations. Install the following when implementing the related feature:

| Package | When to add | Purpose |
|---------|-------------|---------|
| `twilio` or `axios` | SMS notifications | MSG91 (REST) or Twilio SDK |
| `@aws-sdk/client-s3` | File service | OCI / S3 object storage |
| `ioredis` | Redis-backed features | BullMQ, rate-limit adapter |
| `bullmq` | Notification / analytics jobs | Async background work |
| `rate-limit-redis` | Production rate limiting | Shared limit state across instances |
| `@socket.io/redis-adapter` | Multi-instance API | Scale live queue WebSocket |
| `node-cron` | Analytics module | Daily stats aggregation |
| `compression` | Production API | Gzip responses |
| `sharp` | File uploads (optional) | Image resize / thumbnails |
| `otp-generator` or `crypto` | Auth OTP | Phone verification codes |

Example (when ready):

```bash
pnpm --filter @waitsmart/server add @aws-sdk/client-s3 @socket.io/redis-adapter bullmq ioredis rate-limit-redis node-cron compression twilio
pnpm --filter @waitsmart/server add -D @types/compression
```

---

## Suggested implementation order

Phases that keep external cost and complexity low early:

1. **Core only** — Postgres + Redis + API: clinic → doctor → booking → queue + Socket.io
2. **Notifications** — SMTP email first (cheapest to test), then Firebase push, then SMS
3. **Billing** — Razorpay when tenant subscriptions go live
4. **Files** — Object storage when prescriptions / photos are required
5. **Production hardening** — Nginx, Redis adapters, BullMQ, managed DB/hosting

---

## Database & schema enhancements (future)

Tables / fields not yet in schema but implied by architecture:

| Area | Enhancement |
|------|-------------|
| Doctor | `doctor_schedules`, breaks, availability rules |
| Patient | Family members, favorites, extended profile |
| Analytics | `daily_stats` or materialized aggregates |
| Auth | OTP storage (Redis), refresh token revocation |
| Queue | Redis cache for hot queue state (optional alongside Postgres) |

Run after schema changes:

```bash
pnpm db:generate
pnpm db:migrate
```

---

## Summary

| Question | Answer |
|----------|--------|
| Are npm packages open source? | Yes — most are; SDKs for paid services are still open source |
| Where does the main API come from? | Built in `server/` — not a third-party SaaS |
| Database? | **PostgreSQL** (Docker locally) |
| Hosting? | **Docker** for local Postgres/Redis; production flexible (Oracle per architecture, or any cloud) |
| What can wait? | Razorpay, Firebase, SMS, object storage, and scaling packages until those features ship |
