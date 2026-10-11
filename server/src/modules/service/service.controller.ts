import type { Response, NextFunction } from "express";
import { AppError, type AuthedRequest } from "../../types/index.js";
import { tenantScope } from "../../middleware/tenant.js";
import { createServiceBody, listServicesQuery, updateServiceBody } from "./service.validator.js";
import * as serviceService from "./service.service.js";

function actorOf(req: AuthedRequest) {
  if (!req.user) throw new AppError(401, "Not authenticated", "UNAUTHENTICATED");
  return { userId: req.user.userId, role: req.user.role };
}

export async function list(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const q = listServicesQuery.parse(req.query);
    const data = q.doctorId
      ? await serviceService.listForDoctor(tenantId, q.doctorId)
      : await serviceService.listForClinic(tenantId, q.clinicId!);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function create(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const body = createServiceBody.parse(req.body);
    const data = await serviceService.createService(tenantId, actorOf(req), body);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function update(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const body = updateServiceBody.parse(req.body);
    const data = await serviceService.updateService(tenantId, actorOf(req), req.params.id, body);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const data = await serviceService.deleteService(tenantId, actorOf(req), req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
