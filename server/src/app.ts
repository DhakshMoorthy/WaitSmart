import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { corsOriginCallback } from "./config/corsPolicy.js";
import { apiRateLimiter } from "./middleware/rateLimiter.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./modules/auth/auth.router.js";
import { tenantRouter } from "./modules/tenant/tenant.router.js";
import { clinicRouter } from "./modules/clinic/clinic.router.js";
import { doctorRouter } from "./modules/doctor/doctor.router.js";
import { bookingRouter } from "./modules/booking/booking.router.js";
import { queueRouter } from "./modules/queue/queue.router.js";
import { notificationRouter } from "./modules/notification/notification.router.js";
import { billingRouter } from "./modules/billing/billing.router.js";
import { analyticsRouter } from "./modules/analytics/analytics.router.js";
import { patientRouter } from "./modules/patient/patient.router.js";
import { fileRouter } from "./modules/file/file.router.js";

export const app = express();

// Behind Render's load balancer the client IP arrives in X-Forwarded-For. Without this every
// visitor shares the proxy's IP and the rate limiters throttle everyone together.
if (env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(helmet());
app.use(cors({ origin: corsOriginCallback, credentials: true }));
// Razorpay signs the exact request bytes, so this route must see the raw body.
app.use("/billing/webhooks/razorpay", express.raw({ type: "*/*", limit: "1mb" }));
app.use(express.json({ limit: "100kb" }));
app.use(apiRateLimiter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Gateway auth middleware applied per-router via requireAuth / requireRole / requireTenant
app.use("/auth", authRouter);
app.use("/tenants", tenantRouter);
app.use("/clinics", clinicRouter);
app.use("/doctors", doctorRouter);
app.use("/", bookingRouter); // GET /avail, POST /book
app.use("/admin", queueRouter); // POST /admin/next
app.use("/notifications", notificationRouter);
app.use("/billing", billingRouter);
app.use("/analytics", analyticsRouter);
app.use("/patients", patientRouter);
app.use("/files", fileRouter);

app.use(notFoundHandler);
app.use(errorHandler);
