-- Optional, used only to pick the male/female placeholder avatar in the UI. NULL = neutral avatar.
ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "gender" text;
