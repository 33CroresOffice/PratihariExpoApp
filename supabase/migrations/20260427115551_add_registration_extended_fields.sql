/*
  # Extended Registration Fields Migration

  ## Summary
  Expands the sebayats table and adds new related tables to support
  the full 7-step registration form.

  ## Changes

  ### Modified Tables
  - `sebayats`
    - New contact: `whatsapp_number`, `primary_phone`
    - New spouse details: `spouse_photo_url`, `spouse_father_name`, `spouse_mother_name`, `spouse_father_photo_url`, `spouse_mother_photo_url`
    - New current address fields: `current_sahi`, `current_landmark`, `current_post_office`, `current_police_station`, `current_pincode`, `current_district`, `current_state`, `current_country`, `current_address_text`
    - New permanent address: `is_permanent_different` + 9 `permanent_*` fields
    - New social media: `social_facebook`, `social_twitter`, `social_instagram`, `social_linkedin`, `social_youtube`

  ### New Tables
  1. `phone_numbers` — additional phone numbers per sebayat
  2. `children` — children records per sebayat
  3. `occupations` — occupation/activity rows per sebayat

  ## Security
  - RLS enabled on all new tables
  - Authenticated users can only read/write their own records
*/

-- ─── sebayats: contact ───────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='whatsapp_number') THEN
    ALTER TABLE sebayats ADD COLUMN whatsapp_number text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='primary_phone') THEN
    ALTER TABLE sebayats ADD COLUMN primary_phone text DEFAULT '';
  END IF;
END $$;

-- ─── sebayats: spouse details ────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='spouse_photo_url') THEN
    ALTER TABLE sebayats ADD COLUMN spouse_photo_url text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='spouse_father_name') THEN
    ALTER TABLE sebayats ADD COLUMN spouse_father_name text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='spouse_mother_name') THEN
    ALTER TABLE sebayats ADD COLUMN spouse_mother_name text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='spouse_father_photo_url') THEN
    ALTER TABLE sebayats ADD COLUMN spouse_father_photo_url text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='spouse_mother_photo_url') THEN
    ALTER TABLE sebayats ADD COLUMN spouse_mother_photo_url text DEFAULT '';
  END IF;
END $$;

-- ─── sebayats: current address ───────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='current_sahi') THEN
    ALTER TABLE sebayats ADD COLUMN current_sahi text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='current_landmark') THEN
    ALTER TABLE sebayats ADD COLUMN current_landmark text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='current_post_office') THEN
    ALTER TABLE sebayats ADD COLUMN current_post_office text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='current_police_station') THEN
    ALTER TABLE sebayats ADD COLUMN current_police_station text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='current_pincode') THEN
    ALTER TABLE sebayats ADD COLUMN current_pincode text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='current_district') THEN
    ALTER TABLE sebayats ADD COLUMN current_district text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='current_state') THEN
    ALTER TABLE sebayats ADD COLUMN current_state text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='current_country') THEN
    ALTER TABLE sebayats ADD COLUMN current_country text DEFAULT 'India';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='current_address_text') THEN
    ALTER TABLE sebayats ADD COLUMN current_address_text text DEFAULT '';
  END IF;
END $$;

-- ─── sebayats: permanent address ─────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='is_permanent_different') THEN
    ALTER TABLE sebayats ADD COLUMN is_permanent_different boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='permanent_sahi') THEN
    ALTER TABLE sebayats ADD COLUMN permanent_sahi text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='permanent_landmark') THEN
    ALTER TABLE sebayats ADD COLUMN permanent_landmark text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='permanent_post_office') THEN
    ALTER TABLE sebayats ADD COLUMN permanent_post_office text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='permanent_police_station') THEN
    ALTER TABLE sebayats ADD COLUMN permanent_police_station text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='permanent_pincode') THEN
    ALTER TABLE sebayats ADD COLUMN permanent_pincode text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='permanent_district') THEN
    ALTER TABLE sebayats ADD COLUMN permanent_district text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='permanent_state') THEN
    ALTER TABLE sebayats ADD COLUMN permanent_state text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='permanent_country') THEN
    ALTER TABLE sebayats ADD COLUMN permanent_country text DEFAULT 'India';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='permanent_address_text') THEN
    ALTER TABLE sebayats ADD COLUMN permanent_address_text text DEFAULT '';
  END IF;
END $$;

-- ─── sebayats: social media ───────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='social_facebook') THEN
    ALTER TABLE sebayats ADD COLUMN social_facebook text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='social_twitter') THEN
    ALTER TABLE sebayats ADD COLUMN social_twitter text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='social_instagram') THEN
    ALTER TABLE sebayats ADD COLUMN social_instagram text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='social_linkedin') THEN
    ALTER TABLE sebayats ADD COLUMN social_linkedin text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='social_youtube') THEN
    ALTER TABLE sebayats ADD COLUMN social_youtube text DEFAULT '';
  END IF;
END $$;

-- ─── phone_numbers table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS phone_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sebayat_id uuid NOT NULL REFERENCES sebayats(id) ON DELETE CASCADE,
  phone_number text NOT NULL DEFAULT '',
  label text NOT NULL DEFAULT 'additional',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sebayat can view own phone numbers"
  ON phone_numbers FOR SELECT
  TO authenticated
  USING (sebayat_id = auth.uid());

CREATE POLICY "Sebayat can insert own phone numbers"
  ON phone_numbers FOR INSERT
  TO authenticated
  WITH CHECK (sebayat_id = auth.uid());

CREATE POLICY "Sebayat can update own phone numbers"
  ON phone_numbers FOR UPDATE
  TO authenticated
  USING (sebayat_id = auth.uid())
  WITH CHECK (sebayat_id = auth.uid());

CREATE POLICY "Sebayat can delete own phone numbers"
  ON phone_numbers FOR DELETE
  TO authenticated
  USING (sebayat_id = auth.uid());

-- ─── children table ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sebayat_id uuid NOT NULL REFERENCES sebayats(id) ON DELETE CASCADE,
  child_name text NOT NULL DEFAULT '',
  date_of_birth text DEFAULT '',
  gender text DEFAULT '',
  marital_status text DEFAULT '',
  photo_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE children ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sebayat can view own children"
  ON children FOR SELECT
  TO authenticated
  USING (sebayat_id = auth.uid());

CREATE POLICY "Sebayat can insert own children"
  ON children FOR INSERT
  TO authenticated
  WITH CHECK (sebayat_id = auth.uid());

CREATE POLICY "Sebayat can update own children"
  ON children FOR UPDATE
  TO authenticated
  USING (sebayat_id = auth.uid())
  WITH CHECK (sebayat_id = auth.uid());

CREATE POLICY "Sebayat can delete own children"
  ON children FOR DELETE
  TO authenticated
  USING (sebayat_id = auth.uid());

-- ─── occupations table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS occupations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sebayat_id uuid NOT NULL REFERENCES sebayats(id) ON DELETE CASCADE,
  occupation text DEFAULT '',
  extra_curriculum_activity text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE occupations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sebayat can view own occupations"
  ON occupations FOR SELECT
  TO authenticated
  USING (sebayat_id = auth.uid());

CREATE POLICY "Sebayat can insert own occupations"
  ON occupations FOR INSERT
  TO authenticated
  WITH CHECK (sebayat_id = auth.uid());

CREATE POLICY "Sebayat can update own occupations"
  ON occupations FOR UPDATE
  TO authenticated
  USING (sebayat_id = auth.uid())
  WITH CHECK (sebayat_id = auth.uid());

CREATE POLICY "Sebayat can delete own occupations"
  ON occupations FOR DELETE
  TO authenticated
  USING (sebayat_id = auth.uid());

-- ─── indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS phone_numbers_sebayat_id_idx ON phone_numbers(sebayat_id);
CREATE INDEX IF NOT EXISTS children_sebayat_id_idx ON children(sebayat_id);
CREATE INDEX IF NOT EXISTS occupations_sebayat_id_idx ON occupations(sebayat_id);
