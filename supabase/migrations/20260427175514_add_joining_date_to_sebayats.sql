/*
  # Add joining date fields to sebayats

  1. Changes
    - `joining_date_exact` (boolean, default false) — whether the member remembers the full date
    - `joining_year` (text) — year of joining (always stored, e.g. "2018")
    - `joining_date` (text) — full dd/mm/yyyy date, only populated when joining_date_exact is true

  2. Notes
    - Both date fields are text to keep the dd/mm/yyyy format consistent with date_of_birth
    - No RLS changes needed — covered by existing sebayats policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayats' AND column_name = 'joining_date_exact'
  ) THEN
    ALTER TABLE sebayats ADD COLUMN joining_date_exact boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayats' AND column_name = 'joining_year'
  ) THEN
    ALTER TABLE sebayats ADD COLUMN joining_year text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayats' AND column_name = 'joining_date'
  ) THEN
    ALTER TABLE sebayats ADD COLUMN joining_date text DEFAULT '';
  END IF;
END $$;
