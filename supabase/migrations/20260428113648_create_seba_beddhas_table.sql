/*
  # Create seba_beddhas table

  ## Purpose
  Stores the type assignment (Hereditary or Nijog Assigned) for each individual
  beddha number within a seba category. The total count per seba is fixed and
  stored in seba_categories.beddha_count; this table records what type each
  numbered beddha slot is.

  ## New Tables
  - `seba_beddhas`
    - `id` (uuid, primary key)
    - `seba_category_id` (uuid, FK → seba_categories.id, cascade delete)
    - `beddha_number` (integer, 1-based position within the seba)
    - `beddha_type` (text, either 'hereditary' or 'nijog_assigned')
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Constraints
  - Unique on (seba_category_id, beddha_number) — each slot stored once
  - beddha_type must be one of the two valid values

  ## Security
  - RLS enabled
  - Authenticated users can SELECT (needed to display in the app)
  - Only admins (present in pratihari_admins) can INSERT/UPDATE/DELETE
*/

CREATE TABLE IF NOT EXISTS seba_beddhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seba_category_id uuid NOT NULL REFERENCES seba_categories(id) ON DELETE CASCADE,
  beddha_number integer NOT NULL CHECK (beddha_number > 0),
  beddha_type text NOT NULL CHECK (beddha_type IN ('hereditary', 'nijog_assigned')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT seba_beddhas_unique UNIQUE (seba_category_id, beddha_number)
);

CREATE INDEX IF NOT EXISTS seba_beddhas_category_idx ON seba_beddhas(seba_category_id);

ALTER TABLE seba_beddhas ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read beddha assignments
CREATE POLICY "Authenticated users can view beddha assignments"
  ON seba_beddhas FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert beddha assignments
CREATE POLICY "Admins can insert beddha assignments"
  ON seba_beddhas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pratihari_admins
      WHERE pratihari_admins.user_id = auth.uid()
    )
  );

-- Only admins can update beddha assignments
CREATE POLICY "Admins can update beddha assignments"
  ON seba_beddhas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratihari_admins
      WHERE pratihari_admins.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pratihari_admins
      WHERE pratihari_admins.user_id = auth.uid()
    )
  );

-- Only admins can delete beddha assignments
CREATE POLICY "Admins can delete beddha assignments"
  ON seba_beddhas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratihari_admins
      WHERE pratihari_admins.user_id = auth.uid()
    )
  );
