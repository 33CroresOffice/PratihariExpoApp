/*
  # Fix infinite recursion in pratihari_admins RLS policies

  ## Problem
  The SELECT policy on `pratihari_admins` referenced `pratihari_admins` inside its
  own USING clause, which caused Postgres to recurse infinitely whenever any query
  touched the table (including admin checks from the app and policies on other
  tables that joined against it).

  ## Changes
  1. New function `public.is_pratihari_admin(uid uuid)` declared `SECURITY DEFINER`.
     It bypasses RLS to test admin membership without re-triggering policies.
  2. Replace recursive SELECT policy on `pratihari_admins` with a self-referential
     check (`user_id = auth.uid()`) so each user can only read their own admin row.
  3. Rewrite policies on `sebayats` and `profile_review_history` that previously did
     `EXISTS (SELECT FROM pratihari_admins ...)` to call the new helper function
     instead — same effect, no recursion risk.

  ## Security Notes
  - The helper function only returns a boolean and only checks the supplied uid.
  - Each table still requires authentication; non-admins remain locked out.
*/

CREATE OR REPLACE FUNCTION public.is_pratihari_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pratihari_admins WHERE user_id = uid
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_pratihari_admin(uuid) TO authenticated;

DROP POLICY IF EXISTS "Admins can read admin list" ON public.pratihari_admins;

CREATE POLICY "Users can read own admin row"
  ON public.pratihari_admins
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can read all sebayats" ON public.sebayats;
CREATE POLICY "Admins can read all sebayats"
  ON public.sebayats
  FOR SELECT
  TO authenticated
  USING (public.is_pratihari_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update sebayat status" ON public.sebayats;
CREATE POLICY "Admins can update sebayat status"
  ON public.sebayats
  FOR UPDATE
  TO authenticated
  USING (public.is_pratihari_admin(auth.uid()))
  WITH CHECK (public.is_pratihari_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all review history" ON public.profile_review_history;
CREATE POLICY "Admins can view all review history"
  ON public.profile_review_history
  FOR SELECT
  TO authenticated
  USING (public.is_pratihari_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert review history" ON public.profile_review_history;
CREATE POLICY "Admins can insert review history"
  ON public.profile_review_history
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_pratihari_admin(auth.uid()));
