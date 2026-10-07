import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server as HttpServer } from "http";
import type { AddressInfo } from "net";
import { io as connect, type Socket } from "socket.io-client";
import { initSocket } from "../src/socket/index.js";
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

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const waitFor = <T>(s: Socket, event: string, ms = 3000) =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    s.once(event, (d: T) => {
      clearTimeout(t);
      resolve(d);
    });
  });
const settle = (ms = 300) => new Promise((r) => setTimeout(r, ms));

/** A doctor may only see and manage THEIR OWN doctor's patients; admins see the whole clinic group. */
describe("Doctor privacy: other doctors' patients", () => {
  let httpServer: HttpServer;
  let url: string;
  let tenantId: string;
  let clinicId: string;
  let doctorAId: string;
  let doctorBId: string;
  let docATkn: string;
  let docBTkn: string;
  let adminTkn: string;
  let patientTkn: string;
  let date: string;
  let appointmentId: string; // booked with doctor B
  const sockets: Socket[] = [];

  beforeAll(async () => {
    httpServer = createServer();
    initSocket(httpServer);
    await new Promise<void>((r) => httpServer.listen(0, r));
    url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;

    tenantId = (await createTestTenant()).id;
    clinicId = (await createTestClinic(tenantId)).id;
    const ua = await createTestUser(tenantId, "doctor", { email: `da-${uniq()}@test.com` });
    const ub = await createTestUser(tenantId, "doctor", { email: `db-${uniq()}@test.com` });
    doctorAId = (await createTestDoctor(tenantId, clinicId, { userId: ua.id, name: "Dr A" })).id;
    doctorBId = (await createTestDoctor(tenantId, clinicId, { userId: ub.id, name: "Dr B" })).id;
    docATkn = doctorToken(ua.id, tenantId);
    docBTkn = doctorToken(ub.id, tenantId);
    const admin = await createTestUser(tenantId, "admin", { email: `ad-${uniq()}@test.com` });
    adminTkn = adminToken(admin.id, tenantId);
    const patient = await createTestUser(tenantId, "patient", { email: `pt-${uniq()}@test.com` });
    patientTkn = patientToken(patient.id, tenantId);

    date = nextWeekday(1);
    for (const id of [doctorAId, doctorBId]) {
      await createTestSchedule(tenantId, id, 1, { startTime: "09:00", endTime: "11:00", slotDurationMinutes: 30 });
    }
    const avail = await api.get("/avail").query({ doctorId: doctorBId, date }).set("Authorization", `Bearer ${patientTkn}`);
    const book = await api
      .post("/book")
      .set("Authorization", `Bearer ${patientTkn}`)
      .send({
        clinicId,
        doctorId: doctorBId,
        slotId: avail.body.data.slots[0].id,
        patientName: "Private Patient",
        patientPhone: "+919800000042",
        symptoms: "confidential symptoms",
      });
    appointmentId = book.body.data.id;
  });

  afterAll(async () => {
    sockets.forEach((s) => s.close());
    await new Promise((r) => httpServer.close(r));
  });

  const slotOf = async (tkn: string) => {
    const res = await api.get("/avail").query({ doctorId: doctorBId, date }).set("Authorization", `Bearer ${tkn}`);
    return res.body.data.slots.find((s: { appointment: unknown }) => s.appointment).appointment;
  };

  it("the owning doctor sees full patient details", async () => {
    const a = await slotOf(docBTkn);
    expect(a.patientName).toBe("Private Patient");
    expect(a.symptoms).toBe("confidential symptoms");
  });

  it("an admin sees full patient details", async () => {
    expect((await slotOf(adminTkn)).patientName).toBe("Private Patient");
  });

  it("ANOTHER doctor sees only that the token exists (no name, phone or symptoms)", async () => {
    const a = await slotOf(docATkn);
    expect(a.tokenNumber).toBe(1);
    expect(a).not.toHaveProperty("patientName");
    expect(a).not.toHaveProperty("patientPhone");
    expect(a).not.toHaveProperty("symptoms");
    expect(a).not.toHaveProperty("patientUserId");
  });

  it("another doctor cannot cancel or reschedule that patient's booking", async () => {
    const h = { Authorization: `Bearer ${docATkn}` };
    expect((await api.post("/cancel").set(h).send({ appointmentId })).status).toBe(404);
    expect((await api.post("/reschedule").set(h).send({ appointmentId, newSlotId: "00000000-0000-0000-0000-000000000001" })).status).toBe(404);
  });

  it("live queue: another doctor gets the public payload, the owning doctor the full one", async () => {
    const other = connect(url, { auth: { token: docATkn }, transports: ["websocket"], reconnection: false, forceNew: true });
    const owner = connect(url, { auth: { token: docBTkn }, transports: ["websocket"], reconnection: false, forceNew: true });
    sockets.push(other, owner);
    await Promise.all([waitFor(other, "connect"), waitFor(owner, "connect")]);
    other.emit("queue:subscribe", doctorBId);
    owner.emit("queue:subscribe", doctorBId);
    await settle();

    const otherMsg = waitFor<any>(other, "queue:update");
    const ownerMsg = waitFor<any>(owner, "queue:update");
    const res = await api.post("/admin/next").set("Authorization", `Bearer ${adminTkn}`).send({ doctorId: doctorBId, date });
    expect(res.status).toBe(200);

    const o = await otherMsg;
    const w = await ownerMsg;
    expect(JSON.stringify(o)).not.toContain("Private Patient");
    expect(o.appointments[0]).not.toHaveProperty("patientName");
    expect(w.appointments[0].patientName).toBe("Private Patient");
  });

  it("the owning doctor can cancel their own patient's booking", async () => {
    const res = await api.post("/cancel").set("Authorization", `Bearer ${docBTkn}`).send({ appointmentId });
    expect([200, 400]).toContain(res.status); // 400 = already in the cabin after the NEXT above
    expect(res.status).not.toBe(404);
  });
});
