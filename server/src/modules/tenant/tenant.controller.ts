import type { Response, NextFunction } from "express";
import { createTenantBody, updateTenantBody } from "./tenant.validator.js";
import * as tenantService from "./tenant.service.js";
import type { AuthedRequest } from "../../types/index.js";

export async function list(_req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    res.json(await tenantService.listTenants());
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    res.json(await tenantService.getTenant(req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function create(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const input = createTenantBody.parse(req.body);
    res.status(201).json(await tenantService.createTenant(input));
  } catch (err) {
    next(err);
  }
}

export async function update(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const input = updateTenantBody.parse(req.body);
    res.json(await tenantService.updateTenant(req.params.id, input));
  } catch (err) {
    next(err);
  }
}

export async function deactivate(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    res.json(await tenantService.deactivateTenant(req.params.id));
  } catch (err) {
    next(err);
  }
}
