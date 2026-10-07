import { describe, it, expect, beforeAll } from "vitest";
import {
  api,
  createTestTenant,
  createTestUser,
  createTestClinic,
  createTestDoctor,
  createTestSchedule,
  adminToken,
  patientToken,
  nextWeekday,
} from "./helpers.js";

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Patients are called in appointment-time order, not booking order. */
describe("Queue order follows slot time", () => {
  let tenantId: string;
  let clinicId: string;
  let doctorId: string;
  let adminTkn: string;
  let tokenA: string;
  let tokenB: string;
  let date: string;
  let slots: { id: string }[];

  const book = async (tkn: string, slotId: string, patientName: string) => {
    const res = await api
      .post("/book")
      .set("Authorization", `Bearer ${tkn}`)
      .send({ clinicId, doctorId, slotId, patientName });
    expect(res.status).toBe(201);
    return res.body.data;
  };

  beforeAll(async () => {
    tenantId = (await createTestTenant()).id;
    clinicId = (await createTestClinic(tenantId)).id;
    const doc = await createTestUser(tenantId, "doctor", { email: `d-${uniq()}@test.com` });
    doctorId = (await createTestDoctor(tenantId, clinicId, { userId: doc.id })).id;
    const admin = await createTestUser(tenantId, "admin", { email: `a-${uniq()}@test.com` });
    adminTkn = adminToken(admin.id, tenantId);
    const pa = await createTestUser(tenantId, "patient", { email: `pa-${uniq()}@test.com` });
    const pb = await createTestUser(tenantId, "patient", { email: `pb-${uniq()}@test.com` });
    tokenA = patientToken(pa.id, tenantId);
    tokenB = patientToken(pb.id, tenantId);
    date = nextWeekday(1);
    await createTestSchedule(tenantId, doctorId, 1, { startTime: "09:00", endTime: "12:00", slotDurationMinutes: 30 });
    const avail = await api.get("/avail").query({ doctorId, date }).set("Authorization", `Bearer ${tokenA}`);
    slots = avail.body.data.slots;
  });

  it("calls the earliest slot first even if it was booked last", async () => {
    const late = await book(tokenA, slots[slots.length - 1].id, "Booked First Latest Slot");
    const early = await book(tokenB, slots[0].id, "Booked Second Earliest Slot");
    expect(late.tokenNumber).toBeLessThan(early.tokenNumber);

    const first = await api.post("/admin/next").set("Authorization", `Bearer ${adminTkn}`).send({ doctorId, date });
    expect(first.status).toBe(200);
    expect(first.body.data.currentAppointment.patientName).toBe("Booked Second Earliest Slot");

    const second = await api.post("/admin/next").set("Authorization", `Bearer ${adminTkn}`).send({ doctorId, date });
    expect(second.body.data.currentAppointment.patientName).toBe("Booked First Latest Slot");
  });
});
