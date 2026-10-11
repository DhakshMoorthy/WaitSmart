import { describe, it, expect, beforeAll } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "../src/config/db.js";
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
  nextWeekday,
} from "./helpers.js";

describe("GET /analytics/summary", () => {
  let tenantId: string;
  let clinicId: string;
  let admin: string;
  let patient: string;
  let date: string;
  let docA: { id: string };
  let docB: { id: string };
  let docAToken: string;
  const apptIds: string[] = [];

  const summary = (token: string, query: Record<string, string> = {}) =>
    api.get("/analytics/summary").query({ date, ...query }).set("Authorization", `Bearer ${token}`);

  beforeAll(async () => {
    tenantId = (await createTestTenant()).id;
    clinicId = (await createTestClinic(tenantId)).id;
    admin = adminToken((await createTestUser(tenantId, "admin")).id, tenantId);
    patient = patientToken((await createTestUser(tenantId, "patient")).id, tenantId);
    const docUser = await createTestUser(tenantId, "doctor");
    docA = await createTestDoctor(tenantId, clinicId, { userId: docUser.id });
    docB = await createTestDoctor(tenantId, clinicId);
    docAToken = doctorToken(docUser.id, tenantId);

    date = nextWeekday(2);
    for (const d of [docA, docB]) {
      await createTestSchedule(tenantId, d.id, 2, { startTime: "10:00", endTime: "12:00", slotDurationMinutes: 30 });
    }

    // docA: 4 bookings; docB: 1 booking.
    const avail = await api.get("/avail").query({ doctorId: docA.id, date }).set("Authorization", `Bearer ${patient}`);
    for (const slot of avail.body.data.slots.slice(0, 4)) {
      const res = await api
        .post("/book")
        .set("Authorization", `Bearer ${patient}`)
        .send({ clinicId, doctorId: docA.id, slotId: slot.id, patientName: "Pat Ient" });
      apptIds.push(res.body.data.id);
    }
    const availB = await api.get("/avail").query({ doctorId: docB.id, date }).set("Authorization", `Bearer ${patient}`);
    await api
      .post("/book")
      .set("Authorization", `Bearer ${patient}`)
      .send({ clinicId, doctorId: docB.id, slotId: availB.body.data.slots[0].id, patientName: "Other Doc" });

    const setStatus = (id: string, status: string) =>
      api.patch("/admin/appointment-status").set("Authorization", `Bearer ${admin}`).send({ appointmentId: id, status });
    // appt 0: in-cabin -> done (consultation took ~6 minutes), appt 1: no-show, appt 2: cancelled, appt 3: still waiting
    expect((await setStatus(apptIds[0], "in-cabin")).status).toBe(200);
    await db.execute(sql`UPDATE appointments SET called_at = now() - interval '6 minutes' WHERE id = ${apptIds[0]}`);
    expect((await setStatus(apptIds[0], "done")).status).toBe(200);
    expect((await setStatus(apptIds[1], "no-show")).status).toBe(200);
    expect((await setStatus(apptIds[2], "cancelled")).status).toBe(200);
  });

  it("the DB trigger stamps called_at / completed_at", async () => {
    const r = await db.execute(sql`SELECT status, called_at, completed_at FROM appointments WHERE id IN (${apptIds[0]}, ${apptIds[3]}) ORDER BY token_number`);
    const [done, waiting] = r.rows as Array<{ status: string; called_at: Date | null; completed_at: Date | null }>;
    expect(done.status).toBe("done");
    expect(done.called_at).not.toBeNull();
    expect(done.completed_at).not.toBeNull();
    expect(waiting.called_at).toBeNull();
    expect(waiting.completed_at).toBeNull();
  });

  it("admin sees the whole clinic for the day", async () => {
    const res = await summary(admin);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.date).toBe(date);
    expect(d.total).toBe(4); // 5 bookings - 1 cancelled
    expect(d.completed).toBe(1);
    expect(d.noShow).toBe(1);
    expect(d.cancelled).toBe(1);
    expect(d.waiting).toBe(2); // docA's last one + docB's
    expect(d.avgConsultMinutes).toBeGreaterThanOrEqual(5);
    expect(d.avgConsultMinutes).toBeLessThanOrEqual(7);
    expect(d.trend).toHaveLength(7);
    expect(d.trend[6].date).toBe(date);
    expect(d.trend[6].total).toBe(4);
    expect(d.trend[0].total).toBe(0);
  });

  it("admin can narrow it to one doctor", async () => {
    const res = await summary(admin, { doctorId: docB.id });
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.completed).toBe(0);
    expect(res.body.data.avgConsultMinutes).toBeNull();
  });

  it("a doctor only ever sees their own numbers, even when asking for another doctor", async () => {
    const own = await summary(docAToken);
    expect(own.status).toBe(200);
    expect(own.body.data.total).toBe(3);
    const spoof = await summary(docAToken, { doctorId: docB.id });
    expect(spoof.body.data.total).toBe(3);
  });

  it("patients are refused", async () => {
    expect((await summary(patient)).status).toBe(403);
  });

  it("requires a valid date", async () => {
    expect((await api.get("/analytics/summary").query({ date: "tomorrow" }).set("Authorization", `Bearer ${admin}`)).status).toBe(400);
    expect((await api.get("/analytics/summary").set("Authorization", `Bearer ${admin}`)).status).toBe(400);
  });

  it("does not leak another clinic group's numbers", async () => {
    const other = await createTestTenant();
    const otherAdmin = adminToken((await createTestUser(other.id, "admin")).id, other.id);
    const res = await summary(otherAdmin);
    expect(res.body.data.total).toBe(0);
    expect(res.body.data.trend.every((t: { total: number }) => t.total === 0)).toBe(true);
  });

  it("undoing a done appointment clears its completion time", async () => {
    await api
      .patch("/admin/appointment-status")
      .set("Authorization", `Bearer ${admin}`)
      .send({ appointmentId: apptIds[0], status: "waiting" });
    const r = await db.execute(sql`SELECT called_at, completed_at FROM appointments WHERE id = ${apptIds[0]}`);
    const row = r.rows[0] as { called_at: Date | null; completed_at: Date | null };
    expect(row.called_at).toBeNull();
    expect(row.completed_at).toBeNull();
  });
});
