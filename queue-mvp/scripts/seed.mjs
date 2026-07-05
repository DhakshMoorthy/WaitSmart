/**
 * Seed Firestore for KVT Hospital (production)
 * Usage: FIREBASE_PROJECT_ID=xxx GOOGLE_APPLICATION_CREDENTIALS=... pnpm seed
 */

import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
if (!projectId) {
  console.error("Set FIREBASE_PROJECT_ID");
  process.exit(1);
}

initializeApp({
  credential: process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? applicationDefault()
    : cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}")),
  projectId,
});

const db = getFirestore();
const CLINIC_IMG = "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&q=80";
const DOC_MALE = "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=200&q=80";
const DOC_FEMALE = "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&q=80";

const clinics = [
  { id: "clinic-moolakadai", name: "KVT Hospital — Moolakadai", branch: "Moolakadai", address: "Moolakadai, Chennai", hours: "9:00 AM – 2:00 PM • 4:00 PM – 6:00 PM", image_url: CLINIC_IMG },
  { id: "clinic-erukenchery", name: "KVT Hospital — Erukenchery", branch: "Erukenchery", address: "Erukenchery, Chennai", hours: "9:00 AM – 2:00 PM • 4:00 PM – 6:00 PM", image_url: CLINIC_IMG },
];

const doctors = [
  { id: "doc-karthik", name: "Dr. Karthik Iyer", clinic_id: "clinic-moolakadai", specialization: "General Physician", experience_years: 12, slot_duration_minutes: 30, photo_url: DOC_MALE },
  { id: "doc-vandana", name: "Dr. Vandana Rao", clinic_id: "clinic-moolakadai", specialization: "Pediatrician", experience_years: 9, slot_duration_minutes: 30, photo_url: DOC_FEMALE },
  { id: "doc-hari", name: "Dr. Hari Prasad", clinic_id: "clinic-erukenchery", specialization: "General Medicine", experience_years: 15, slot_duration_minutes: 30, photo_url: DOC_MALE },
];

async function seed() {
  console.log("Seeding KVT Hospital...");
  for (const c of clinics) {
    await db.collection("clinics").doc(c.id).set(c);
    console.log("  ✓", c.name);
  }
  for (const d of doctors) {
    await db.collection("doctors").doc(d.id).set(d);
    console.log("  ✓", d.name);
  }
  console.log("Done.");
}

seed().catch((e) => { console.error(e); process.exit(1); });
