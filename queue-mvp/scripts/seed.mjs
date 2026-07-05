/**
 * Seed Firestore with 2 clinics, 3 doctors, and initialized queues.
 *
 * Usage:
 *   1. Create a Firebase project and download a service account key
 *   2. Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
 *   3. Set FIREBASE_PROJECT_ID=your-project-id
 *   4. Run: node scripts/seed.mjs
 *
 * Or use the built-in local demo mode (no Firebase needed) — data auto-seeds in browser.
 */

import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;

if (!projectId) {
  console.error("Set FIREBASE_PROJECT_ID environment variable");
  process.exit(1);
}

initializeApp({
  credential: process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? applicationDefault()
    : cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}")),
  projectId,
});

const db = getFirestore();

const clinics = [
  { id: "clinic-1", name: "City Care Hospital", address: "MG Road, Bengaluru", hours: "9 AM – 2 PM • 4 PM – 6 PM" },
  { id: "clinic-2", name: "Green Valley Clinic", address: "Indiranagar, Bengaluru", hours: "9 AM – 2 PM • 4 PM – 6 PM" },
];

const doctors = [
  { id: "doc-1", name: "Dr. Priya Sharma", clinic_id: "clinic-1", specialization: "General Medicine" },
  { id: "doc-2", name: "Dr. Rahul Mehta", clinic_id: "clinic-1", specialization: "Pediatrics" },
  { id: "doc-3", name: "Dr. Ananya Reddy", clinic_id: "clinic-2", specialization: "Dermatology" },
];

async function seed() {
  console.log("Seeding Firestore...");

  for (const clinic of clinics) {
    await db.collection("clinics").doc(clinic.id).set(clinic);
    console.log(`  ✓ Clinic: ${clinic.name}`);
  }

  for (const doctor of doctors) {
    await db.collection("doctors").doc(doctor.id).set(doctor);
    await db.collection("queues").doc(doctor.id).set({
      doctor_id: doctor.id,
      current_token: 0,
      last_token: 0,
    });
    console.log(`  ✓ Doctor: ${doctor.name} (queue initialized)`);
  }

  console.log("\nSeed complete!");
  console.log("Deploy firestore.rules and create composite index for:");
  console.log("  appointments: doctor_id ASC, status ASC, token ASC");
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
