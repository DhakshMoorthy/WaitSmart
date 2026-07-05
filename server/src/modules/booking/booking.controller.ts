import type { Response, NextFunction } from "express";
import type { AuthedRequest } from "../../types/index.js";
import { tenantScope } from "../../middleware/tenant.js";
import {
  availabilityQuery,
  createBookingBody,
  cancelBookingBody,
  rescheduleBookingBody,
} from "./booking.validator.js";
import * as bookingService from "./booking.service.js";

export async function availability(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const query = availabilityQuery.parse(req.query);
    const data = await bookingService.getAvailability(tenantId, query.doctorId, query.date);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function create(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const body = createBookingBody.parse(req.body);
    const patientUserId = req.user?.userId ?? null;
    const data = await bookingService.createBooking(tenantId, patientUserId, body);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function cancel(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const body = cancelBookingBody.parse(req.body);
    const data = await bookingService.cancelBooking(tenantId, body.appointmentId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function reschedule(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const body = rescheduleBookingBody.parse(req.body);
    const patientUserId = req.user?.userId ?? null;
    const data = await bookingService.rescheduleBooking(tenantId, patientUserId, body);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
