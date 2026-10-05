-- One ACTIVE appointment per slot. Cancelled appointments keep their slot_id (history),
-- so the uniqueness only applies while an appointment is not cancelled.
-- Guarded: if legacy data already double-booked a slot, warn instead of failing the deploy.
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "appointments_active_slot_unique"
    ON "appointments" ("slot_id") WHERE "status" <> 'cancelled';
EXCEPTION WHEN unique_violation THEN
  RAISE WARNING 'appointments_active_slot_unique NOT created: duplicate active bookings exist for some slot. Resolve them and re-run.';
END $$;
