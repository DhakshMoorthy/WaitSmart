import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";

export interface SmsPayload {
  to: string;
  message: string;
}

export async function sendSms(payload: SmsPayload): Promise<boolean> {
  const provider = env.SMS_PROVIDER;
  const apiKey = env.SMS_API_KEY;

  if (!provider || !apiKey) {
    logger.info(`[SMS-DEV] To: ${payload.to} | ${payload.message}`);
    return false;
  }

  try {
    if (provider === "twilio") {
      const twilio = await import("twilio");
      const client = twilio.default(apiKey, env.SMS_SENDER_ID);
      await client.messages.create({
        body: payload.message,
        from: env.SMS_SENDER_ID,
        to: payload.to,
      });
    } else {
      // MSG91 or other REST-based providers
      logger.warn(`SMS provider "${provider}" not fully implemented`);
      return false;
    }
    logger.info(`SMS sent to ${payload.to}`);
    return true;
  } catch (err) {
    logger.error("Failed to send SMS", { err, to: payload.to });
    return false;
  }
}
