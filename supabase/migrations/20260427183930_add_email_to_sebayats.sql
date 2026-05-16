/*
  # Add email field to sebayats table

  1. Changes
    - `sebayats` table: add `email` (text, nullable) column for storing contact email address

  2. Notes
    - No RLS changes needed; existing policies on sebayats cover this column
    - Column is optional (nullable) — not all sebayats may have an email
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayats' AND column_name = 'email'
  ) THEN
    ALTER TABLE sebayats ADD COLUMN email text DEFAULT '';
  END IF;
END $$;
