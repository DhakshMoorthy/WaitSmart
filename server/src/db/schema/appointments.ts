import { sql } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, pgEnum, index, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { doctors } from "./doctors.js";
import { clinics } from "./clinics.js";
import { slots } from "./slots.js";
import { users } from "./users.js";
import { files } from "./files.js";

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "waiting",
  "in-cabin",
  "done",
  "skipped",
  "no-show",
  "cancelled",
]);

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id, { onDelete: "cascade" }),
    doctorId: uuid("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    slotId: uuid("slot_id")
      .notNull()
      .references(() => slots.id, { onDelete: "cascade" }),
    patientUserId: uuid("patient_user_id").references(() => users.id, { onDelete: "set null" }),
    patientName: text("patient_name").notNull(),
    patientPhone: text("patient_phone"),
    symptoms: text("symptoms"),
    doctorNotes: text("doctor_notes"),
    fileId: uuid("file_id").references(() => files.id, { onDelete: "set null" }),
    tokenNumber: integer("token_number").notNull(),
    status: appointmentStatusEnum("status").notNull().default("waiting"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index("appointments_tenant_idx").on(table.tenantId),
    doctorIdx: index("appointments_doctor_idx").on(table.doctorId),
    patientIdx: index("appointments_patient_idx").on(table.patientUserId),
    // One active appointment per slot (see migration 0002).
    activeSlotUnique: uniqueIndex("appointments_active_slot_unique")
      .on(table.slotId)
      .where(sql`${table.status} <> 'cancelled'`),
  }),
);

export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;
