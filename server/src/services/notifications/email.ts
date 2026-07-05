import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    return null;
  }
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  return transporter;
}

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) {
    logger.info(`[EMAIL-DEV] To: ${payload.to} | Subject: ${payload.subject} | ${payload.text}`);
    return false;
  }

  try {
    await transport.sendMail({
      from: env.SMTP_FROM,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    logger.info(`Email sent to ${payload.to}: ${payload.subject}`);
    return true;
  } catch (err) {
    logger.error("Failed to send email", { err, to: payload.to });
    return false;
  }
}
