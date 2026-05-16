/*
  # Add Bhagari, Baristha Bhai Pua, Blood Group, Health Card fields to sebayats

  ## New Columns on sebayats
  - `is_bhagari` (boolean) - toggle flag
  - `is_baristha_bhai_pua` (boolean) - toggle flag
  - `blood_group` (text) - selected blood group
  - `health_card_no` (text) - health card number
  - `health_card_photo_url` (text) - health card photo URL
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='is_bhagari') THEN
    ALTER TABLE sebayats ADD COLUMN is_bhagari boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='is_baristha_bhai_pua') THEN
    ALTER TABLE sebayats ADD COLUMN is_baristha_bhai_pua boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='blood_group') THEN
    ALTER TABLE sebayats ADD COLUMN blood_group text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='health_card_no') THEN
    ALTER TABLE sebayats ADD COLUMN health_card_no text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='health_card_photo_url') THEN
    ALTER TABLE sebayats ADD COLUMN health_card_photo_url text DEFAULT '';
  END IF;
END $$;
