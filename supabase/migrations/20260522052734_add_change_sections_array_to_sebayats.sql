/*
  # Add change_sections array column to sebayats

  ## Changes
  - Adds `change_sections` (text[]) column to `sebayats` table
  - Stores ALL sections requested by admin (e.g. ['personal','address','documents'])
  - The existing `change_section` (singular) column remains for backward compatibility
    and stores the highest-priority section for legacy navigation
  - On resubmit the app clears both columns (set to null/empty)

  ## New Column
  - `change_sections` text[] — array of section codes requested for change
    Valid values: 'personal', 'contact', 'documents', 'seba', 'family', 'address'
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayats' AND column_name = 'change_sections'
  ) THEN
    ALTER TABLE sebayats ADD COLUMN change_sections text[];
  END IF;
END $$;
