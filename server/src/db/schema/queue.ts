import { pgTable, uuid, integer, timestamp, date, index, unique } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { doctors } from "./doctors.js";

export const queueState = pgTable(
  "queue_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    currentSlot: integer("current_slot").notNull().default(0),
    lastSlot: integer("last_slot").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("queue_state_tenant_idx").on(table.tenantId),
    uniqueDoctorDate: unique("queue_state_doctor_date_unique").on(table.doctorId, table.date),
  }),
);

export type QueueState = typeof queueState.$inferSelect;
export type NewQueueState = typeof queueState.$inferInsert;
