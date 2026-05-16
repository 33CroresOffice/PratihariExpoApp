/*
  # Fix recursive RLS on pratihari_admins

  The "Admins can read all admin rows" policy used EXISTS (SELECT FROM pratihari_admins)
  inside an RLS policy on pratihari_admins itself, causing infinite recursion at login.

  Fix: drop the recursive policy and replace it with a SECURITY DEFINER function
  that bypasses RLS for the membership check, then use that in a safe policy.
*/

-- Drop the recursive policy
DROP POLICY IF EXISTS "Admins can read all admin rows" ON pratihari_admins;

-- Create a security-definer helper that checks membership without RLS
CREATE OR REPLACE FUNCTION is_pratihari_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM pratihari_admins WHERE user_id = uid
  );
$$;

-- Safe non-recursive policy: any admin can read all admin rows
CREATE POLICY "Admins can read all admin rows"
  ON pratihari_admins FOR SELECT
  TO authenticated
  USING (is_pratihari_admin(auth.uid()));
