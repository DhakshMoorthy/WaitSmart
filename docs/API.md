# WaitSmart API Contract

Base URL: `http://localhost:4000` (dev) · Production behind Nginx.

Auth: `Authorization: Bearer <accessToken>` unless marked **public**.

Tenant context: resolved from JWT `tenantId` (or `X-Tenant-Id` header for superadmin impersonation — future).

---

## Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | Public | Liveness check |

---

## Auth (`/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | Public | Register user (role: patient/doctor/admin) |
| POST | `/auth/login` | Public | Login, returns access + refresh tokens |
| POST | `/auth/refresh` | Public | Refresh access token |
| POST | `/auth/otp/send` | Public | Send OTP to phone — **planned** |
| POST | `/auth/otp/verify` | Public | Verify OTP — **planned** |

---

## Tenants (`/tenants`) — superadmin only

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tenants` | List tenants |
| GET | `/tenants/:id` | Get tenant |
| POST | `/tenants` | Create tenant |
| PATCH | `/tenants/:id` | Update tenant (name, slug, branding, subdomain) |
| POST | `/tenants/:id/deactivate` | Deactivate tenant |

---

## Booking flow endpoints

These match the architecture diagram step-by-step flow.

### Step 2 — List clinics

```
GET /clinics
```

Query: none (scoped by JWT tenant).

Response `200`:
```json
{
  "data": [
    { "id": "uuid", "name": "Main Branch", "address": "...", "hours": "9am-6pm" }
  ]
}
```

### Step 4 — List doctors + queue status

```
GET /doctors?clinicId=<uuid>
```

Response `200`:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Dr. Smith",
      "specialization": "General",
      "queueStatus": { "nowServing": 12, "waiting": 5 }
    }
  ]
}
```

### Step 6 — Availability / slots

```
GET /avail?doctorId=<uuid>&date=2026-07-02
```

Response `200`:
```json
{
  "data": {
    "doctorId": "uuid",
    "date": "2026-07-02",
    "slots": [
      { "id": "uuid", "slotIndex": 1, "slotTime": "2026-07-02T09:00:00Z", "status": "available" }
    ]
  }
}
```

### Step 8 — Create booking

```
POST /book
```

Body:
```json
{
  "clinicId": "uuid",
  "doctorId": "uuid",
  "slotId": "uuid",
  "patientName": "Jane Doe",
  "patientPhone": "+919876543210",
  "symptoms": "Fever"
}
```

Response `201`:
```json
{
  "data": {
    "id": "uuid",
    "tokenNumber": 13,
    "status": "waiting",
    "doctorId": "uuid",
    "slotId": "uuid"
  }
}
```

Side effects: DB insert, `booking:created` WS event, push + SMS notification.

---

## Queue (`/admin`)

### Step 13 — Advance queue

```
POST /admin/next
```

Body:
```json
{ "doctorId": "uuid", "date": "2026-07-02" }
```

Roles: `admin`, `doctor`.

Side effects: update `queue_state`, mark appointment `in-cabin`, emit `queue:update`, notify next patient.

### Other queue actions (planned)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/skip` | Skip current patient |
| POST | `/admin/no-show` | Mark no-show |
| POST | `/admin/done` | Complete consultation (step 15) |

---

## Other modules (planned)

| Prefix | Module | Key routes |
|--------|--------|------------|
| `/doctors` | Doctor | CRUD, schedules, breaks |
| `/patients` | Patient | Profile, history, favorites, family |
| `/billing` | Billing | Plans, subscribe, Razorpay webhook |
| `/analytics` | Analytics | Daily stats, wait times |
| `/files` | File | Upload, serve |
| `/notifications` | Notification | Test send, preferences |

---

## WebSocket (Socket.io)

Connect to same host as API.

| Event | Payload | Description |
|-------|---------|-------------|
| `queue:subscribe` | `doctorId: string` | Join live queue room |
| `queue:unsubscribe` | `doctorId: string` | Leave room |
| `queue:update` | `{ doctorId, nowServing, waiting, appointments[] }` | Server push |
| `booking:created` | `{ appointmentId, tokenNumber, doctorId }` | Server push |
