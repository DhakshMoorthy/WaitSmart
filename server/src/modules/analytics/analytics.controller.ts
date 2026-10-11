import type { Response, NextFunction } from "express";
import type { AuthedRequest } from "../../types/index.js";
import { tenantScope } from "../../middleware/tenant.js";
import { analyticsQuery, summaryQuery } from "./analytics.validator.js";
import { AppError } from "../../types/index.js";
import * as analyticsService from "./analytics.service.js";

export async function daily(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const query = analyticsQuery.parse(req.query);
    const data = await analyticsService.getDailyStats(tenantId, query.startDate, query.endDate);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function summary(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user;
    if (!user) throw new AppError(401, "Not authenticated", "UNAUTHENTICATED");
    const tenantId = tenantScope(req);
    const query = summaryQuery.parse(req.query);
    const data = await analyticsService.getSummary(
      tenantId,
      { userId: user.userId, role: user.role },
      query.date,
      query.doctorId,
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function waitTimes(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const data = await analyticsService.getWaitTimes(tenantId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function noShowRate(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const data = await analyticsService.getNoShowRate(tenantId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function revenue(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = tenantScope(req);
    const query = analyticsQuery.parse(req.query);
    const data = await analyticsService.getRevenue(tenantId, query.startDate, query.endDate);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
