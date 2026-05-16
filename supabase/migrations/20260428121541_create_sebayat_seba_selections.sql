/*
  # Create sebayat_seba_selections table

  ## Summary
  Adds a junction table so sebayats (and admins on their behalf) can claim
  specific beddha numbers within seba categories.

  ## New Tables
  - `sebayat_seba_selections`
    - `id` (uuid, primary key)
    - `sebayat_id` (uuid, FK → sebayats.id, ON DELETE CASCADE)
    - `seba_category_id` (uuid, FK → seba_categories.id, ON DELETE CASCADE)
    - `beddha_number` (integer, > 0)
    - `claimed_at` (timestamptz, default now())
    - UNIQUE (sebayat_id, seba_category_id, beddha_number)

  ## Security
  - RLS enabled
  - Authenticated users can SELECT / INSERT / DELETE their own rows
    (sebayat_id must equal auth.uid())
  - Admins (present in pratihari_admins) can SELECT / INSERT / DELETE all rows

  ## Notes
  1. nijog_assigned enforcement is visual in the UI; the DB does not block it
     because admins may legitimately assign nijog beddhas on behalf of a sebayat.
  2. ON DELETE CASCADE on both FKs keeps the table clean automatically.
*/

CREATE TABLE IF NOT EXISTS sebayat_seba_selections (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sebayat_id         uuid        NOT NULL REFERENCES sebayats(id) ON DELETE CASCADE,
  seba_category_id   uuid        NOT NULL REFERENCES seba_categories(id) ON DELETE CASCADE,
  beddha_number      integer     NOT NULL CHECK (beddha_number > 0),
  claimed_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sebayat_seba_selections_unique
    UNIQUE (sebayat_id, seba_category_id, beddha_number)
);

CREATE INDEX IF NOT EXISTS idx_seba_selections_sebayat
  ON sebayat_seba_selections (sebayat_id);

CREATE INDEX IF NOT EXISTS idx_seba_selections_category
  ON sebayat_seba_selections (seba_category_id);

ALTER TABLE sebayat_seba_selections ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own selections
CREATE POLICY "Sebayats can view own seba selections"
  ON sebayat_seba_selections FOR SELECT
  TO authenticated
  USING (sebayat_id = auth.uid());

-- Authenticated users can insert their own selections
CREATE POLICY "Sebayats can insert own seba selections"
  ON sebayat_seba_selections FOR INSERT
  TO authenticated
  WITH CHECK (sebayat_id = auth.uid());

-- Authenticated users can delete their own selections
CREATE POLICY "Sebayats can delete own seba selections"
  ON sebayat_seba_selections FOR DELETE
  TO authenticated
  USING (sebayat_id = auth.uid());

-- Admins can view all selections
CREATE POLICY "Admins can view all seba selections"
  ON sebayat_seba_selections FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratihari_admins
      WHERE pratihari_admins.user_id = auth.uid()
    )
  );

-- Admins can insert selections on behalf of any sebayat
CREATE POLICY "Admins can insert seba selections"
  ON sebayat_seba_selections FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pratihari_admins
      WHERE pratihari_admins.user_id = auth.uid()
    )
  );

-- Admins can delete any selection
CREATE POLICY "Admins can delete seba selections"
  ON sebayat_seba_selections FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratihari_admins
      WHERE pratihari_admins.user_id = auth.uid()
    )
  );
