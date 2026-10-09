/*
# Testing module — server-stamped tester identity

## What this adds
Database triggers that stamp WHO updated a test result or history entry, taken from the
signed-in session (auth.uid()) — not from anything the browser sends. This means the
"Tested By" identity on every test case cannot be forged or forgotten by the page.

1. Changes
- `set_test_result_identity()` — SECURITY DEFINER trigger function: on every INSERT or
  UPDATE of `test_case_results`, sets `updated_by` = the signed-in user and
  `updated_by_email` = that user's email (looked up from auth.users server-side).
- `set_test_history_identity()` — same for `test_case_history` inserts: stamps
  `changed_by` and `changed_by_email` from the session.
- BEFORE INSERT/UPDATE trigger on test_case_results; BEFORE INSERT trigger on
  test_case_history.

2. Security
- Both functions are SECURITY DEFINER (needed to read auth.users, which the page's
  role cannot read) with a pinned search_path.
- EXECUTE revoked from anon; the functions are only invoked by the triggers, never
  callable directly.

3. Important notes
- The page never sends a tester name anymore — identity comes from the signed-in dev
  account automatically on every save.
*/

CREATE OR REPLACE FUNCTION set_test_result_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_email text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  NEW.updated_by := auth.uid();
  NEW.updated_by_email := COALESCE(v_email, '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS test_case_results_stamp_identity ON test_case_results;
CREATE TRIGGER test_case_results_stamp_identity
BEFORE INSERT OR UPDATE ON test_case_results
FOR EACH ROW EXECUTE FUNCTION set_test_result_identity();

CREATE OR REPLACE FUNCTION set_test_history_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_email text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  NEW.changed_by := auth.uid();
  NEW.changed_by_email := COALESCE(v_email, '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS test_case_history_stamp_identity ON test_case_history;
CREATE TRIGGER test_case_history_stamp_identity
BEFORE INSERT ON test_case_history
FOR EACH ROW EXECUTE FUNCTION set_test_history_identity();

REVOKE EXECUTE ON FUNCTION set_test_result_identity() FROM anon;
REVOKE EXECUTE ON FUNCTION set_test_history_identity() FROM anon;