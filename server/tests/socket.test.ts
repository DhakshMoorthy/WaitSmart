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
  patientToken,
  nextWeekday,
} from "./helpers.js";

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function client(url: string, token?: string): Socket {
  return connect(url, {
    auth: token ? { token } : {},
    transports: ["websocket"],
    reconnection: false,
    forceNew: true,
  });
}

const waitFor = <T>(s: Socket, event: string, ms = 3000) =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    s.once(event, (data: T) => {
      clearTimeout(t);
      resolve(data);
    });
  });

const settle = (ms = 300) => new Promise((r) => setTimeout(r, ms));

describe("Socket.io auth + room isolation (C4)", () => {
  let httpServer: HttpServer;
  let url: string;
  let tenantId: string;
  let doctorId: string;
  let clinicId: string;
  let date: string;
  let adminTkn: string;
  let patientTkn: string;
  let otherTenantPatientTkn: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    httpServer = createServer();
    initSocket(httpServer);
    await new Promise<void>((r) => httpServer.listen(0, r));
    url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;

    const tenant = await createTestTenant();
    tenantId = tenant.id;
    clinicId = (await createTestClinic(tenantId)).id;
    doctorId = (await createTestDoctor(tenantId, clinicId)).id;
    date = nextWeekday(1);
    await createTestSchedule(tenantId, doctorId, 1, { startTime: "09:00", endTime: "10:00", slotDurationMinutes: 30 });

    const admin = await createTestUser(tenantId, "admin", { email: `sa-${uniq()}@test.com` });
    const patient = await createTestUser(tenantId, "patient", { email: `sp-${uniq()}@test.com` });
    adminTkn = adminToken(admin.id, tenantId);
    patientTkn = patientToken(patient.id, tenantId);

    const other = await createTestTenant();
    const stranger = await createTestUser(other.id, "patient", { email: `so-${uniq()}@test.com` });
    otherTenantPatientTkn = patientToken(stranger.id, other.id);

    // One booking so the queue has someone in it (name must NOT reach patients).
    const avail = await api.get("/avail").query({ doctorId, date }).set("Authorization", `Bearer ${patientTkn}`);
    await api
      .post("/book")
      .set("Authorization", `Bearer ${patientTkn}`)
      .send({
        clinicId,
        doctorId,
        slotId: avail.body.data.slots[0].id,
        patientName: "Private Person",
        symptoms: "private symptoms",
      });
  });

  afterAll(async () => {
    sockets.forEach((s) => s.close());
    await new Promise((r) => httpServer.close(r));
  });

  const open = (token?: string) => {
    const s = client(url, token);
    sockets.push(s);
    return s;
  };

  it("rejects a connection with no token", async () => {
    const s = open();
    const err = await waitFor<Error>(s, "connect_error");
    expect(err.message).toBe("UNAUTHENTICATED");
  });

  it("rejects a connection with a bad token", async () => {
    const s = open("not.a.jwt");
    const err = await waitFor<Error>(s, "connect_error");
    expect(err.message).toBe("UNAUTHENTICATED");
  });

  it("patients get token numbers only; staff get the full payload", async () => {
    const patientSock = open(patientTkn);
    const staffSock = open(adminTkn);
    await Promise.all([waitFor(patientSock, "connect"), waitFor(staffSock, "connect")]);

    patientSock.emit("queue:subscribe", doctorId);
    staffSock.emit("queue:subscribe", doctorId);
    await settle();

    const patientMsg = waitFor<any>(patientSock, "queue:update");
    const staffMsg = waitFor<any>(staffSock, "queue:update");
    const res = await api.post("/admin/next").set("Authorization", `Bearer ${adminTkn}`).send({ doctorId, date });
    expect(res.status).toBe(200);

    const pub = await patientMsg;
    const full = await staffMsg;

    expect(pub.nowServing).toBe(1);
    expect(JSON.stringify(pub)).not.toContain("Private Person");
    expect(pub).not.toHaveProperty("currentAppointment");
    expect(pub.appointments[0]).not.toHaveProperty("patientName");
    expect(pub.appointments[0]).not.toHaveProperty("doctorNotes");

    expect(full.appointments[0].patientName).toBe("Private Person");
  });

  it("a user from another tenant cannot join this doctor's room", async () => {
    const strangerSock = open(otherTenantPatientTkn);
    await waitFor(strangerSock, "connect");
    strangerSock.emit("queue:subscribe", doctorId);
    await settle();

    let received = false;
    strangerSock.on("queue:update", () => (received = true));
    await api.post("/admin/skip").set("Authorization", `Bearer ${adminTkn}`).send({ doctorId, date });
    await settle();
    expect(received).toBe(false);
  });
});
