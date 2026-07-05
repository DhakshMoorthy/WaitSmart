import { pgTable, uuid, integer, text, timestamp, index, unique } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { doctors } from "./doctors.js";

export const doctorSchedules = pgTable(
  "doctor_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(), // 0=Sunday, 6=Saturday
    startTime: text("start_time").notNull(), // "09:00"
    endTime: text("end_time").notNull(), // "17:00"
    slotDurationMinutes: integer("slot_duration_minutes").notNull().default(15),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("doctor_schedules_tenant_idx").on(table.tenantId),
    doctorIdx: index("doctor_schedules_doctor_idx").on(table.doctorId),
    uniqueDoctorDay: unique("doctor_schedules_doctor_day_unique").on(table.doctorId, table.dayOfWeek),
  }),
);

export type DoctorSchedule = typeof doctorSchedules.$inferSelect;
export type NewDoctorSchedule = typeof doctorSchedules.$inferInsert;
