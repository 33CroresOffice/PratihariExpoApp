DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sebayats' AND column_name = 'is_bhai_pua') THEN
    ALTER TABLE sebayats ADD COLUMN is_bhai_pua boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sebayats' AND column_name = 'is_palia') THEN
    ALTER TABLE sebayats ADD COLUMN is_palia boolean DEFAULT false;
  END IF;
END $$;
