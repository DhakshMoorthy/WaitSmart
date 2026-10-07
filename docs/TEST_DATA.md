# Test data and test accounts

Development data so every part of the app can be exercised without typing anything in first.
Loaded by the database seed (`server/src/db/seeds/`), which Render runs on every deploy.
Everything is **idempotent** (re-running adds nothing) and lives in the default tenant
(`DEFAULT_TENANT_SLUG`, default `apollo-clinic`, shown as "Chennai Demo Clinics"). The accounts below are the **chennai** dataset; the test environment's are in [TEST_ENV.md](TEST_ENV.md).

> Development only. Turn it off (`SEED_TEST_DATA=false`) and delete the test accounts before real patients use the product.

## Switches

| Env var | Effect |
|---|---|
| `SEED_TEST_DATA=true` | Creates test patients and demo bookings. Already `true` in `render.yaml`. Default off locally. |
| `TEST_ACCOUNTS_PASSWORD` | 8+ characters, not a published password (`Admin@1234`, `Doctor@1234`, `Patient@1234`). If it is shorter, the admin/doctor logins are silently NOT created (a warning is logged). Also creates the clinic admin and doctor logins. Set it in the Render dashboard (never commit it). Changing it updates the passwords on the next deploy. |
| `SEED_DATASET` | Which clinics/doctors/patients to load: `chennai` (default, production) or `us-uk` (test environment, see [TEST_ENV.md](TEST_ENV.md)). Each dataset has its own default tenant, test-account emails (`@demo.waitsmart.test` vs `@us-uk.demo.waitsmart.test`) and phone ranges. |
| `SEED_CHENNAI_CLINICS=false` | Skips loading the dataset's clinics. |
| `EXPOSE_DEV_OTP=true` | Shows the OTP on screen, so patients can sign in with just a phone number. |

## Accounts

**Staff** (email + password = `TEST_ACCOUNTS_PASSWORD`) sign in on the app's **Admin** page.

| Role | Email | Can |
|---|---|---|
| Superadmin | your `SUPERADMIN_EMAIL` | everything; acts on the default clinic (or `x-tenant-id`) |
| Clinic admin | `admin@demo.waitsmart.test` | all doctors and queues in the clinic group |
| Doctor | `doctor.apollo@demo.waitsmart.test` | own queue only: first doctor at Apollo Clinic - Velachery |
| Doctor | `doctor.kauvery@demo.waitsmart.test` | first doctor at Kauvery Hospital - Alwarpet |
| Doctor | `doctor.miot@demo.waitsmart.test` | first doctor at MIOT International - Manapakkam |
| Doctor | `doctor.fortis@demo.waitsmart.test` | first doctor at Fortis Malar Hospital - Adyar |
| Doctor | `doctor.sriramachandra@demo.waitsmart.test` | first doctor at Sri Ramachandra Medical Centre - Porur |

A doctor login can run only its own doctor's queue (a different doctor's queue returns 403).
Staff cannot sign in with an OTP.

**Patients** have no password: enter the phone number, then the OTP shown on screen.

| Name | Phone |
|---|---|
| Arjun Menon | +91 90000 20001 |
| Divya Krishnan | +91 90000 20002 |
| Karthik Raja | +91 90000 20003 |
| Meena Subramanian | +91 90000 20004 |
| Rahul Iyer | +91 90000 20005 |
| Lakshmi Narayanan | +91 90000 20006 |
| Sanjay Kumar | +91 90000 20007 |
| Ananya Reddy | +91 90000 20008 |

Any other phone number also works and creates a new patient.

## Demo bookings

For the first doctor at Apollo Velachery, Kauvery Alwarpet and MIOT Manapakkam (Mon-Sat only, dates in IST):

| Day | Bookings | State |
|---|---|---|
| Previous working day | 4 | done, done, no-show, cancelled (history view) |
| Today (next working day if Sunday) | 6 | 1 done, 1 **in the cabin**, 4 waiting (a live queue to play with) |
| Following working day | 3 | all waiting |

Bookings are only created for a doctor/day that has none yet, so re-deploys never duplicate or reset a queue you are testing with.
To start over for a day, use **Reset queue** in Admin.

## Cleanup performed by the seed

Each deploy also removes, by exact match only: the fake sample clinics ("Apollo Main Branch", "Apollo - Anna Nagar") with their
doctors and bookings, the sample users from the original seed, duplicate superadmin rows, and the old default superadmin once a
different `SUPERADMIN_EMAIL` is configured.
