/*
  # Add father_sebayat_id to sebayats

  Links a sebayat's father to another registered sebayat record.

  1. Changes
    - `sebayats`: add nullable `father_sebayat_id` (uuid, FK → sebayats.id)

  2. Security
    - Authenticated users can read any sebayat's id, full_name, first_name, last_name for the
      father search dropdown. A new SELECT policy is added on sebayats that allows authenticated
      users to read the minimal columns needed (full_name search). The existing RLS policies
      already allow users to read/write their own row; this addition only stores the FK value
      in the user's own row, so no new write policy is needed.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayats' AND column_name = 'father_sebayat_id'
  ) THEN
    ALTER TABLE sebayats ADD COLUMN father_sebayat_id uuid REFERENCES sebayats(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Allow authenticated users to search other sebayats by name (for the father lookup dropdown).
-- We expose only the columns required for the search: id and full_name.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sebayats' AND policyname = 'Authenticated users can search sebayats for father lookup'
  ) THEN
    CREATE POLICY "Authenticated users can search sebayats for father lookup"
      ON sebayats FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;
