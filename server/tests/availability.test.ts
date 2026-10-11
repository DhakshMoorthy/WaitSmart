import { describe, it, expect, beforeAll } from "vitest";
import {
  api,
  createTestTenant,
  createTestUser,
  createTestClinic,
  createTestDoctor,
  createTestSchedule,
  adminToken,
  doctorToken,
  patientToken,
} from "./helpers.js";

function isoInDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const dayOfWeek = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
};

describe("Doctor availability (schedule, breaks, booking window)", () => {
  let tenantId: string;
  let clinicId: string;
  let admin: string;
  let patient: string;

  beforeAll(async () => {
    tenantId = (await createTestTenant()).id;
    clinicId = (await createTestClinic(tenantId)).id;
    admin = adminToken((await createTestUser(tenantId, "admin")).id, tenantId);
    const p = await createTestUser(tenantId, "patient");
    patient = patientToken(p.id, tenantId);
  });

  describe("schedule changes", () => {
    it("rebuilds not-yet-booked slots with the new slot length", async () => {
      const doc = await createTestDoctor(tenantId, clinicId);
      const date = isoInDays(2);
      await createTestSchedule(tenantId, doc.id, dayOfWeek(date), { startTime: "09:00", endTime: "10:00", slotDurationMinutes: 30 });

      const before = await api.get("/avail").set("Authorization", `Bearer ${admin}`).query({ doctorId: doc.id, date });
      expect(before.body.data.slots).toHaveLength(2);

      const put = await api
        .put(`/doctors/${doc.id}/schedules`)
        .set("Authorization", `Bearer ${admin}`)
        .send({ schedules: [{ dayOfWeek: dayOfWeek(date), startTime: "09:00", endTime: "10:00", slotDurationMinutes: 15 }] });
      expect(put.status).toBe(200);

      const after = await api.get("/avail").set("Authorization", `Bearer ${admin}`).query({ doctorId: doc.id, date });
      expect(after.body.data.slots).toHaveLength(4);
    });

    it("keeps the slots of a date that already has a booking", async () => {
      const doc = await createTestDoctor(tenantId, clinicId);
      const date = isoInDays(1);
      await createTestSchedule(tenantId, doc.id, dayOfWeek(date), { startTime: "09:00", endTime: "10:00", slotDurationMinutes: 30 });
      const avail = await api.get("/avail").set("Authorization", `Bearer ${patient}`).query({ doctorId: doc.id, date });
      const slot = avail.body.data.slots[0];
      const book = await api
        .post("/book")
        .set("Authorization", `Bearer ${patient}`)
        .send({ clinicId, doctorId: doc.id, slotId: slot.id, patientName: "Pat Ient" });
      expect(book.status).toBe(201);

      await api
        .put(`/doctors/${doc.id}/schedules`)
        .set("Authorization", `Bearer ${admin}`)
        .send({ schedules: [{ dayOfWeek: dayOfWeek(date), startTime: "09:00", endTime: "10:00", slotDurationMinutes: 15 }] });

      const after = await api.get("/avail").set("Authorization", `Bearer ${admin}`).query({ doctorId: doc.id, date });
      expect(after.body.data.slots).toHaveLength(2);
      const names = after.body.data.slots.map((s: { appointment: { patientName?: string } | null }) => s.appointment?.patientName);
      expect(names).toContain("Pat Ient");
    });

    it("accepts an empty schedule (doctor takes no bookings)", async () => {
      const doc = await createTestDoctor(tenantId, clinicId);
      const date = isoInDays(2);
      await createTestSchedule(tenantId, doc.id, dayOfWeek(date));
      const put = await api.put(`/doctors/${doc.id}/schedules`).set("Authorization", `Bearer ${admin}`).send({ schedules: [] });
      expect(put.status).toBe(200);
      const res = await api.get("/avail").set("Authorization", `Bearer ${admin}`).query({ doctorId: doc.id, date });
      expect(res.body.data.slots).toHaveLength(0);
    });

    it("a doctor can edit only their own schedule", async () => {
      const mine = await createTestUser(tenantId, "doctor");
      const myDoc = await createTestDoctor(tenantId, clinicId, { userId: mine.id });
      const other = await createTestDoctor(tenantId, clinicId);
      const token = doctorToken(mine.id, tenantId);
      const body = { schedules: [{ dayOfWeek: 1, startTime: "09:00", endTime: "12:00", slotDurationMinutes: 20 }] };
      expect((await api.put(`/doctors/${myDoc.id}/schedules`).set("Authorization", `Bearer ${token}`).send(body)).status).toBe(200);
      expect((await api.put(`/doctors/${other.id}/schedules`).set("Authorization", `Bearer ${token}`).send(body)).status).toBe(403);
    });
  });

  describe("breaks", () => {
    it("can be added, hides the day from patients, and be removed again", async () => {
      const doc = await createTestDoctor(tenantId, clinicId);
      const date = isoInDays(2);
      await createTestSchedule(tenantId, doc.id, dayOfWeek(date));

      const add = await api
        .post(`/doctors/${doc.id}/breaks`)
        .set("Authorization", `Bearer ${admin}`)
        .send({ startDate: date, endDate: date, reason: "Conference" });
      expect(add.status).toBe(201);

      const during = await api.get("/avail").set("Authorization", `Bearer ${patient}`).query({ doctorId: doc.id, date });
      expect(during.body.data.slots).toHaveLength(0);

      const del = await api.delete(`/doctors/${doc.id}/breaks/${add.body.data.id}`).set("Authorization", `Bearer ${admin}`);
      expect(del.status).toBe(200);

      const after = await api.get("/avail").set("Authorization", `Bearer ${patient}`).query({ doctorId: doc.id, date });
      expect(after.body.data.slots.length).toBeGreaterThan(0);
    });

    it("cannot remove a break through the wrong doctor, or a missing break", async () => {
      const a = await createTestDoctor(tenantId, clinicId);
      const b = await createTestDoctor(tenantId, clinicId);
      const date = isoInDays(3);
      const brk = await api
        .post(`/doctors/${a.id}/breaks`)
        .set("Authorization", `Bearer ${admin}`)
        .send({ startDate: date, endDate: date });
      expect((await api.delete(`/doctors/${b.id}/breaks/${brk.body.data.id}`).set("Authorization", `Bearer ${admin}`)).status).toBe(404);
      expect(
        (await api.delete(`/doctors/${a.id}/breaks/00000000-0000-0000-0000-000000000000`).set("Authorization", `Bearer ${admin}`)).status,
      ).toBe(404);
    });

    it("a doctor cannot remove another doctor's break", async () => {
      const mine = await createTestUser(tenantId, "doctor");
      await createTestDoctor(tenantId, clinicId, { userId: mine.id });
      const other = await createTestDoctor(tenantId, clinicId);
      const brk = await api
        .post(`/doctors/${other.id}/breaks`)
        .set("Authorization", `Bearer ${admin}`)
        .send({ startDate: isoInDays(4), endDate: isoInDays(4) });
      const res = await api
        .delete(`/doctors/${other.id}/breaks/${brk.body.data.id}`)
        .set("Authorization", `Bearer ${doctorToken(mine.id, tenantId)}`);
      expect(res.status).toBe(403);
    });
  });

  describe("booking window", () => {
    it("hides dates beyond the window from patients but not staff, and rejects direct bookings", async () => {
      const doc = await createTestDoctor(tenantId, clinicId, { bookingWindowDays: 2 });
      const far = isoInDays(6);
      await createTestSchedule(tenantId, doc.id, dayOfWeek(far));
      await createTestSchedule(tenantId, doc.id, dayOfWeek(isoInDays(1)));

      const asPatient = await api.get("/avail").set("Authorization", `Bearer ${patient}`).query({ doctorId: doc.id, date: far });
      expect(asPatient.status).toBe(200);
      expect(asPatient.body.data.slots).toHaveLength(0);
      expect(asPatient.body.data.message).toMatch(/2 days ahead/);

      const asAdmin = await api.get("/avail").set("Authorization", `Bearer ${admin}`).query({ doctorId: doc.id, date: far });
      expect(asAdmin.body.data.slots.length).toBeGreaterThan(0);

      // A slot that exists (staff generated it) still cannot be booked by a patient.
      const book = await api
        .post("/book")
        .set("Authorization", `Bearer ${patient}`)
        .send({ clinicId, doctorId: doc.id, slotId: asAdmin.body.data.slots[0].id, patientName: "Too Early" });
      expect(book.status).toBe(400);
      expect(JSON.stringify(book.body)).toContain("OUTSIDE_BOOKING_WINDOW");

      const near = await api.get("/avail").set("Authorization", `Bearer ${patient}`).query({ doctorId: doc.id, date: isoInDays(1) });
      expect(near.body.data.slots.length).toBeGreaterThan(0);
    });

    it("admin can change it; out-of-range values are rejected", async () => {
      const doc = await createTestDoctor(tenantId, clinicId);
      const ok = await api.patch(`/doctors/${doc.id}`).set("Authorization", `Bearer ${admin}`).send({ bookingWindowDays: 7 });
      expect(ok.status).toBe(200);
      expect(ok.body.data.bookingWindowDays).toBe(7);
      for (const bad of [0, 61, 1.5]) {
        const res = await api.patch(`/doctors/${doc.id}`).set("Authorization", `Bearer ${admin}`).send({ bookingWindowDays: bad });
        expect(res.status).toBe(400);
      }
    });
  });
});
