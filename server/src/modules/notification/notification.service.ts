import { notify, type NotificationChannel } from "../../services/notifications/index.js";

export async function sendTestNotification(channel: NotificationChannel, to: string, message: string) {
  const result = await notify({
    channels: [channel],
    email: channel === "email" ? { to, subject: "WaitSmart Test", text: message } : undefined,
    push: channel === "push" ? { token: to, title: "WaitSmart Test", body: message } : undefined,
    sms: channel === "sms" ? { to, message } : undefined,
  });
  return result;
}

export async function notifyBookingConfirmed(patientEmail: string | undefined, patientPhone: string | undefined, doctorName: string, tokenNumber: number) {
  const channels: NotificationChannel[] = [];
  if (patientEmail) channels.push("email");
  if (patientPhone) channels.push("sms");

  if (channels.length === 0) return;

  const message = `Your appointment with ${doctorName} is confirmed. Token #${tokenNumber}.`;

  await notify({
    channels,
    email: patientEmail
      ? { to: patientEmail, subject: "Booking Confirmed - WaitSmart", text: message }
      : undefined,
    sms: patientPhone ? { to: patientPhone, message } : undefined,
  });
}

export async function notifyYourTurnNext(patientPhone: string | undefined, doctorName: string, tokenNumber: number) {
  if (!patientPhone) return;

  const message = `You're next! Token #${tokenNumber} for ${doctorName}. Please be ready.`;

  await notify({
    channels: ["sms"],
    sms: { to: patientPhone, message },
  });
}
