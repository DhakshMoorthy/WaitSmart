import { sendEmail, type EmailPayload } from "./email.js";
import { sendPush, type PushPayload } from "./push.js";
import { sendSms, type SmsPayload } from "./sms.js";
import { logger } from "../../utils/logger.js";

export type NotificationChannel = "email" | "push" | "sms";

export interface NotifyOptions {
  channels: NotificationChannel[];
  email?: EmailPayload;
  push?: PushPayload;
  sms?: SmsPayload;
}

export async function notify(options: NotifyOptions): Promise<Record<NotificationChannel, boolean>> {
  const results: Record<string, boolean> = {};

  for (const channel of options.channels) {
    switch (channel) {
      case "email":
        results.email = options.email ? await sendEmail(options.email) : false;
        break;
      case "push":
        results.push = options.push ? await sendPush(options.push) : false;
        break;
      case "sms":
        results.sms = options.sms ? await sendSms(options.sms) : false;
        break;
    }
  }

  logger.debug("Notification dispatch results", results);
  return results as Record<NotificationChannel, boolean>;
}

export { sendEmail, sendPush, sendSms };
export type { EmailPayload, PushPayload, SmsPayload };
