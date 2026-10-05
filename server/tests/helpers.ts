import request from "supertest";
import { app } from "../src/app.js";
import { db } from "../src/config/db.js";
import { tenants, users, clinics, doctors, doctorSchedules } from "../src/db/schema/index.js";
import { hashPassword } from "../src/utils/hash.js";
import { signAccessToken } from "../src/utils/jwt.js";
import type { JwtPayload } from "@waitsmart/shared";

export const api = request(app);

// ------ Seed helpers ------

export async function createTestTenant(overrides: Partial<typeof tenants.$inferInsert> = {}) {
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: "Test Clinic",
      slug: `test-${Date.now()}`,
      subdomain: `t-${Date.now()}`,
      isActive: true,
      ...overrides,
    })
    .returning();
  return tenant;
}

export async function createTestUser(
  tenantId: string | null,
  role: "superadmin" | "admin" | "doctor" | "patient",
  overrides: Partial<typeof users.$inferInsert> = {},
) {
  const email = overrides.email ?? `${role}-${Date.now()}@test.com`;
  const [user] = await db
    .insert(users)
    .values({
      tenantId,
      name: `Test ${role}`,
      email,
      phone: overrides.phone ?? "+911234567890",
      passwordHash: await hashPassword("Test@1234"),
      role,
      ...overrides,
    })
    .returning();
  return user;
}

export async function createTestClinic(tenantId: string, overrides: Partial<typeof clinics.$inferInsert> = {}) {
  const [clinic] = await db
    .insert(clinics)
    .values({
      tenantId,
      name: "Test Clinic Branch",
      address: "123 Test St",
      ...overrides,
    })
    .returning();
  return clinic;
}

export async function createTestDoctor(
  tenantId: string,
  clinicId: string,
  overrides: Partial<typeof doctors.$inferInsert> = {},
) {
  const [doctor] = await db
    .insert(doctors)
    .values({
      tenantId,
      clinicId,
      name: "Dr. Test",
      specialization: "General",
      experienceYears: 5,
      ...overrides,
    })
    .returning();
  return doctor;
}

export async function createTestSchedule(
  tenantId: string,
  doctorId: string,
  dayOfWeek: number,
  overrides: Partial<typeof doctorSchedules.$inferInsert> = {},
) {
  const [schedule] = await db
    .insert(doctorSchedules)
    .values({
      tenantId,
      doctorId,
      dayOfWeek,
      startTime: "09:00",
      endTime: "17:00",
      slotDurationMinutes: 15,
      ...overrides,
    })
    .returning();
  return schedule;
}

// ------ Auth helpers ------

export function authToken(payload: JwtPayload): string {
  return signAccessToken(payload);
}

export function superadminToken(userId = "00000000-0000-0000-0000-000000000001") {
  return authToken({
    userId,
    tenantId: null,
    role: "superadmin",
    email: "superadmin@test.com",
  });
}

export function adminToken(userId: string, tenantId: string) {
  return authToken({
    userId,
    tenantId,
    role: "admin",
    email: "admin@test.com",
  });
}

export function doctorToken(userId: string, tenantId: string) {
  return authToken({
    userId,
    tenantId,
    role: "doctor",
    email: "doctor@test.com",
  });
}

export function patientToken(userId: string, tenantId: string) {
  return authToken({
    userId,
    tenantId,
    role: "patient",
    email: "patient@test.com",
  });
}

/**
 * Next occurrence (strictly in the future) of `dayOfWeek` (0=Sun) as a local YYYY-MM-DD.
 * Uses local date parts, NOT toISOString(): the API derives day-of-week from the calendar
 * date, and UTC conversion shifts the date by a day for timezones ahead of UTC.
 */
export function nextWeekday(dayOfWeek: number): string {
  const d = new Date();
  d.setDate(d.getDate() + (((dayOfWeek - d.getDay()) + 7) % 7 || 7));
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
