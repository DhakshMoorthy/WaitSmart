import type { Response, NextFunction } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../../config/db.js";
import { appointments, doctors } from "../../db/schema/index.js";
import { AppError, type AuthedRequest } from "../../types/index.js";

/**
 * Confirms the caller may manage `doctorId`:
 *  - the doctor must exist in the caller's tenant (superadmin: any tenant)
 *  - role `doctor` may only manage their OWN doctor record
 *  - role `admin` / `superadmin` may manage any doctor in scope
 */
export async function assertCanManageDoctor(req: AuthedRequest, doctorId: string) {
  const user = req.user;
  if (!user) throw new AppError(401, "Not authenticated", "UNAUTHENTICATED");

  const doctor = await db.query.doctors.findFirst({
    where:
      user.role === "superadmin"
        ? eq(doctors.id, doctorId)
        : and(eq(doctors.id, doctorId), eq(doctors.tenantId, user.tenantId ?? "")),
  });
  if (!doctor) throw new AppError(404, "Doctor not found", "NOT_FOUND");

  if (user.role === "doctor" && doctor.userId !== user.userId) {
    throw new AppError(403, "You can only manage your own queue and schedule", "FORBIDDEN");
  }
  if (user.role !== "doctor" && user.role !== "admin" && user.role !== "superadmin") {
    throw new AppError(403, "Insufficient permissions", "FORBIDDEN");
  }
  return doctor;
}

/** Same check, resolved from an appointment id. */
export async function assertCanManageAppointment(req: AuthedRequest, appointmentId: string) {
  const user = req.user;
  if (!user) throw new AppError(401, "Not authenticated", "UNAUTHENTICATED");

  const appt = await db.query.appointments.findFirst({
    where:
      user.role === "superadmin"
        ? eq(appointments.id, appointmentId)
        : and(eq(appointments.id, appointmentId), eq(appointments.tenantId, user.tenantId ?? "")),
  });
  if (!appt) throw new AppError(404, "Appointment not found", "NOT_FOUND");
  await assertCanManageDoctor(req, appt.doctorId);
  return appt;
}

/** Route middleware: admin/superadmin, or the doctor who owns `:id`. */
export function requireAdminOrOwnDoctor(req: AuthedRequest, _res: Response, next: NextFunction) {
  assertCanManageDoctor(req, req.params.id).then(() => next(), next);
}
