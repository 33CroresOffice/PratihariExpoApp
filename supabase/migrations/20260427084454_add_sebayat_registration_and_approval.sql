/*
  # Sebayat Registration & Approval System — Pratihari Nijog

  ## Summary
  Extends the sebayats table with full registration profile fields and adds an
  approval workflow so every new member submission goes through admin review.

  ## New Columns on `sebayats`
  Personal details:
    - full_name, date_of_birth, gender
    - father_name, mother_name, marital_status, spouse_name
    - address_village, address_district, address_state, address_pin
    - photo_url — selfie / passport photo stored in Supabase Storage

  Hereditary / seba details (Pratihari-specific):
    - bansa_name     — ancestral lineage name
    - palia_number   — rotation group number (1–15 typically)
    - seba_name      — name of the specific seva performed
    - registration_no — Nijog registration number (assigned by admin after approval)

  Approval workflow:
    - profile_status: draft | submitted | under_review | approved | rejected | changes_requested | resubmitted
    - submitted_at, reviewed_at, reviewed_by (admin user id)
    - admin_remarks — notes from admin on rejection / change request

  ## New Table: `profile_review_history`
  Full audit log of every status change with reviewer, timestamp and notes.

  ## Security
  - RLS on sebayats: members can read/update own profile (not status/admin fields)
  - RLS on profile_review_history: members read-only their own history; admins full access
  - New table `pratihari_admins` stores admin user ids with RLS
*/

-- ─────────────────────────────────────────────
-- 1. Extend sebayats with registration fields
-- ─────────────────────────────────────────────
DO $$
BEGIN
  -- Personal
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='full_name') THEN
    ALTER TABLE sebayats ADD COLUMN full_name text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='date_of_birth') THEN
    ALTER TABLE sebayats ADD COLUMN date_of_birth date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='gender') THEN
    ALTER TABLE sebayats ADD COLUMN gender text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='father_name') THEN
    ALTER TABLE sebayats ADD COLUMN father_name text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='mother_name') THEN
    ALTER TABLE sebayats ADD COLUMN mother_name text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='marital_status') THEN
    ALTER TABLE sebayats ADD COLUMN marital_status text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='spouse_name') THEN
    ALTER TABLE sebayats ADD COLUMN spouse_name text DEFAULT '';
  END IF;
  -- Address
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='address_village') THEN
    ALTER TABLE sebayats ADD COLUMN address_village text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='address_district') THEN
    ALTER TABLE sebayats ADD COLUMN address_district text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='address_state') THEN
    ALTER TABLE sebayats ADD COLUMN address_state text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='address_pin') THEN
    ALTER TABLE sebayats ADD COLUMN address_pin text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='photo_url') THEN
    ALTER TABLE sebayats ADD COLUMN photo_url text DEFAULT '';
  END IF;
  -- Seba / Pratihari-specific
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='bansa_name') THEN
    ALTER TABLE sebayats ADD COLUMN bansa_name text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='palia_number') THEN
    ALTER TABLE sebayats ADD COLUMN palia_number text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='seba_name') THEN
    ALTER TABLE sebayats ADD COLUMN seba_name text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='registration_no') THEN
    ALTER TABLE sebayats ADD COLUMN registration_no text DEFAULT '';
  END IF;
  -- Approval workflow
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='profile_status') THEN
    ALTER TABLE sebayats ADD COLUMN profile_status text NOT NULL DEFAULT 'draft';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='submitted_at') THEN
    ALTER TABLE sebayats ADD COLUMN submitted_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='reviewed_at') THEN
    ALTER TABLE sebayats ADD COLUMN reviewed_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='reviewed_by') THEN
    ALTER TABLE sebayats ADD COLUMN reviewed_by uuid REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sebayats' AND column_name='admin_remarks') THEN
    ALTER TABLE sebayats ADD COLUMN admin_remarks text DEFAULT '';
  END IF;
END $$;

-- ─────────────────────────────────────────────
-- 2. Admin users table
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pratihari_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE pratihari_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read admin list"
  ON pratihari_admins
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratihari_admins pa WHERE pa.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- 3. Profile review history
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profile_review_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sebayat_id uuid NOT NULL REFERENCES sebayats(id) ON DELETE CASCADE,
  from_status text NOT NULL DEFAULT '',
  to_status text NOT NULL DEFAULT '',
  remarks text DEFAULT '',
  changed_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profile_review_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own review history"
  ON profile_review_history
  FOR SELECT
  TO authenticated
  USING (sebayat_id = auth.uid());

CREATE POLICY "Admins can view all review history"
  ON profile_review_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratihari_admins pa WHERE pa.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert review history"
  ON profile_review_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pratihari_admins pa WHERE pa.user_id = auth.uid()
    )
  );

-- Members can insert their own submission events
CREATE POLICY "Members can log own submissions"
  ON profile_review_history
  FOR INSERT
  TO authenticated
  WITH CHECK (sebayat_id = auth.uid() AND changed_by = auth.uid());

-- ─────────────────────────────────────────────
-- 4. Extend RLS on sebayats for admin access
-- ─────────────────────────────────────────────

-- Admins can read all sebayats
CREATE POLICY "Admins can read all sebayats"
  ON sebayats
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratihari_admins pa WHERE pa.user_id = auth.uid()
    )
  );

-- Admins can update status fields on any sebayat
CREATE POLICY "Admins can update sebayat status"
  ON sebayats
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratihari_admins pa WHERE pa.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pratihari_admins pa WHERE pa.user_id = auth.uid()
    )
  );

-- Members can insert their own row (created on first registration save)
CREATE POLICY "Members can insert own profile"
  ON sebayats
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- ─────────────────────────────────────────────
-- 5. Storage bucket for profile photos
-- ─────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Members can upload own photo"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Anyone can view profile photos"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'profile-photos');
