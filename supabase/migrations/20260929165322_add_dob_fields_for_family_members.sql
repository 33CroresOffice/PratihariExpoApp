/*
# Add Date of Birth fields for family members

1. New Columns on `sebayats`
   - `father_dob` (text, nullable) — Father's date of birth in DD/MM/YYYY format
   - `mother_dob` (text, nullable) — Mother's date of birth in DD/MM/YYYY format
   - `spouse_dob` (text, nullable) — Spouse's date of birth in DD/MM/YYYY format
   - `spouse_father_dob` (text, nullable) — Spouse's father's date of birth in DD/MM/YYYY format
   - `spouse_mother_dob` (text, nullable) — Spouse's mother's date of birth in DD/MM/YYYY format

2. Existing `children` table
   - Already has a `date_of_birth` text column — no schema change needed.

3. Notes
   - All new columns use `text` type to store DD/MM/YYYY format (matching the children table pattern).
   - All columns are nullable since this information is optional.
   - No RLS policy changes needed — existing policies on `sebayats` already cover all columns.
   - Idempotent: uses DO $$ ... IF NOT EXISTS ... END $$ blocks.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sebayats' AND column_name = 'father_dob') THEN
    ALTER TABLE sebayats ADD COLUMN father_dob text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sebayats' AND column_name = 'mother_dob') THEN
    ALTER TABLE sebayats ADD COLUMN mother_dob text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sebayats' AND column_name = 'spouse_dob') THEN
    ALTER TABLE sebayats ADD COLUMN spouse_dob text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sebayats' AND column_name = 'spouse_father_dob') THEN
    ALTER TABLE sebayats ADD COLUMN spouse_father_dob text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sebayats' AND column_name = 'spouse_mother_dob') THEN
    ALTER TABLE sebayats ADD COLUMN spouse_mother_dob text;
  END IF;
END $$;
