/*
  # Create seba_categories table

  1. New Table: `seba_categories`
    - `id` (uuid, PK)
    - `category_type` (text) — one of 'bansa', 'seba', 'palia'
    - `name` (text) — the category name/value
    - `description` (text, nullable) — optional notes
    - `sort_order` (integer) — for ordering within a type
    - `is_active` (boolean, default true)
    - `created_by` (uuid, FK → auth.users)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  2. Security
    - RLS enabled
    - Admins can SELECT, INSERT, UPDATE, DELETE
    - Authenticated users (sebayats) can SELECT active categories (for mobile app dropdowns)

  3. Indexes
    - idx on (category_type, is_active) for fast type-filtered lookups
    - unique on (category_type, name) to prevent duplicates
*/

CREATE TABLE IF NOT EXISTS seba_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_type text NOT NULL CHECK (category_type IN ('bansa', 'seba', 'palia')),
  name text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE seba_categories ADD CONSTRAINT seba_categories_type_name_unique UNIQUE (category_type, name);

CREATE INDEX IF NOT EXISTS idx_seba_categories_type_active ON seba_categories (category_type, is_active);

ALTER TABLE seba_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select seba categories"
  ON seba_categories FOR SELECT
  TO authenticated
  USING (is_pratihari_admin(auth.uid()));

CREATE POLICY "Authenticated users can select active categories"
  ON seba_categories FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can insert seba categories"
  ON seba_categories FOR INSERT
  TO authenticated
  WITH CHECK (is_pratihari_admin(auth.uid()));

CREATE POLICY "Admins can update seba categories"
  ON seba_categories FOR UPDATE
  TO authenticated
  USING (is_pratihari_admin(auth.uid()))
  WITH CHECK (is_pratihari_admin(auth.uid()));

CREATE POLICY "Admins can delete seba categories"
  ON seba_categories FOR DELETE
  TO authenticated
  USING (is_pratihari_admin(auth.uid()));
