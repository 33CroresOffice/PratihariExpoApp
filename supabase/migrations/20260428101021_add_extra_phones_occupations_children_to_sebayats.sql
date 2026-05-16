/*
  # Add extra_phones, occupations, children columns to sebayats

  1. Changes
    - `sebayats` table: add `extra_phones` (jsonb) — array of additional phone numbers
    - `sebayats` table: add `occupations` (jsonb) — array of {occupation, extra_curriculum_activity}
    - `sebayats` table: add `children` (jsonb) — array of {child_name, gender, marital_status}
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayats' AND column_name = 'extra_phones'
  ) THEN
    ALTER TABLE sebayats ADD COLUMN extra_phones jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayats' AND column_name = 'occupations'
  ) THEN
    ALTER TABLE sebayats ADD COLUMN occupations jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayats' AND column_name = 'children'
  ) THEN
    ALTER TABLE sebayats ADD COLUMN children jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;
