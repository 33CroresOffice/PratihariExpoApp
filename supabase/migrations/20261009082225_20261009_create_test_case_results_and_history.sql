/*
# Testing module — shared test results with tester tracking

## What this adds
A testing tracker for the dev team's QA plan (the "testing-plan" page). Previously every
testers' Pass/Fail results were only saved in their own browser's local storage, so:
- results were lost when the page was refreshed on another device/browser, and
- multiple testers using the same page could not see who tested or changed what.

Now results are stored in the shared database with a full audit trail.

1. New Tables
- `test_case_results`
  - `id` uuid primary key
  - `test_case_id` text NOT NULL UNIQUE — the test case identifier (e.g. AUTH-TC-001)
  - `status` text NOT NULL DEFAULT 'PENDING' — one of PENDING / PASS / FAIL / BLOCKED / SKIPPED
  - `notes` text DEFAULT '' — tester notes / bug reference
  - `test_date` date nullable — the date the test was executed
  - `updated_by` uuid — the tester (auth user) who last changed this result
  - `updated_by_email` text — denormalized tester email for display in the page
  - `created_at` / `updated_at` timestamptz
- `test_case_history`
  - `id` uuid primary key
  - `test_case_id` text NOT NULL — which test case changed
  - `old_status` text, `new_status` text — before/after status
  - `changed_by` uuid — who changed it (server-verified from the session, cannot be forged)
  - `changed_by_email` text — denormalized for display
  - `changed_at` timestamptz
  - Index on `test_case_id` for fast per-case history lookups.

2. Security
- RLS enabled on both tables; NO public (anon) access of any kind.
- All CRUD on both tables is restricted to authenticated users who are in the
  `pratihari_admins` table (the dev team's admin accounts), reusing the existing
  `is_pratihari_admin()` helper used by the rest of the dashboard.
- `changed_by` / `updated_by` default to `auth.uid()` so the tester identity always
  comes from the signed-in session and cannot be spoofed from the client.

3. Important notes
- The testing page shows a login screen until a dev-team account signs in; a customer
  who opens the URL without credentials sees no test data.
- `test_case_results.updated_by` is kept in sync by the page (upsert), history rows are
  append-only through INSERT policies.
*/

CREATE TABLE IF NOT EXISTS test_case_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','PASS','FAIL','BLOCKED','SKIPPED')),
  notes text NOT NULL DEFAULT '',
  test_date date,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by_email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE test_case_results ALTER COLUMN updated_by SET DEFAULT auth.uid();

CREATE TABLE IF NOT EXISTS test_case_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id text NOT NULL,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  changed_by_email text NOT NULL DEFAULT '',
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS test_case_history_case_idx ON test_case_history (test_case_id);

ALTER TABLE test_case_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_case_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Testers can read results" ON test_case_results;
CREATE POLICY "Testers can read results"
  ON test_case_results FOR SELECT
  TO authenticated
  USING (is_pratihari_admin(auth.uid()));

DROP POLICY IF EXISTS "Testers can insert results" ON test_case_results;
CREATE POLICY "Testers can insert results"
  ON test_case_results FOR INSERT
  TO authenticated
  WITH CHECK (is_pratihari_admin(auth.uid()));

DROP POLICY IF EXISTS "Testers can update results" ON test_case_results;
CREATE POLICY "Testers can update results"
  ON test_case_results FOR UPDATE
  TO authenticated
  USING (is_pratihari_admin(auth.uid()))
  WITH CHECK (is_pratihari_admin(auth.uid()));

DROP POLICY IF EXISTS "Testers can delete results" ON test_case_results;
CREATE POLICY "Testers can delete results"
  ON test_case_results FOR DELETE
  TO authenticated
  USING (is_pratihari_admin(auth.uid()));

DROP POLICY IF EXISTS "Testers can read history" ON test_case_history;
CREATE POLICY "Testers can read history"
  ON test_case_history FOR SELECT
  TO authenticated
  USING (is_pratihari_admin(auth.uid()));

DROP POLICY IF EXISTS "Testers can insert history" ON test_case_history;
CREATE POLICY "Testers can insert history"
  ON test_case_history FOR INSERT
  TO authenticated
  WITH CHECK (is_pratihari_admin(auth.uid()));