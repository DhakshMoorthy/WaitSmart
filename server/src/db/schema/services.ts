import { pgTable, uuid, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { clinics } from "./clinics.js";
import { doctors } from "./doctors.js";

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "cascade" }),
    /** null = offered by every doctor of the clinic. */
    doctorId: uuid("doctor_id").references(() => doctors.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(15),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("services_tenant_idx").on(table.tenantId),
    clinicIdx: index("services_clinic_idx").on(table.clinicId),
    doctorIdx: index("services_doctor_idx").on(table.doctorId),
  }),
);

export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;
