import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";

export interface SmsPayload {
  to: string;
  message: string;
  /** The OTP itself, for providers (MSG91/DLT) that fill a pre-approved template. */
  otp?: string;
}

/**
 * Provider configuration:
 *  - msg91 : SMS_API_KEY = authkey, SMS_TEMPLATE_ID = DLT-approved OTP template (required in India)
 *  - twilio: TWILIO_ACCOUNT_SID, SMS_API_KEY = auth token, SMS_SENDER_ID = Twilio "from" number
 */
export function isSmsConfigured(): boolean {
  switch (env.SMS_PROVIDER) {
    case "msg91":
      return !!(env.SMS_API_KEY && env.SMS_TEMPLATE_ID);
    case "twilio":
      return !!(env.TWILIO_ACCOUNT_SID && env.SMS_API_KEY && env.SMS_SENDER_ID);
    default:
      return false;
  }
}

export async function sendSms(payload: SmsPayload): Promise<boolean> {
  if (!isSmsConfigured()) {
    // Message bodies can contain OTPs — only print them outside production.
    logger.info(
      env.NODE_ENV === "production"
        ? `[SMS-DEV] SMS provider not configured, skipped message to ${payload.to}`
        : `[SMS-DEV] To: ${payload.to} | ${payload.message}`,
    );
    return false;
  }

  try {
    if (env.SMS_PROVIDER === "twilio") {
      const twilio = await import("twilio");
      const client = twilio.default(env.TWILIO_ACCOUNT_SID!, env.SMS_API_KEY!);
      await client.messages.create({
        body: payload.message,
        from: env.SMS_SENDER_ID,
        to: payload.to,
      });
    } else {
      // MSG91 OTP API: the template (with ##OTP##) is pre-approved; we only supply the code.
      if (!payload.otp) {
        logger.warn("MSG91 requires an OTP payload; skipping non-OTP message");
        return false;
      }
      const url = new URL("https://control.msg91.com/api/v5/otp");
      url.searchParams.set("template_id", env.SMS_TEMPLATE_ID!);
      url.searchParams.set("mobile", payload.to.replace(/^\+/, ""));
      url.searchParams.set("otp", payload.otp);
      if (env.SMS_SENDER_ID) url.searchParams.set("sender", env.SMS_SENDER_ID);

      // authkey goes in a header so it never ends up in URLs or proxy logs.
      const res = await fetch(url, {
        method: "POST",
        headers: { authkey: env.SMS_API_KEY!, "content-type": "application/json" },
        body: "{}",
      });
      const body = (await res.json().catch(() => ({}))) as { type?: string; message?: string };
      if (!res.ok || body.type === "error") {
        throw new Error(`MSG91 rejected the request: ${res.status} ${body.message ?? ""}`);
      }
    }
    logger.info(`SMS sent to ${payload.to}`);
    return true;
  } catch (err) {
    logger.error("Failed to send SMS", { err, to: payload.to });
    return false;
  }
}
