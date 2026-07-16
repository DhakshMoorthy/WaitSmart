import { pgTable, uuid, integer, timestamp, date, index, unique, jsonb } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { doctors } from "./doctors.js";

/** Snapshot used by POST /admin/undo to reverse the last queue action. */
export type QueueLastAction = {
  appointmentId: string | null;
  previousStatus: string;
  previousCurrentSlot: number;
  previousSessionEnded: boolean;
  /** Extra appointment restored on undo (e.g. previous in-cabin marked done by next). */
  secondaryAppointmentId?: string | null;
  secondaryPreviousStatus?: string | null;
};

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
    lastAction: jsonb("last_action").$type<QueueLastAction | null>(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("queue_state_tenant_idx").on(table.tenantId),
    uniqueDoctorDate: unique("queue_state_doctor_date_unique").on(table.doctorId, table.date),
  }),
);

export type QueueState = typeof queueState.$inferSelect;
export type NewQueueState = typeof queueState.$inferInsert;
