import type { Response, NextFunction } from "express";
import type { AuthedRequest } from "../../types/index.js";
import { tenantScope } from "../../middleware/tenant.js";
import { createClinicBody, updateClinicBody } from "./clinic.validator.js";
import * as clinicService from "./clinic.service.js";

export async function list(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const data = await clinicService.listClinics(tenantId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const data = await clinicService.getClinic(tenantId, req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function create(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const body = createClinicBody.parse(req.body);
    const data = await clinicService.createClinic(tenantId, body);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function update(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const body = updateClinicBody.parse(req.body);
    const data = await clinicService.updateClinic(tenantId, req.params.id, body);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    await clinicService.deleteClinic(tenantId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
