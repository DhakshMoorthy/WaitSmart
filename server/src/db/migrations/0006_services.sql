-- Services a clinic / doctor offers ("General consultation", "Follow-up", ...), chosen by the patient when booking.
-- doctor_id NULL = offered by every doctor of the clinic. The duration is shown to patients and staff; slot length
-- (doctor_schedules) still decides how the day is cut up.
CREATE TABLE IF NOT EXISTS "services" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "clinic_id" uuid NOT NULL REFERENCES "clinics"("id") ON DELETE CASCADE,
  "doctor_id" uuid REFERENCES "doctors"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "duration_minutes" integer NOT NULL DEFAULT 15,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "services_tenant_idx" ON "services" ("tenant_id");
CREATE INDEX IF NOT EXISTS "services_clinic_idx" ON "services" ("clinic_id");
CREATE INDEX IF NOT EXISTS "services_doctor_idx" ON "services" ("doctor_id");

-- The name is copied onto the appointment so history stays readable after a service is renamed or deleted.
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "service_id" uuid REFERENCES "services"("id") ON DELETE SET NULL;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "service_name" text;
