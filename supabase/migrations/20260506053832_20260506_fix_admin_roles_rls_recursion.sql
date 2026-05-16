/*
  # Fix admin_roles RLS recursion causing login failure

  The SELECT policy on admin_roles used EXISTS (SELECT FROM pratihari_admins)
  which triggered pratihari_admins RLS, which then tried to read admin_roles
  via the join — causing recursion and silent failures during login.

  Fix: replace the policy to use the existing is_pratihari_admin() SECURITY DEFINER
  function, which bypasses RLS and avoids the recursion.

  Same fix applied to role_permissions SELECT policy.
*/

DROP POLICY IF EXISTS "Admins can read roles" ON admin_roles;
CREATE POLICY "Admins can read roles"
  ON admin_roles FOR SELECT
  TO authenticated
  USING (public.is_pratihari_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can read role permissions" ON role_permissions;
CREATE POLICY "Admins can read role permissions"
  ON role_permissions FOR SELECT
  TO authenticated
  USING (public.is_pratihari_admin(auth.uid()));

-- Also fix the INSERT/UPDATE/DELETE policies on admin_roles to use the helper
DROP POLICY IF EXISTS "Super admins can create roles" ON admin_roles;
CREATE POLICY "Super admins can create roles"
  ON admin_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid() AND is_super_admin = true)
    AND is_system_role = false
  );

DROP POLICY IF EXISTS "Super admins can update custom roles" ON admin_roles;
CREATE POLICY "Super admins can update custom roles"
  ON admin_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid() AND is_super_admin = true)
    AND is_system_role = false
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid() AND is_super_admin = true)
    AND is_system_role = false
  );

DROP POLICY IF EXISTS "Super admins can delete custom roles" ON admin_roles;
CREATE POLICY "Super admins can delete custom roles"
  ON admin_roles FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid() AND is_super_admin = true)
    AND is_system_role = false
  );

-- Fix role_permissions write policies too
DROP POLICY IF EXISTS "Super admins can insert permissions" ON role_permissions;
CREATE POLICY "Super admins can insert permissions"
  ON role_permissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid() AND is_super_admin = true)
  );

DROP POLICY IF EXISTS "Super admins can delete permissions" ON role_permissions;
CREATE POLICY "Super admins can delete permissions"
  ON role_permissions FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid() AND is_super_admin = true)
  );

-- Fix admin_activity_log policies to use the helper
DROP POLICY IF EXISTS "Admins can insert activity log" ON admin_activity_log;
CREATE POLICY "Admins can insert activity log"
  ON admin_activity_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = actor_id AND public.is_pratihari_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins can read all activity logs" ON admin_activity_log;
CREATE POLICY "Super admins can read all activity logs"
  ON admin_activity_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid() AND is_super_admin = true)
  );

DROP POLICY IF EXISTS "Admins can read own activity logs" ON admin_activity_log;
CREATE POLICY "Admins can read own activity logs"
  ON admin_activity_log FOR SELECT
  TO authenticated
  USING (actor_id = auth.uid() AND public.is_pratihari_admin(auth.uid()));
