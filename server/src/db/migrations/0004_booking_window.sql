-- How many days ahead patients may book a doctor (today included as day 1). Staff are not limited.
ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "booking_window_days" integer NOT NULL DEFAULT 3;
