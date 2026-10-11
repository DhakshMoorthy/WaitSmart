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

describe("Services", () => {
  let tenantId: string;
  let clinicId: string;
  let otherClinicId: string;
  let admin: string;
  let patient: string;
  let docA: { id: string };
  let docB: { id: string };
  let docAToken: string;
  let date: string;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    tenantId = (await createTestTenant()).id;
    clinicId = (await createTestClinic(tenantId)).id;
    otherClinicId = (await createTestClinic(tenantId)).id;
    admin = adminToken((await createTestUser(tenantId, "admin")).id, tenantId);
    patient = patientToken((await createTestUser(tenantId, "patient")).id, tenantId);
    const du = await createTestUser(tenantId, "doctor");
    docA = await createTestDoctor(tenantId, clinicId, { userId: du.id });
    docB = await createTestDoctor(tenantId, clinicId);
    docAToken = doctorToken(du.id, tenantId);
    date = nextWeekday(3);
    for (const d of [docA, docB]) {
      await createTestSchedule(tenantId, d.id, 3, { startTime: "10:00", endTime: "12:00", slotDurationMinutes: 30 });
    }
  });

  describe("managing the catalog", () => {
    it("admin creates doctor-specific and clinic-wide services; patients can read but not write", async () => {
      const own = await api
        .post("/services")
        .set(auth(admin))
        .send({ clinicId, doctorId: docA.id, name: "Follow-up", durationMinutes: 15 });
      expect(own.status).toBe(201);
      expect(own.body.data.durationMinutes).toBe(15);

      const wide = await api.post("/services").set(auth(admin)).send({ clinicId, name: "General consultation", durationMinutes: 30 });
      expect(wide.status).toBe(201);
      expect(wide.body.data.doctorId).toBeNull();

      const list = await api.get("/services").set(auth(patient)).query({ doctorId: docA.id });
      expect(list.status).toBe(200);
      expect(list.body.data.map((s: { name: string }) => s.name).sort()).toEqual(["Follow-up", "General consultation"]);

      // docB sees only the clinic-wide one
      const listB = await api.get("/services").set(auth(patient)).query({ doctorId: docB.id });
      expect(listB.body.data.map((s: { name: string }) => s.name)).toEqual(["General consultation"]);

      const denied = await api.post("/services").set(auth(patient)).send({ clinicId, doctorId: docA.id, name: "Free stuff" });
      expect(denied.status).toBe(403);
    });

    it("a doctor manages only their own services, and cannot create clinic-wide ones", async () => {
      const mine = await api.post("/services").set(auth(docAToken)).send({ clinicId, doctorId: docA.id, name: "Skin check", durationMinutes: 20 });
      expect(mine.status).toBe(201);

      const forOther = await api.post("/services").set(auth(docAToken)).send({ clinicId, doctorId: docB.id, name: "Sneaky" });
      expect(forOther.status).toBe(403);
      const wide = await api.post("/services").set(auth(docAToken)).send({ clinicId, name: "Sneaky wide" });
      expect(wide.status).toBe(403);

      const theirs = await api.post("/services").set(auth(admin)).send({ clinicId, doctorId: docB.id, name: "B only", durationMinutes: 10 });
      expect((await api.patch(`/services/${theirs.body.data.id}`).set(auth(docAToken)).send({ name: "Hijacked" })).status).toBe(403);
      expect((await api.delete(`/services/${theirs.body.data.id}`).set(auth(docAToken))).status).toBe(403);

      const rename = await api.patch(`/services/${mine.body.data.id}`).set(auth(docAToken)).send({ name: "Skin consultation", durationMinutes: 25 });
      expect(rename.status).toBe(200);
      expect(rename.body.data.name).toBe("Skin consultation");
      expect(rename.body.data.durationMinutes).toBe(25);
      expect((await api.delete(`/services/${mine.body.data.id}`).set(auth(docAToken))).status).toBe(200);
    });

    it("validates input and the clinic / doctor relationship", async () => {
      expect((await api.post("/services").set(auth(admin)).send({ clinicId, name: "x" })).status).toBe(400);
      expect((await api.post("/services").set(auth(admin)).send({ clinicId, name: "Ok name", durationMinutes: 1 })).status).toBe(400);
      expect((await api.post("/services").set(auth(admin)).send({ clinicId: otherClinicId, doctorId: docA.id, name: "Wrong clinic" })).status).toBe(400);
      expect((await api.get("/services").set(auth(patient))).status).toBe(400);
    });

    it("does not leak across tenants", async () => {
      const t2 = await createTestTenant();
      const c2 = await createTestClinic(t2.id);
      const a2 = adminToken((await createTestUser(t2.id, "admin")).id, t2.id);
      const created = await api.post("/services").set(auth(admin)).send({ clinicId, name: "Tenant one only", durationMinutes: 15 });
      expect((await api.get("/services").set(auth(a2)).query({ clinicId: c2.id })).body.data).toEqual([]);
      expect((await api.get("/services").set(auth(a2)).query({ doctorId: docA.id })).status).toBe(404);
      expect((await api.delete(`/services/${created.body.data.id}`).set(auth(a2))).status).toBe(404);
    });
  });

  describe("booking with a service", () => {
    const slotOf = async (doctorId: string, index: number) => {
      const res = await api.get("/avail").query({ doctorId, date }).set(auth(patient));
      return res.body.data.slots[index].id as string;
    };

    it("stores the service on the appointment, shows it to staff, and keeps it when rescheduling", async () => {
      const svc = (await api.post("/services").set(auth(admin)).send({ clinicId, doctorId: docA.id, name: "Vaccination", durationMinutes: 15 })).body.data;
      const book = await api
        .post("/book")
        .set(auth(patient))
        .send({ clinicId, doctorId: docA.id, slotId: await slotOf(docA.id, 0), patientName: "Pat Ient", serviceId: svc.id });
      expect(book.status).toBe(201);
      expect(book.body.data.serviceName).toBe("Vaccination");
      expect(book.body.data.serviceId).toBe(svc.id);

      const staffView = await api.get("/avail").query({ doctorId: docA.id, date }).set(auth(admin));
      const booked = staffView.body.data.slots.find((s: { appointment: { id: string } | null }) => s.appointment?.id === book.body.data.id);
      expect(booked.appointment.serviceName).toBe("Vaccination");

      const moved = await api
        .post("/reschedule")
        .set(auth(patient))
        .send({ appointmentId: book.body.data.id, newSlotId: await slotOf(docA.id, 3) });
      expect(moved.status).toBe(200);
      expect(moved.body.data.serviceName).toBe("Vaccination");
    });

    it("rejects a service the doctor does not offer, another clinic's, or an unknown one", async () => {
      const bOnly = (await api.post("/services").set(auth(admin)).send({ clinicId, doctorId: docB.id, name: "B special", durationMinutes: 15 })).body.data;
      const elsewhere = (await api.post("/services").set(auth(admin)).send({ clinicId: otherClinicId, name: "Other clinic", durationMinutes: 15 })).body.data;
      for (const serviceId of [bOnly.id, elsewhere.id, "00000000-0000-0000-0000-000000000000"]) {
        const res = await api
          .post("/book")
          .set(auth(patient))
          .send({ clinicId, doctorId: docA.id, slotId: await slotOf(docA.id, 1), patientName: "Pat Ient", serviceId });
        expect(res.status).toBe(400);
        expect(JSON.stringify(res.body)).toContain("INVALID_SERVICE");
      }
      // a failed booking must not leave the slot claimed
      const retry = await api.post("/book").set(auth(patient)).send({ clinicId, doctorId: docA.id, slotId: await slotOf(docA.id, 1), patientName: "Pat Ient" });
      expect(retry.status).toBe(201);
    });

    it("works without a service, and the name survives deleting the service", async () => {
      const plain = await api.post("/book").set(auth(patient)).send({ clinicId, doctorId: docB.id, slotId: await slotOf(docB.id, 0), patientName: "No Service" });
      expect(plain.status).toBe(201);
      expect(plain.body.data.serviceName).toBeNull();

      const svc = (await api.post("/services").set(auth(admin)).send({ clinicId, doctorId: docB.id, name: "To be deleted", durationMinutes: 15 })).body.data;
      const book = await api
        .post("/book")
        .set(auth(patient))
        .send({ clinicId, doctorId: docB.id, slotId: await slotOf(docB.id, 1), patientName: "Keeps Name", serviceId: svc.id });
      expect((await api.delete(`/services/${svc.id}`).set(auth(admin))).status).toBe(200);

      const history = await api.get("/patients/history").set(auth(patient));
      const row = history.body.data.find((h: { id: string }) => h.id === book.body.data.id);
      expect(row.serviceName).toBe("To be deleted");
    });
  });
});
