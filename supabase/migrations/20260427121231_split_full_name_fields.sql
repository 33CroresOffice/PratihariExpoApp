/*
  # Split full_name into first_name, middle_name, last_name, alias_name

  ## Changes
  - `sebayats`: Add `first_name`, `middle_name`, `last_name`, `alias_name` columns
  - `full_name` is kept for backwards compatibility (will be computed on submit)
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='first_name') THEN
    ALTER TABLE sebayats ADD COLUMN first_name text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='middle_name') THEN
    ALTER TABLE sebayats ADD COLUMN middle_name text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='last_name') THEN
    ALTER TABLE sebayats ADD COLUMN last_name text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='alias_name') THEN
    ALTER TABLE sebayats ADD COLUMN alias_name text DEFAULT '';
  END IF;
END $$;
