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
  nextWeekday,
} from "./helpers.js";

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

describe("Role + ownership checks (H1, H2, H3, H7)", () => {
  let tenantId: string;
  let clinicId: string;
  let doctorAId: string;
  let doctorBId: string;
  let adminTkn: string;
  let doctorATkn: string;
  let ownerTkn: string;
  let strangerTkn: string;
  let date: string;
  let slotIds: string[];
  let appointmentId: string;

  beforeAll(async () => {
    const tenant = await createTestTenant();
    tenantId = tenant.id;
    clinicId = (await createTestClinic(tenantId)).id;

    const admin = await createTestUser(tenantId, "admin", { email: `adm-${uniq()}@test.com` });
    adminTkn = adminToken(admin.id, tenantId);

    const docUserA = await createTestUser(tenantId, "doctor", { email: `da-${uniq()}@test.com` });
    const docUserB = await createTestUser(tenantId, "doctor", { email: `db-${uniq()}@test.com` });
    doctorAId = (await createTestDoctor(tenantId, clinicId, { userId: docUserA.id, name: "Dr A" })).id;
    doctorBId = (await createTestDoctor(tenantId, clinicId, { userId: docUserB.id, name: "Dr B" })).id;
    doctorATkn = doctorToken(docUserA.id, tenantId);

    const owner = await createTestUser(tenantId, "patient", { email: `own-${uniq()}@test.com` });
    const stranger = await createTestUser(tenantId, "patient", { email: `str-${uniq()}@test.com` });
    ownerTkn = patientToken(owner.id, tenantId);
    strangerTkn = patientToken(stranger.id, tenantId);

    date = nextWeekday(1);
    for (const id of [doctorAId, doctorBId]) {
      await createTestSchedule(tenantId, id, 1, {
        startTime: "09:00",
        endTime: "11:00",
        slotDurationMinutes: 30,
      });
    }

    const avail = await api
      .get("/avail")
      .query({ doctorId: doctorAId, date })
      .set("Authorization", `Bearer ${ownerTkn}`);
    slotIds = avail.body.data.slots.map((x: { id: string }) => x.id);

    const book = await api
      .post("/book")
      .set("Authorization", `Bearer ${ownerTkn}`)
      .send({
        clinicId,
        doctorId: doctorAId,
        slotId: slotIds[0],
        patientName: "Owner Patient",
        patientPhone: "+919800000001",
        symptoms: "secret symptoms",
      });
    appointmentId = book.body.data.id;
  });

  // H1
  it("patients cannot create / edit / delete clinics or doctors", async () => {
    const h = { Authorization: `Bearer ${strangerTkn}` };
    expect((await api.post("/clinics").set(h).send({ name: "Evil", address: "x" })).status).toBe(403);
    expect((await api.patch(`/clinics/${clinicId}`).set(h).send({ name: "Pwned" })).status).toBe(403);
    expect((await api.delete(`/clinics/${clinicId}`).set(h)).status).toBe(403);
    expect((await api.patch(`/doctors/${doctorAId}`).set(h).send({ name: "Pwned" })).status).toBe(403);
    expect((await api.delete(`/doctors/${doctorAId}`).set(h)).status).toBe(403);
    expect(
      (await api.put(`/doctors/${doctorAId}/schedules`).set(h).send({ schedules: [] })).status,
    ).toBe(403);
  });

  it("a doctor can edit their own record but not another doctor's", async () => {
    const own = await api
      .patch(`/doctors/${doctorAId}`)
      .set("Authorization", `Bearer ${doctorATkn}`)
      .send({ experienceYears: 9 });
    expect(own.status).toBe(200);

    const other = await api
      .patch(`/doctors/${doctorBId}`)
      .set("Authorization", `Bearer ${doctorATkn}`)
      .send({ experienceYears: 9 });
    expect(other.status).toBe(403);
  });

  // H2
  it("strangers see booked slots without patient details", async () => {
    const res = await api
      .get("/avail")
      .query({ doctorId: doctorAId, date })
      .set("Authorization", `Bearer ${strangerTkn}`);
    const booked = res.body.data.slots.find((x: { id: string }) => x.id === slotIds[0]);
    expect(booked.appointment.tokenNumber).toBe(1);
    expect(booked.appointment).not.toHaveProperty("patientName");
    expect(booked.appointment).not.toHaveProperty("patientPhone");
    expect(booked.appointment).not.toHaveProperty("symptoms");
    expect(booked.appointment).not.toHaveProperty("patientUserId");
  });

  it("the owner and staff still see full details", async () => {
    for (const t of [ownerTkn, adminTkn]) {
      const res = await api
        .get("/avail")
        .query({ doctorId: doctorAId, date })
        .set("Authorization", `Bearer ${t}`);
      const booked = res.body.data.slots.find((x: { id: string }) => x.id === slotIds[0]);
      expect(booked.appointment.patientName).toBe("Owner Patient");
    }
  });

  // H3
  it("strangers cannot cancel or reschedule someone else's booking", async () => {
    const h = { Authorization: `Bearer ${strangerTkn}` };
    expect((await api.post("/cancel").set(h).send({ appointmentId })).status).toBe(404);
    expect(
      (await api.post("/reschedule").set(h).send({ appointmentId, newSlotId: slotIds[1] })).status,
    ).toBe(404);
  });

  it("the owner can reschedule, then cancel", async () => {
    const h = { Authorization: `Bearer ${ownerTkn}` };
    const re = await api.post("/reschedule").set(h).send({ appointmentId, newSlotId: slotIds[1] });
    expect(re.status).toBe(200);
    const cancel = await api.post("/cancel").set(h).send({ appointmentId: re.body.data.id });
    expect(cancel.status).toBe(200);
  });

  // H7
  it("a doctor cannot run another doctor's queue", async () => {
    const res = await api
      .post("/admin/next")
      .set("Authorization", `Bearer ${doctorATkn}`)
      .send({ doctorId: doctorBId, date });
    expect(res.status).toBe(403);
  });

  it("a doctor can run their own queue; an admin can run any", async () => {
    const own = await api
      .post("/admin/next")
      .set("Authorization", `Bearer ${doctorATkn}`)
      .send({ doctorId: doctorAId, date });
    expect(own.status).toBe(200);

    const adm = await api
      .post("/admin/next")
      .set("Authorization", `Bearer ${adminTkn}`)
      .send({ doctorId: doctorBId, date });
    expect(adm.status).toBe(200);
  });

  it("an admin from another tenant cannot touch this tenant's queue", async () => {
    const other = await createTestTenant();
    const otherAdmin = await createTestUser(other.id, "admin", { email: `oa-${uniq()}@test.com` });
    const res = await api
      .post("/admin/reset")
      .set("Authorization", `Bearer ${adminToken(otherAdmin.id, other.id)}`)
      .send({ doctorId: doctorAId, date });
    expect(res.status).toBe(404);
  });
});

describe("Refresh token rotation (H5)", () => {
  const register = () =>
    api.post("/auth/register").send({
      name: "Rotate User",
      email: `rot-${uniq()}@test.com`,
      password: "Secure@123",
    });

  it("a refresh token works once; reuse is rejected and kills the session", async () => {
    const reg = await register();
    const first = await api.post("/auth/refresh").send({ refreshToken: reg.body.refreshToken });
    expect(first.status).toBe(200);

    const replay = await api.post("/auth/refresh").send({ refreshToken: reg.body.refreshToken });
    expect(replay.status).toBe(401);

    // Reuse detection revoked the whole family, including the freshly issued token
    const afterRevoke = await api.post("/auth/refresh").send({ refreshToken: first.body.refreshToken });
    expect(afterRevoke.status).toBe(401);
  });

  it("logout revokes the refresh token", async () => {
    const reg = await register();
    expect((await api.post("/auth/logout").send({ refreshToken: reg.body.refreshToken })).status).toBe(204);
    expect((await api.post("/auth/refresh").send({ refreshToken: reg.body.refreshToken })).status).toBe(401);
  });
});
