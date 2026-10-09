/*
# Add is_suspended column to sebayats

1. New Columns
- `sebayats.is_suspended` (boolean, default false) — allows admin to suspend (Basanda) a sebayat profile without deleting it. Suspended profiles can be reactivated later.
2. Security
- No RLS policy changes needed — existing UPDATE policies for admins already cover this column.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sebayats' AND column_name = 'is_suspended') THEN
    ALTER TABLE sebayats ADD COLUMN is_suspended boolean NOT NULL DEFAULT false;
  END IF;
END $$;
