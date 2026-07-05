import type { Response, NextFunction } from "express";
import type { AuthedRequest } from "../../types/index.js";
import { tenantScope } from "../../middleware/tenant.js";
import { updateProfileBody, addFavoriteBody, addFamilyMemberBody } from "./patient.validator.js";
import * as patientService from "./patient.service.js";

export async function getProfile(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const data = await patientService.getProfile(req.user!.userId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const body = updateProfileBody.parse(req.body);
    const data = await patientService.updateProfile(req.user!.userId, body);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getHistory(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const data = await patientService.getHistory(req.user!.userId, tenantId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getFavorites(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const data = await patientService.getFavorites(req.user!.userId, tenantId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function addFavorite(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const body = addFavoriteBody.parse(req.body);
    const data = await patientService.addFavorite(req.user!.userId, tenantId, body);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getFamily(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const data = await patientService.getFamily(req.user!.userId, tenantId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function addFamilyMember(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const body = addFamilyMemberBody.parse(req.body);
    const data = await patientService.addFamilyMember(req.user!.userId, tenantId, body);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}
