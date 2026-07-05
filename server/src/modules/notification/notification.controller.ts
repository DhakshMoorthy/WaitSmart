import type { Response, NextFunction } from "express";
import type { AuthedRequest } from "../../types/index.js";
import { testNotificationBody } from "./notification.validator.js";
import * as notificationService from "./notification.service.js";

export async function testSend(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const body = testNotificationBody.parse(req.body);
    const result = await notificationService.sendTestNotification(body.channel, body.to, body.message);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}
