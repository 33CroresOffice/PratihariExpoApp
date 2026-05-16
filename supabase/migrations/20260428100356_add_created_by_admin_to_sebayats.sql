/*
  # Add created_by_admin column to sebayats

  1. Changes
    - `sebayats` table: add `created_by_admin` (uuid, nullable) — stores the admin user id when a profile is created by an admin on behalf of a sebayat
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayats' AND column_name = 'created_by_admin'
  ) THEN
    ALTER TABLE sebayats ADD COLUMN created_by_admin uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;
