/*
  # Create nijog_assignments table

  ## Purpose
  Stores admin-assigned Nijog seba beddhas for a sebayat for a specific year.
  Unlike sebayat_seba_selections (which are self-claimed), these are authoritative
  assignments made by the Nijog administration.

  ## New Tables
  - `nijog_assignments`
    - `id` (uuid, pk)
    - `sebayat_id` (uuid, fk → sebayats.id) — who is assigned
    - `seba_category_id` (uuid, fk → seba_categories.id) — which seba
    - `beddha_number` (int) — which beddha number
    - `year` (int) — the year this assignment is for (e.g. 2026)
    - `assigned_by` (uuid, fk → auth.users.id) — admin who made assignment
    - `notes` (text, nullable) — optional admin notes
    - `created_at` / `updated_at` timestamps

  ## Constraints
  - Unique on (sebayat_id, seba_category_id, beddha_number, year) — one assignment per slot per year
  - beddha_number must be > 0

  ## Security
  - RLS enabled
  - Admins (pratihari_admins) can read, insert, update, delete
  - Sebayats can read their own assignments
*/

CREATE TABLE IF NOT EXISTS nijog_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sebayat_id uuid NOT NULL REFERENCES sebayats(id) ON DELETE CASCADE,
  seba_category_id uuid NOT NULL REFERENCES seba_categories(id) ON DELETE CASCADE,
  beddha_number integer NOT NULL CHECK (beddha_number > 0),
  year integer NOT NULL,
  assigned_by uuid REFERENCES auth.users(id),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (sebayat_id, seba_category_id, beddha_number, year)
);

CREATE INDEX IF NOT EXISTS nijog_assignments_sebayat_year_idx ON nijog_assignments(sebayat_id, year);
CREATE INDEX IF NOT EXISTS nijog_assignments_year_idx ON nijog_assignments(year);

ALTER TABLE nijog_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read nijog assignments"
  ON nijog_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert nijog assignments"
  ON nijog_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update nijog assignments"
  ON nijog_assignments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete nijog assignments"
  ON nijog_assignments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Sebayats can read own nijog assignments"
  ON nijog_assignments FOR SELECT
  TO authenticated
  USING (sebayat_id = auth.uid());
