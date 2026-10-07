import { readFileSync } from "node:fs";

/**
 * Demo datasets. Which one a deployment loads is chosen with SEED_DATASET:
 *   chennai (default)  - the production demo: real Chennai clinics + doctors from public listings
 *   us-uk              - the test environment: well-known US/UK hospitals with FICTIONAL doctors
 */
export const DATASET_IDS = ["chennai", "us-uk"] as const;
export type DatasetId = (typeof DATASET_IDS)[number];

const FILES: Record<DatasetId, string> = {
  chennai: "chennai-clinics.json",
  "us-uk": "us-uk-clinics.json",
};

export interface DoctorSeed {
  name: string;
  specialization: string;
  experienceYears: number;
  /** Optional. Only picks the male/female placeholder avatar; omit for a neutral avatar. */
  gender?: "male" | "female";
}

export interface ClinicSeed {
  /** Short stable id, used for test login emails (doctor.<key>@demo.waitsmart.test). */
  key: string;
  name: string;
  address: string;
  hours: string;
  schedule: { days: number[]; start: string; end: string };
  doctors: DoctorSeed[];
}

export interface Dataset {
  id: DatasetId;
  tenantName: string;
  tenantSubdomain: string;
  /** Offset from UTC used to decide what "today" is for the demo bookings. */
  utcOffsetMinutes: number;
  /**
   * Names and phone numbers of the seeded test accounts. They differ per dataset so two environments that
   * share ONE database (prod and test) never collide: each dataset has its own tenant, logins and patients.
   */
  testAccounts: {
    emailDomain: string;
    adminPhone: string;
    doctorPhoneBase: string;
    patientPhoneBase: string;
  };
  /** Clinic keys that get demo bookings (history / live queue / upcoming). */
  demoBookingClinics: string[];
  /** Test patient names (phone numbers are generated). */
  patients: string[];
  clinics: ClinicSeed[];
}

export function datasetIdFromEnv(): DatasetId {
  const id = (process.env.SEED_DATASET || "chennai") as DatasetId;
  if (!DATASET_IDS.includes(id)) {
    throw new Error(`Unknown SEED_DATASET "${id}". Use one of: ${DATASET_IDS.join(", ")}`);
  }
  return id;
}

export function loadDataset(id: DatasetId = datasetIdFromEnv()): Dataset {
  const raw = readFileSync(new URL(`./data/${FILES[id]}`, import.meta.url), "utf8");
  return { id, ...(JSON.parse(raw) as Omit<Dataset, "id">) };
}
