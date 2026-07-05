import type { Response, NextFunction } from "express";
import type { AuthedRequest } from "../../types/index.js";
import { tenantScope } from "../../middleware/tenant.js";
import {
  createDoctorBody,
  updateDoctorBody,
  updateScheduleBody,
  createBreakBody,
} from "./doctor.validator.js";
import * as doctorService from "./doctor.service.js";

export async function list(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const clinicId = req.query.clinicId as string | undefined;
    const data = await doctorService.listDoctors(tenantId, clinicId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const data = await doctorService.getDoctor(tenantId, req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function create(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const body = createDoctorBody.parse(req.body);
    const data = await doctorService.createDoctor(tenantId, body);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function update(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const body = updateDoctorBody.parse(req.body);
    const data = await doctorService.updateDoctor(tenantId, req.params.id, body);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    await doctorService.deleteDoctor(tenantId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function getSchedules(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const data = await doctorService.getSchedules(tenantId, req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function updateSchedules(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const body = updateScheduleBody.parse(req.body);
    const data = await doctorService.updateSchedules(tenantId, req.params.id, body);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getBreaks(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const data = await doctorService.getBreaks(tenantId, req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function createBreak(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const body = createBreakBody.parse(req.body);
    const data = await doctorService.createBreak(tenantId, req.params.id, body);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}
