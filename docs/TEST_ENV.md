# Test environment (`test.klinicals.com`)

A second copy of the product for testing and demos, with **well-known US/UK hospitals** instead of the Chennai clinics.
Same code (`main`) as production; different data.

| | Production | Test |
|---|---|---|
| Web app | `app.klinicals.com` (Vercel `wait-smart-admin`) | `test.klinicals.com` (a second Vercel project) |
| API | `waitsmart-api` | `waitsmart-api-test` (`https://waitsmart-api-test.onrender.com`) |
| Dataset (`SEED_DATASET`) | `chennai` (real clinics + doctors) | `us-uk` (real hospitals, **fictional doctors**) |
| Default tenant (`DEFAULT_TENANT_SLUG`) | `apollo-clinic` ("Chennai Demo Clinics") | `us-uk-demo` ("US & UK Demo Hospitals") |
| Postgres | `waitsmart-db` | **same database** (shared for now) |
| Redis | `waitsmart-redis` | **same instance**, keys prefixed `test:` |
| JWT secrets | own | own (a production token is not valid on test) |

## How the shared database stays separate

One Postgres, two environments. They cannot see each other because:

- **Tenants:** every clinic, doctor, booking and patient belongs to a tenant. Each environment's default tenant is different, and every API call is scoped to the caller's tenant.
- **Patients are per tenant:** the same phone number is a *separate* patient in each environment (phone + tenant, not phone alone). Covered by `server/tests/shared-database.test.ts`.
- **Test accounts:** each dataset has its own email domain and phone ranges (see below), so the two seeds never touch each other's users.
- **Redis:** `REDIS_KEY_PREFIX=test:` keeps OTP codes, rate limits and refresh tokens apart.
- **Shared on purpose:** the superadmin (no tenant). Sign in on the test site with the production superadmin credentials; it acts on the test default tenant there.

What sharing still means (accepted for now): one 1 GB free Postgres holds both, so a database problem or its expiry affects both; both services run migrations on deploy (they are idempotent, but if one deploy fails with a migration error, just redeploy it); and a manual mistake in pgAdmin can touch production data. Move the test environment to its own database when this matters: give `waitsmart-api-test` its own `DATABASE_URL` and `REDIS_URL`, nothing else changes.

## One-time setup

1. **Render:** merge this PR; the Blueprint sync creates `waitsmart-api-test`. When prompted, set `TEST_ACCOUNTS_PASSWORD` (8+ characters; not `Admin@1234` etc.). The first deploy log should show `Dataset: us-uk` and `Test data (us-uk): 8 patients, admin + 6 doctor logins, ... new demo bookings`.
2. **Vercel:** new project from the same GitHub repo.
   - Root Directory `queue-mvp` (keep "Include source files outside of the Root Directory" on), framework Vite, production branch `main`.
   - Environment variable `VITE_API_URL` = `https://waitsmart-api-test.onrender.com` (Production + Preview).
   - Domains: add `test.klinicals.com`.
3. **Hostinger DNS:** CNAME `test` -> the value Vercel shows for that domain (the same `...vercel-dns-017.com` target the other subdomains use).
4. Open `https://test.klinicals.com`: you should see the six hospitals.

The test API's `CORS_ORIGINS` allows only `https://test.klinicals.com`.

## Hospitals

Real hospitals, addresses and typical outpatient hours (public information, checked 2026-10-07; hours vary by clinic):

| Hospital | Country | Hours used |
|---|---|---|
| Mayo Clinic - Rochester | US | Mon-Fri 6:30 AM - 6:30 PM |
| Cleveland Clinic - Main Campus | US | Mon-Fri 7:00 AM - 4:30 PM |
| Massachusetts General Hospital | US | Mon-Fri 8:00 AM - 5:00 PM |
| Guy's Hospital - London | UK | Mon-Fri 9:00 AM - 5:00 PM |
| Addenbrooke's Hospital - Cambridge | UK | Mon-Fri 9:00 AM - 5:00 PM |
| Great Ormond Street Hospital - London | UK | Mon-Fri 8:00 AM - 8:00 PM |

**The doctors are fictional** (invented names, specialties, experience, gender), 4 per hospital, so no real clinician is represented.
The data file is `server/src/db/seeds/data/us-uk-clinics.json`.

## Test accounts (test environment)

Password for staff = the `TEST_ACCOUNTS_PASSWORD` set on `waitsmart-api-test`.

| Role | Email |
|---|---|
| Clinic admin | `admin@us-uk.demo.waitsmart.test` |
| Doctor | `doctor.mayo@us-uk.demo.waitsmart.test`, `doctor.cleveland@...`, `doctor.mgh@...`, `doctor.guys@...`, `doctor.addenbrookes@...`, `doctor.gosh@...` (each linked to that hospital's first doctor alphabetically) |
| Patients | phone + on-screen OTP: +91 90000 30001 ... 30008 (James Carter, Emily Richardson, Oliver Hughes, Sophia Martinez, Liam Patel, Charlotte Evans, Noah Johnson, Amelia Clarke) |

Demo bookings (history, a live queue today, upcoming) are created for Mayo, Guy's and Mass General, on each hospital's own open days (Mon-Fri).

Limitation: the app's phone login is still India-format (`+91`), so US/UK patients in the demo use `+91` numbers. A country selector is a separate piece of work.

## Doctor profile pictures

Both environments now use a **male / female doctor logo** (inline SVG) instead of one shared stock photo. It is chosen from the doctor's `gender` (`male`, `female`, or empty for a neutral logo).
The US/UK demo doctors have a gender set. The real Chennai doctors have none set yet, because gender is not published in the listings we used, so they show the neutral logo until it is filled in (`gender` in `server/src/db/seeds/data/chennai-clinics.json`, applied on the next deploy; or `PATCH /doctors/:id` with `{"gender":"male"|"female"}` as a clinic admin).
