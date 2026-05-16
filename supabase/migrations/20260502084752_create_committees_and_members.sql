/*
  # Create Committees and Committee Members

  1. New Tables
    - `committees`
      - `id` (uuid, primary key)
      - `year` (integer, the annual period, e.g. 2025)
      - `title` (text, e.g. "Pratihari Nijog Committee 2025-26")
      - `description` (text, optional notes)
      - `is_active` (boolean, whether this is the current committee)
      - `created_by` (uuid, FK auth.users)
      - `created_at`, `updated_at`

    - `committee_members`
      - `id` (uuid, primary key)
      - `committee_id` (uuid, FK committees)
      - `sebayat_id` (uuid, FK sebayats, nullable — can add non-registered members)
      - `name` (text, display name override or freeform entry)
      - `role` (text, e.g. "President", "Secretary")
      - `role_order` (integer, for display sort)
      - `photo_url` (text, optional photo)
      - `phone` (text, optional contact)
      - `email` (text, optional)
      - `bio` (text, optional short bio)
      - `created_at`

  2. Security
    - RLS enabled on both tables
    - committees: public read (authenticated), admin write
    - committee_members: public read (authenticated), admin write
*/

CREATE TABLE IF NOT EXISTS committees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  is_active boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS committee_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id uuid NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
  sebayat_id uuid REFERENCES sebayats(id) ON DELETE SET NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT '',
  role_order integer DEFAULT 100,
  photo_url text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  bio text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE committee_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read committees"
  ON committees FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert committees"
  ON committees FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()));

CREATE POLICY "Admins can update committees"
  ON committees FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()));

CREATE POLICY "Admins can delete committees"
  ON committees FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated users can read committee members"
  ON committee_members FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert committee members"
  ON committee_members FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()));

CREATE POLICY "Admins can update committee members"
  ON committee_members FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()));

CREATE POLICY "Admins can delete committee members"
  ON committee_members FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()));
