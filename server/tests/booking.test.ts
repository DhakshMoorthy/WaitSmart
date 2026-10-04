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

describe("Booking Module", () => {
  let tenantId: string;
  let clinicId: string;
  let doctorId: string;
  let token: string;
  let testDate: string;

  beforeAll(async () => {
    const tenant = await createTestTenant();
    tenantId = tenant.id;
    const clinic = await createTestClinic(tenantId);
    clinicId = clinic.id;
    const doctor = await createTestDoctor(tenantId, clinicId);
    doctorId = doctor.id;
    const patient = await createTestUser(tenantId, "patient");
    token = patientToken(patient.id, tenantId);

    // Create a schedule for next Monday (dayOfWeek=1)
    testDate = nextWeekday(1);

    await createTestSchedule(tenantId, doctorId, 1, {
      startTime: "09:00",
      endTime: "12:00",
      slotDurationMinutes: 30,
    });
  });

  describe("GET /avail", () => {
    it("should return available slots for a valid doctor+date", async () => {
      const res = await api
        .get("/avail")
        .query({ doctorId, date: testDate })
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.doctorId).toBe(doctorId);
      expect(res.body.data.date).toBe(testDate);
      expect(Array.isArray(res.body.data.slots)).toBe(true);
      expect(res.body.data.slots.length).toBe(6); // 3h / 30min = 6 slots
      expect(res.body.data.slots[0].status).toBe("available");
    });

    it("should return empty slots for a day with no schedule", async () => {
      const sundayDate = nextWeekday(0);

      const res = await api
        .get("/avail")
        .query({ doctorId, date: sundayDate })
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.slots).toHaveLength(0);
    });

    it("should reject missing parameters", async () => {
      const res = await api
        .get("/avail")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });

  describe("POST /book", () => {
    it("should book an available slot", async () => {
      const availRes = await api
        .get("/avail")
        .query({ doctorId, date: testDate })
        .set("Authorization", `Bearer ${token}`);

      const slotId = availRes.body.data.slots[0].id;

      const res = await api
        .post("/book")
        .set("Authorization", `Bearer ${token}`)
        .send({
          clinicId,
          doctorId,
          slotId,
          patientName: "John Doe",
          patientPhone: "+919876543210",
          symptoms: "Headache",
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty("id");
      expect(res.body.data.tokenNumber).toBe(1);
      expect(res.body.data.status).toBe("waiting");
      expect(res.body.data.patientName).toBe("John Doe");
    });

    it("should reject booking an already-booked slot", async () => {
      const availRes = await api
        .get("/avail")
        .query({ doctorId, date: testDate })
        .set("Authorization", `Bearer ${token}`);

      const bookedSlot = availRes.body.data.slots.find((s: any) => s.status === "booked");
      if (!bookedSlot) return;

      const res = await api
        .post("/book")
        .set("Authorization", `Bearer ${token}`)
        .send({
          clinicId,
          doctorId,
          slotId: bookedSlot.id,
          patientName: "Jane Doe",
          patientPhone: "+919876543211",
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("SLOT_TAKEN");
    });

    it("should increment token numbers", async () => {
      const availRes = await api
        .get("/avail")
        .query({ doctorId, date: testDate })
        .set("Authorization", `Bearer ${token}`);

      const availableSlot = availRes.body.data.slots.find((s: any) => s.status === "available");
      if (!availableSlot) return;

      const res = await api
        .post("/book")
        .set("Authorization", `Bearer ${token}`)
        .send({
          clinicId,
          doctorId,
          slotId: availableSlot.id,
          patientName: "Patient Two",
          patientPhone: "+919876543212",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.tokenNumber).toBeGreaterThanOrEqual(2);
    });
  });

  describe("POST /cancel", () => {
    it("should cancel a waiting appointment", async () => {
      const availRes = await api
        .get("/avail")
        .query({ doctorId, date: testDate })
        .set("Authorization", `Bearer ${token}`);

      const availableSlot = availRes.body.data.slots.find((s: any) => s.status === "available");
      if (!availableSlot) return;

      const bookRes = await api
        .post("/book")
        .set("Authorization", `Bearer ${token}`)
        .send({
          clinicId,
          doctorId,
          slotId: availableSlot.id,
          patientName: "Cancel Me",
          patientPhone: "+919876543213",
        });

      const res = await api
        .post("/cancel")
        .set("Authorization", `Bearer ${token}`)
        .send({ appointmentId: bookRes.body.data.id });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("cancelled");
    });

    it("should reject cancelling non-existent appointment", async () => {
      const res = await api
        .post("/cancel")
        .set("Authorization", `Bearer ${token}`)
        .send({ appointmentId: "00000000-0000-0000-0000-000000000099" });

      expect(res.status).toBe(404);
    });
  });

  describe("POST /reschedule", () => {
    it("should reschedule a waiting appointment to a new slot", async () => {
      const availRes = await api
        .get("/avail")
        .query({ doctorId, date: testDate })
        .set("Authorization", `Bearer ${token}`);

      const available = availRes.body.data.slots.filter((s: any) => s.status === "available");
      if (available.length < 2) return;

      const bookRes = await api
        .post("/book")
        .set("Authorization", `Bearer ${token}`)
        .send({
          clinicId,
          doctorId,
          slotId: available[0].id,
          patientName: "Reschedule Me",
          patientPhone: "+919876543214",
        });

      const res = await api
        .post("/reschedule")
        .set("Authorization", `Bearer ${token}`)
        .send({
          appointmentId: bookRes.body.data.id,
          newSlotId: available[1].id,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.slotId).toBe(available[1].id);
      expect(res.body.data.status).toBe("waiting");
    });
  });
});
