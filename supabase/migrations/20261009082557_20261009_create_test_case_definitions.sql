/*
# Testing module — test case definitions catalog

## What this adds
Stores the QA test case catalog (modules and test cases) in the database so the testing
page file itself contains no test case data. The page only loads the catalog from the
database AFTER a dev-team account signs in. A customer who somehow opens the testing URL
sees only a login screen and no test data at all.

1. New Tables
- `test_modules`
  - `code` text PRIMARY KEY (e.g. AUTH, REG, ADMIN-SEP)
  - `name` text — module display name
  - `scope` text — Mobile App / Admin Dashboard / Supabase etc.
- `test_cases`
  - `id` uuid primary key
  - `test_case_id` text UNIQUE (e.g. AUTH-TC-001)
  - `module_code` text REFERENCES test_modules(code)
  - `title` text — short test case name
  - `priority` text — P1 / P2 / P3
  - `description` text — steps/expected result
  - `feature` text — feature grouping
  - `sort_order` integer — preserves the catalog order

2. Security
- RLS enabled on both tables.
- Read-only catalog: INSERT/UPDATE/DELETE granted only to super admins for maintenance
  (adding new test cases later). All access requires a signed-in admin account from
  `pratihari_admins`; no public (anon) access.

3. Important notes
- Rows are seeded immediately after this migration from the current page's catalog data
  (21 modules, 302 test cases).
- The results/history tables from the previous migration reference these definitions by
  `test_case_id` (no hard FK on results so historical results survive catalog edits).
*/

CREATE TABLE IF NOT EXISTS test_modules (
  code text PRIMARY KEY,
  name text NOT NULL,
  scope text NOT NULL DEFAULT ''
);

ALTER TABLE test_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Testers can read modules" ON test_modules;
CREATE POLICY "Testers can read modules"
  ON test_modules FOR SELECT
  TO authenticated
  USING (is_pratihari_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins manage modules" ON test_modules;
CREATE POLICY "Super admins manage modules"
  ON test_modules FOR ALL
  TO authenticated
  USING (is_pratihari_admin(auth.uid()) AND EXISTS (
    SELECT 1 FROM pratihari_admins
    WHERE pratihari_admins.user_id = auth.uid()
      AND pratihari_admins.is_super_admin = true))
  WITH CHECK (is_pratihari_admin(auth.uid()) AND EXISTS (
    SELECT 1 FROM pratihari_admins
    WHERE pratihari_admins.user_id = auth.uid()
      AND pratihari_admins.is_super_admin = true));

CREATE TABLE IF NOT EXISTS test_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id text NOT NULL UNIQUE,
  module_code text NOT NULL REFERENCES test_modules(code) ON DELETE CASCADE,
  title text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('P1','P2','P3')),
  description text NOT NULL DEFAULT '',
  feature text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE test_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Testers can read test cases" ON test_cases;
CREATE POLICY "Testers can read test cases"
  ON test_cases FOR SELECT
  TO authenticated
  USING (is_pratihari_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins manage test cases" ON test_cases;
CREATE POLICY "Super admins manage test cases"
  ON test_cases FOR ALL
  TO authenticated
  USING (is_pratihari_admin(auth.uid()) AND EXISTS (
    SELECT 1 FROM pratihari_admins
    WHERE pratihari_admins.user_id = auth.uid()
      AND pratihari_admins.is_super_admin = true))
  WITH CHECK (is_pratihari_admin(auth.uid()) AND EXISTS (
    SELECT 1 FROM pratihari_admins
    WHERE pratihari_admins.user_id = auth.uid()
      AND pratihari_admins.is_super_admin = true));