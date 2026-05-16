/*
  # Create admin_user_permissions table

  ## Purpose
  Adds per-user permission overrides on top of the role-based access control system.
  Each row explicitly grants or denies a specific resource:action pair for a specific admin,
  overriding whatever their role would normally grant.

  ## New Tables
  - `admin_user_permissions`
    - `id` (uuid, PK) — row identifier
    - `admin_id` (uuid, FK → pratihari_admins.id CASCADE DELETE) — which admin this override applies to
    - `resource` (text) — the resource name (e.g. 'sebayat_profiles', 'notices')
    - `action` (text) — the action name (e.g. 'view', 'create', 'edit', 'delete', 'approve', 'export')
    - `granted` (boolean) — true = force-grant this permission; false = force-deny even if role grants it
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)
  - Unique constraint on (admin_id, resource, action) — one override per permission per user

  ## Security
  - RLS enabled
  - Super admins can SELECT/INSERT/UPDATE/DELETE all rows
  - Any authenticated admin can SELECT their own overrides (for loading on login)

  ## Notes
  - Deny overrides (granted=false) beat role-level grants
  - Grant overrides (granted=true) add access beyond what the role grants
  - Super admins are never subject to overrides (checked before table is consulted)
  - Rows are deleted automatically when the admin is removed (CASCADE DELETE)
*/

CREATE TABLE IF NOT EXISTS admin_user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES pratihari_admins(id) ON DELETE CASCADE,
  resource text NOT NULL,
  action text NOT NULL,
  granted boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (admin_id, resource, action)
);

ALTER TABLE admin_user_permissions ENABLE ROW LEVEL SECURITY;

-- Super admins can read all overrides
CREATE POLICY "Super admins can select all user permission overrides"
  ON admin_user_permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratihari_admins
      WHERE pratihari_admins.user_id = auth.uid()
        AND pratihari_admins.is_super_admin = true
        AND pratihari_admins.is_disabled = false
    )
  );

-- Any admin can read their own overrides (needed on login to load state)
CREATE POLICY "Admins can select own permission overrides"
  ON admin_user_permissions FOR SELECT
  TO authenticated
  USING (
    admin_id IN (
      SELECT id FROM pratihari_admins
      WHERE pratihari_admins.user_id = auth.uid()
    )
  );

-- Super admins can insert overrides
CREATE POLICY "Super admins can insert user permission overrides"
  ON admin_user_permissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pratihari_admins
      WHERE pratihari_admins.user_id = auth.uid()
        AND pratihari_admins.is_super_admin = true
        AND pratihari_admins.is_disabled = false
    )
  );

-- Super admins can update overrides
CREATE POLICY "Super admins can update user permission overrides"
  ON admin_user_permissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratihari_admins
      WHERE pratihari_admins.user_id = auth.uid()
        AND pratihari_admins.is_super_admin = true
        AND pratihari_admins.is_disabled = false
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pratihari_admins
      WHERE pratihari_admins.user_id = auth.uid()
        AND pratihari_admins.is_super_admin = true
        AND pratihari_admins.is_disabled = false
    )
  );

-- Super admins can delete overrides
CREATE POLICY "Super admins can delete user permission overrides"
  ON admin_user_permissions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratihari_admins
      WHERE pratihari_admins.user_id = auth.uid()
        AND pratihari_admins.is_super_admin = true
        AND pratihari_admins.is_disabled = false
    )
  );
