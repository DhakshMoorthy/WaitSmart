/**
 * Seed Firestore for KVT Hospital
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
  {
    id: "clinic-moolakadai",
    name: "KVT Hospital — Moolakadai",
    branch: "Moolakadai",
    address: "Moolakadai, Chennai",
    hours: "9:00 AM – 2:00 PM • 4:00 PM – 6:00 PM",
  },
  {
    id: "clinic-erukenchery",
    name: "KVT Hospital — Erukenchery",
    branch: "Erukenchery",
    address: "Erukenchery, Chennai",
    hours: "9:00 AM – 2:00 PM • 4:00 PM – 6:00 PM",
  },
];

const doctors = [
  {
    id: "doc-hari-prasad",
    name: "Dr. Hari Prasad",
    clinic_id: "clinic-moolakadai",
    specialization: "General Medicine",
    slot_duration_minutes: 30,
  },
];

async function seed() {
  console.log("Seeding KVT Hospital Firestore...");

  for (const clinic of clinics) {
    await db.collection("clinics").doc(clinic.id).set(clinic);
    console.log(`  ✓ ${clinic.name}`);
  }

  for (const doctor of doctors) {
    await db.collection("doctors").doc(doctor.id).set(doctor);
    await db.collection("queues").doc(doctor.id).set({
      doctor_id: doctor.id,
      current_token: 0,
      last_token: 0,
    });
    console.log(`  ✓ ${doctor.name} (30 min slots, queue initialized)`);
  }

  console.log("\nSeed complete!");
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
