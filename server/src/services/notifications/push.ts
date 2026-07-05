import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";

let firebaseApp: any = null;

async function getFirebase() {
  if (firebaseApp) return firebaseApp;
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    return null;
  }

  const { initializeApp, cert, getApps } = await import("firebase-admin/app");
  const apps = getApps();
  if (apps.length > 0) {
    firebaseApp = apps[0];
  } else {
    firebaseApp = initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
  }
  return firebaseApp;
}

export interface PushPayload {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export async function sendPush(payload: PushPayload): Promise<boolean> {
  const app = await getFirebase();
  if (!app) {
    logger.info(`[PUSH-DEV] Token: ${payload.token} | ${payload.title}: ${payload.body}`);
    return false;
  }

  try {
    const { getMessaging } = await import("firebase-admin/messaging");
    await getMessaging(app).send({
      token: payload.token,
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
    });
    logger.info(`Push sent: ${payload.title}`);
    return true;
  } catch (err) {
    logger.error("Failed to send push", { err });
    return false;
  }
}
