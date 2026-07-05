import { pgTable, uuid, date, text, timestamp, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { doctors } from "./doctors.js";

export const doctorBreaks = pgTable(
  "doctor_breaks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("doctor_breaks_tenant_idx").on(table.tenantId),
    doctorIdx: index("doctor_breaks_doctor_idx").on(table.doctorId),
  }),
);

export type DoctorBreak = typeof doctorBreaks.$inferSelect;
export type NewDoctorBreak = typeof doctorBreaks.$inferInsert;
