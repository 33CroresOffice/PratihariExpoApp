/*
  # Add offline mode preference to sebayats

  1. Changes
    - Add `offline_mode_enabled` boolean column (default true) to `sebayats` table
      so user preference follows them across devices

  2. Notes
    - Default is true so offline mode is on by default for existing and new users
    - No RLS changes needed; existing policies already cover this column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayats' AND column_name = 'offline_mode_enabled'
  ) THEN
    ALTER TABLE sebayats ADD COLUMN offline_mode_enabled boolean NOT NULL DEFAULT true;
  END IF;
END $$;
