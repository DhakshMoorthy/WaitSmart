# WaitSmart Queue MVP

A mobile-first hospital queue and appointment system focused on reducing patient waiting time. Patients get a token instantly (no login), track live queue movement, and doctors control the flow from a simple dashboard.

## Features

**Patient (no login)**
- Browse clinics and doctors (card UI)
- Enter name + optional symptoms → auto token assignment
- Live view: Your Token, Now Serving, Estimated Wait Time
- Real-time updates when the doctor advances the queue

**Admin / Doctor Dashboard**
- Select doctor from dropdown
- See current token and waiting patients
- Next Patient · Skip Patient · Mark No Show

**Queue logic**
- Per-doctor queue with `current_token` and `last_token`
- Wait time = `(your_token - current_token) × 5 minutes`

## Quick start (demo mode)

No Firebase required — uses browser localStorage with cross-tab sync:

```bash
cd queue-mvp
pnpm install
pnpm dev
```

Open http://localhost:5173

1. Click **Get Token Now** → pick clinic → doctor → enter name → submit
2. Open **Doctor / Admin Dashboard** in another tab → select same doctor → **Next Patient**
3. Watch the patient token screen update live

## Firebase setup (production)

1. Create a [Firebase project](https://console.firebase.google.com/)
2. Enable Firestore
3. Copy `.env.example` → `.env` and fill in your Firebase web config
4. Deploy rules: `firebase deploy --only firestore:rules`
5. Seed data:
   ```bash
   export FIREBASE_PROJECT_ID=your-project-id
   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
   pnpm seed
   ```
6. Create composite index: `appointments` → `doctor_id` + `status` + `token`
7. Build & deploy:
   ```bash
   pnpm build
   firebase deploy --only hosting
   ```

## Seed data

| Clinic | Doctors |
|--------|---------|
| City Care Hospital | Dr. Priya Sharma (General Medicine), Dr. Rahul Mehta (Pediatrics) |
| Green Valley Clinic | Dr. Ananya Reddy (Dermatology) |

## Data model (Firestore)

```
clinics     { id, name, address?, hours? }
doctors     { id, name, clinic_id, specialization? }
queues      { doctor_id, current_token, last_token }   // doc id = doctor_id
appointments { name, doctor_id, token, status, notes, created_at }
```

Status values: `waiting` | `done` | `skipped` | `no_show`

## Tech stack

- Vite + vanilla JS (no framework overhead)
- Firebase Firestore real-time listeners (`onSnapshot`)
- Local demo fallback when Firebase is not configured
- Mobile-first responsive design (Swiggy/Zomato-style cards)
