-- When a patient was called in / finished, for the "average consultation time" analytics.
-- A trigger keeps them right for every code path that changes a status (Next, Skip, No-show, Undo, manual edits).
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "called_at" timestamptz;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "completed_at" timestamptz;

CREATE OR REPLACE FUNCTION appointments_stamp_timing() RETURNS trigger AS $fn$
BEGIN
  IF NEW.status = 'in-cabin' AND OLD.status IS DISTINCT FROM 'in-cabin' THEN
    NEW.called_at := now();
    NEW.completed_at := NULL;
  ELSIF NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' THEN
    NEW.completed_at := now();
  ELSIF NEW.status = 'waiting' AND OLD.status IS DISTINCT FROM 'waiting' THEN
    NEW.called_at := NULL;
    NEW.completed_at := NULL;
  ELSIF NEW.status IN ('skipped', 'no-show', 'cancelled') THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS appointments_stamp_timing_trg ON "appointments";
CREATE TRIGGER appointments_stamp_timing_trg
  BEFORE UPDATE OF status ON "appointments"
  FOR EACH ROW EXECUTE FUNCTION appointments_stamp_timing();
