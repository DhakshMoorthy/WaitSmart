import { describe, it, expect, beforeAll } from "vitest";
import {
  api,
  createTestTenant,
  createTestUser,
  createTestClinic,
  createTestDoctor,
  createTestSchedule,
  patientToken,
  nextWeekday,
} from "./helpers.js";

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

describe("Booking integrity (M1)", () => {
  let tenantId: string;
  let clinicId: string;
  let doctorId: string;
  let date: string;
  let slotIds: string[];
  let tokens: string[];

  beforeAll(async () => {
    tenantId = (await createTestTenant()).id;
    clinicId = (await createTestClinic(tenantId)).id;
    doctorId = (await createTestDoctor(tenantId, clinicId)).id;
    date = nextWeekday(3);
    await createTestSchedule(tenantId, doctorId, 3, { startTime: "09:00", endTime: "13:00", slotDurationMinutes: 30 });

    tokens = [];
    for (let i = 0; i < 6; i++) {
      const u = await createTestUser(tenantId, "patient", { email: `race-${i}-${uniq()}@test.com` });
      tokens.push(patientToken(u.id, tenantId));
    }
    const avail = await api.get("/avail").query({ doctorId, date }).set("Authorization", `Bearer ${tokens[0]}`);
    slotIds = avail.body.data.slots.map((s: { id: string }) => s.id);
  });

  const book = (token: string, slotId: string) =>
    api
      .post("/book")
      .set("Authorization", `Bearer ${token}`)
      .send({ clinicId, doctorId, slotId, patientName: "Racer", symptoms: "x" });

  it("only one of many simultaneous bookings for the same slot succeeds", async () => {
    const results = await Promise.all(tokens.map((t) => book(t, slotIds[0])));
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(tokens.length - 1);
  });

  it("simultaneous bookings of different slots get distinct token numbers", async () => {
    const results = await Promise.all(tokens.map((t, i) => book(t, slotIds[i + 1] ?? slotIds[1])));
    const ok = results.filter((r) => r.status === 201);
    const numbers = ok.map((r) => r.body.data.tokenNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("a failed reschedule leaves the original booking intact", async () => {
    const owner = await createTestUser(tenantId, "patient", { email: `resch-${uniq()}@test.com` });
    const tkn = patientToken(owner.id, tenantId);
    const date2 = nextWeekday(3);
    const avail = await api.get("/avail").query({ doctorId, date: date2 }).set("Authorization", `Bearer ${tkn}`);
    const free = avail.body.data.slots.filter((s: { status: string }) => s.status === "available");
    const taken = avail.body.data.slots.find((s: { status: string }) => s.status === "booked");
    expect(free.length).toBeGreaterThan(0);
    expect(taken).toBeTruthy();

    const mine = await book(tkn, free[0].id);
    expect(mine.status).toBe(201);

    // Try to move onto a slot someone else holds -> 409, and my booking must survive.
    const re = await api
      .post("/reschedule")
      .set("Authorization", `Bearer ${tkn}`)
      .send({ appointmentId: mine.body.data.id, newSlotId: taken.id });
    expect(re.status).toBe(409);

    const check = await api.get("/avail").query({ doctorId, date: date2 }).set("Authorization", `Bearer ${tkn}`);
    const myslot = check.body.data.slots.find((s: { id: string }) => s.id === free[0].id);
    expect(myslot.status).toBe("booked");
    expect(myslot.appointment.status).toBe("waiting");
  });
});
