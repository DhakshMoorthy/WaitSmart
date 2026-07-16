-- Queue parity: undo support, doctor notes, appointment file attachments
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "doctor_notes" text;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "file_id" uuid;
DO $$ BEGIN
  ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_file_id_files_id_fk"
    FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "queue_state" ADD COLUMN IF NOT EXISTS "last_action" jsonb;
