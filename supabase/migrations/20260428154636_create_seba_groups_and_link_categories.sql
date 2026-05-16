/*
  # Create seba_groups and link to seba_categories

  ## Summary
  Introduces the concept of "seba groups" — top-level beddha cycles that drive
  date scheduling. All Pratihari sub-categories share a single 1–47 cycle anchored
  on one date; Gochhikar (Jay Bijay Dwara) has its own 1–16 cycle anchored
  separately. Each `seba_categories` row is associated with exactly one group via
  the new `group_id` column.

  ## New Tables
  - `seba_groups`
    - `id` (uuid, primary key)
    - `code` (text, unique) — stable identifier ('pratihari' / 'gochhikar')
    - `name` (text) — human-readable label
    - `beddha_count` (integer, > 0) — cycle length (47 or 16)
    - `anchor_beddha` (integer, > 0, default 1) — beddha number on `anchor_date`
    - `anchor_date` (date) — calendar date on which `anchor_beddha` falls
    - `is_locked` (boolean, default false) — when true, anchor edits require unlock
    - `notes` (text) — admin freeform notes
    - `created_at`, `updated_at`

  ## Modified Tables
  - `seba_categories`
    - Added column `group_id` (uuid, FK → seba_groups.id)

  ## Seeded Rows
  1. Pratihari group — beddha_count 47, anchor_date 2026-03-15
  2. Gochhikar group — beddha_count 16, anchor_date 2026-04-27

  ## Backfill
  Categories with beddha_count = 47 → Pratihari group
  Categories with beddha_count = 16 → Gochhikar group

  ## Security
  - RLS enabled on `seba_groups`
  - All authenticated users can SELECT
  - Only admins can INSERT / UPDATE / DELETE
*/

CREATE TABLE IF NOT EXISTS seba_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  beddha_count integer NOT NULL CHECK (beddha_count > 0),
  anchor_beddha integer NOT NULL DEFAULT 1 CHECK (anchor_beddha > 0),
  anchor_date date NOT NULL,
  is_locked boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE seba_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view seba groups"
  ON seba_groups FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert seba groups"
  ON seba_groups FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()));

CREATE POLICY "Admins can update seba groups"
  ON seba_groups FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()));

CREATE POLICY "Admins can delete seba groups"
  ON seba_groups FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()));

INSERT INTO seba_groups (code, name, beddha_count, anchor_beddha, anchor_date, notes)
VALUES
  ('pratihari', 'Pratihari', 47, 1, DATE '2026-03-15', 'Shared 1-47 cycle for all Pratihari sub-categories'),
  ('gochhikar', 'Gochhikar (Jay Bijay Dwara)', 16, 1, DATE '2026-04-27', 'Independent 1-16 cycle for Jay Bijay Dwara')
ON CONFLICT (code) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seba_categories' AND column_name = 'group_id'
  ) THEN
    ALTER TABLE seba_categories
      ADD COLUMN group_id uuid REFERENCES seba_groups(id) ON DELETE SET NULL;
  END IF;
END $$;

UPDATE seba_categories sc
SET group_id = sg.id
FROM seba_groups sg
WHERE sc.category_type = 'seba'
  AND sc.beddha_count = sg.beddha_count
  AND sc.group_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_seba_categories_group ON seba_categories(group_id);
