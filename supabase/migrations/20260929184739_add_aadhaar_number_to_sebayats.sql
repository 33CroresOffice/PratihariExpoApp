/*
  # Add aadhaar_number to sebayats

  Adds an optional aadhaar_number column for admin search/filter purposes.
  Stored as plain text to allow partial matching.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayats' AND column_name = 'aadhaar_number'
  ) THEN
    ALTER TABLE sebayats ADD COLUMN aadhaar_number text;
  END IF;
END $$;
