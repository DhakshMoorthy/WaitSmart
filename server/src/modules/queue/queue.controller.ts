import type { Response, NextFunction } from "express";
import type { AuthedRequest } from "../../types/index.js";
import { tenantScope } from "../../middleware/tenant.js";
import {
  queueActionBody,
  updateAppointmentStatusBody,
  updateDoctorNotesBody,
} from "./queue.validator.js";
import * as queueService from "./queue.service.js";

export async function next(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const body = queueActionBody.parse(req.body);
    const data = await queueService.nextPatient(tenantId, body);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function skip(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const body = queueActionBody.parse(req.body);
    const data = await queueService.skipPatient(tenantId, body);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function noShow(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const body = queueActionBody.parse(req.body);
    const data = await queueService.noShowPatient(tenantId, body);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function done(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const body = queueActionBody.parse(req.body);
    const data = await queueService.donePatient(tenantId, body);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function undo(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const body = queueActionBody.parse(req.body);
    const data = await queueService.undoLastAction(tenantId, body);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function reset(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const body = queueActionBody.parse(req.body);
    const data = await queueService.resetQueue(tenantId, body);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function updateStatus(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const body = updateAppointmentStatusBody.parse(req.body);
    const data = await queueService.updateAppointmentStatus(tenantId, body);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function updateNotes(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const body = updateDoctorNotesBody.parse(req.body);
    const data = await queueService.updateDoctorNotes(tenantId, body);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
