import { pgTable, uuid, integer, timestamp, date, pgEnum, index, unique } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { doctors } from "./doctors.js";

export const slotStatusEnum = pgEnum("slot_status", ["available", "booked", "cancelled"]);

export const slots = pgTable(
  "slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    slotIndex: integer("slot_index").notNull(),
    slotTime: timestamp("slot_time", { withTimezone: true }).notNull(),
    status: slotStatusEnum("status").notNull().default("available"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("slots_tenant_idx").on(table.tenantId),
    doctorDateIdx: index("slots_doctor_date_idx").on(table.doctorId, table.date),
    uniqueSlot: unique("slots_doctor_date_index_unique").on(table.doctorId, table.date, table.slotIndex),
  }),
);

export type Slot = typeof slots.$inferSelect;
export type NewSlot = typeof slots.$inferInsert;
