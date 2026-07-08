-- WaitSmart initial schema migration

-- Enums
DO $$ BEGIN
  CREATE TYPE "role" AS ENUM ('superadmin', 'admin', 'doctor', 'patient');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "slot_status" AS ENUM ('available', 'booked', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "appointment_status" AS ENUM ('waiting', 'in-cabin', 'done', 'skipped', 'no-show', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "subscription_status" AS ENUM ('trialing', 'active', 'past_due', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "payment_status" AS ENUM ('created', 'paid', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Extension for uuid generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tenants
CREATE TABLE IF NOT EXISTS "tenants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "subdomain" text UNIQUE,
  "branding" jsonb,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Users
CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text,
  "password_hash" text NOT NULL,
  "role" "role" NOT NULL DEFAULT 'patient',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "users_tenant_idx" ON "users" ("tenant_id");
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");

-- Clinics
CREATE TABLE IF NOT EXISTS "clinics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "address" text NOT NULL,
  "hours" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "clinics_tenant_idx" ON "clinics" ("tenant_id");

-- Doctors
CREATE TABLE IF NOT EXISTS "doctors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "clinic_id" uuid NOT NULL REFERENCES "clinics"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "name" text NOT NULL,
  "specialization" text NOT NULL,
  "experience_years" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "doctors_tenant_idx" ON "doctors" ("tenant_id");
CREATE INDEX IF NOT EXISTS "doctors_clinic_idx" ON "doctors" ("clinic_id");

-- Doctor Schedules
CREATE TABLE IF NOT EXISTS "doctor_schedules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "doctor_id" uuid NOT NULL REFERENCES "doctors"("id") ON DELETE CASCADE,
  "day_of_week" integer NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "slot_duration_minutes" integer NOT NULL DEFAULT 15,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "doctor_schedules_tenant_idx" ON "doctor_schedules" ("tenant_id");
CREATE INDEX IF NOT EXISTS "doctor_schedules_doctor_idx" ON "doctor_schedules" ("doctor_id");
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_doctor_day_unique" UNIQUE ("doctor_id", "day_of_week");

-- Doctor Breaks
CREATE TABLE IF NOT EXISTS "doctor_breaks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "doctor_id" uuid NOT NULL REFERENCES "doctors"("id") ON DELETE CASCADE,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "reason" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "doctor_breaks_tenant_idx" ON "doctor_breaks" ("tenant_id");
CREATE INDEX IF NOT EXISTS "doctor_breaks_doctor_idx" ON "doctor_breaks" ("doctor_id");

-- Slots
CREATE TABLE IF NOT EXISTS "slots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "doctor_id" uuid NOT NULL REFERENCES "doctors"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "slot_index" integer NOT NULL,
  "slot_time" timestamp with time zone NOT NULL,
  "status" "slot_status" NOT NULL DEFAULT 'available',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "slots_tenant_idx" ON "slots" ("tenant_id");
CREATE INDEX IF NOT EXISTS "slots_doctor_date_idx" ON "slots" ("doctor_id", "date");
ALTER TABLE "slots" ADD CONSTRAINT "slots_doctor_date_index_unique" UNIQUE ("doctor_id", "date", "slot_index");

-- Appointments
CREATE TABLE IF NOT EXISTS "appointments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "clinic_id" uuid NOT NULL REFERENCES "clinics"("id") ON DELETE CASCADE,
  "doctor_id" uuid NOT NULL REFERENCES "doctors"("id") ON DELETE CASCADE,
  "slot_id" uuid NOT NULL REFERENCES "slots"("id") ON DELETE CASCADE,
  "patient_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "patient_name" text NOT NULL,
  "patient_phone" text,
  "symptoms" text,
  "token_number" integer NOT NULL,
  "status" "appointment_status" NOT NULL DEFAULT 'waiting',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "appointments_tenant_idx" ON "appointments" ("tenant_id");
CREATE INDEX IF NOT EXISTS "appointments_doctor_idx" ON "appointments" ("doctor_id");
CREATE INDEX IF NOT EXISTS "appointments_patient_idx" ON "appointments" ("patient_user_id");

-- Queue State
CREATE TABLE IF NOT EXISTS "queue_state" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "doctor_id" uuid NOT NULL REFERENCES "doctors"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "current_slot" integer NOT NULL DEFAULT 0,
  "last_slot" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "queue_state_tenant_idx" ON "queue_state" ("tenant_id");
ALTER TABLE "queue_state" ADD CONSTRAINT "queue_state_doctor_date_unique" UNIQUE ("doctor_id", "date");

-- Patient Favorites
CREATE TABLE IF NOT EXISTS "patient_favorites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "patient_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "doctor_id" uuid NOT NULL REFERENCES "doctors"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "patient_favorites_patient_idx" ON "patient_favorites" ("patient_user_id");
ALTER TABLE "patient_favorites" ADD CONSTRAINT "patient_favorites_unique" UNIQUE ("patient_user_id", "doctor_id");

-- Family Members
CREATE TABLE IF NOT EXISTS "family_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "relationship" text NOT NULL,
  "age" integer,
  "phone" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "family_members_user_idx" ON "family_members" ("user_id");

-- Files
CREATE TABLE IF NOT EXISTS "files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "uploaded_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "filename" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "storage_key" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "files_tenant_idx" ON "files" ("tenant_id");
CREATE INDEX IF NOT EXISTS "files_uploader_idx" ON "files" ("uploaded_by");

-- Subscriptions
CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "plan_id" text NOT NULL,
  "razorpay_subscription_id" text,
  "status" "subscription_status" NOT NULL DEFAULT 'trialing',
  "current_period_end" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "subscriptions_tenant_idx" ON "subscriptions" ("tenant_id");

-- Payments
CREATE TABLE IF NOT EXISTS "payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "subscription_id" uuid REFERENCES "subscriptions"("id") ON DELETE SET NULL,
  "razorpay_payment_id" text,
  "razorpay_order_id" text,
  "amount_paise" integer NOT NULL,
  "currency" text NOT NULL DEFAULT 'INR',
  "status" "payment_status" NOT NULL DEFAULT 'created',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "payments_tenant_idx" ON "payments" ("tenant_id");

