import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";

export interface SmsPayload {
  to: string;
  message: string;
}

export async function sendSms(payload: SmsPayload): Promise<boolean> {
  const provider = env.SMS_PROVIDER;
  const apiKey = env.SMS_API_KEY;
  const senderId = env.SMS_SENDER_ID;

  if (!provider || !apiKey || !senderId) {
    logger.info(`[SMS-DEV] To: ${payload.to} | ${payload.message}`);
    return false;
  }

  try {
    if (provider === "twilio") {
      const twilio = await import("twilio");
      const client = twilio.default(apiKey, senderId);
      await client.messages.create({
        body: payload.message,
        from: senderId,
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
