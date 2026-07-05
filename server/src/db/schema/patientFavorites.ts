import { pgTable, uuid, timestamp, index, unique } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { users } from "./users.js";
import { doctors } from "./doctors.js";

export const patientFavorites = pgTable(
  "patient_favorites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    patientUserId: uuid("patient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    patientIdx: index("patient_favorites_patient_idx").on(table.patientUserId),
    uniqueFav: unique("patient_favorites_unique").on(table.patientUserId, table.doctorId),
  }),
);

export type PatientFavorite = typeof patientFavorites.$inferSelect;
export type NewPatientFavorite = typeof patientFavorites.$inferInsert;
