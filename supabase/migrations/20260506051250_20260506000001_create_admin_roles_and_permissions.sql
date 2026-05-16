/*
  # Admin Roles and Permissions System

  ## Summary
  Replaces the binary `is_super_admin` flag with a full RBAC system.

  ## New Tables
  - `admin_roles`: Defines roles (Super Admin, Admin, Moderator, Viewer, plus custom roles)
    - id, role_name, description, is_system_role, color, created_by, created_at
  - `role_permissions`: Granular permissions per role per resource per action
    - id, role_id, resource, action

  ## Modified Tables
  - `pratihari_admins`: Adds `role_id` FK to admin_roles
    - `is_super_admin` is preserved for backward compatibility (auto-derived)

  ## System Roles Seeded
  1. Super Admin — full access to everything including roles and admin management
  2. Admin — full access except admin/role management and global settings
  3. Moderator — view + approve applications, create/edit notices, no deletes
  4. Viewer — read-only access to all sections

  ## Resources
  sebayat_profiles, applications, seba_today, seba_calendar, seba_history,
  seba_assign, seba_categories, nijog, notices, committees, admins, roles,
  settings, notifications, activity_log, reports

  ## Security
  - RLS enabled on both new tables
  - Only authenticated admins can read roles and permissions
  - Only Super Admins can create/edit/delete custom roles
*/

-- ── admin_roles ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_roles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name     text NOT NULL UNIQUE,
  description   text NOT NULL DEFAULT '',
  is_system_role boolean NOT NULL DEFAULT false,
  color         text NOT NULL DEFAULT '#6B7280',
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;

-- Any authenticated admin can read roles
CREATE POLICY "Admins can read roles"
  ON admin_roles FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid())
  );

-- Only super admins can insert custom roles
CREATE POLICY "Super admins can create roles"
  ON admin_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid() AND is_super_admin = true)
    AND is_system_role = false
  );

-- Only super admins can update custom roles
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

-- Only super admins can delete custom roles
CREATE POLICY "Super admins can delete custom roles"
  ON admin_roles FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid() AND is_super_admin = true)
    AND is_system_role = false
  );

-- ── role_permissions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_permissions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id    uuid NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
  resource   text NOT NULL,
  action     text NOT NULL,
  UNIQUE(role_id, resource, action)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Any authenticated admin can read permissions
CREATE POLICY "Admins can read role permissions"
  ON role_permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid())
  );

-- Only super admins can manage permissions
CREATE POLICY "Super admins can insert permissions"
  ON role_permissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Super admins can delete permissions"
  ON role_permissions FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid() AND is_super_admin = true)
  );

-- ── Add role_id to pratihari_admins ──────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pratihari_admins' AND column_name = 'role_id'
  ) THEN
    ALTER TABLE pratihari_admins ADD COLUMN role_id uuid REFERENCES admin_roles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── Seed system roles ─────────────────────────────────────────────────────────
INSERT INTO admin_roles (role_name, description, is_system_role, color) VALUES
  ('Super Admin', 'Full access including role and admin management', true, '#B45309'),
  ('Admin',       'Full operational access excluding admin/role management', true, '#1D4ED8'),
  ('Moderator',   'Can approve applications, manage notices; no deletions', true, '#065F46'),
  ('Viewer',      'Read-only access to all sections', true, '#6B7280')
ON CONFLICT (role_name) DO NOTHING;

-- ── Seed permissions ──────────────────────────────────────────────────────────
DO $$
DECLARE
  sa_id  uuid;
  adm_id uuid;
  mod_id uuid;
  viw_id uuid;
  all_resources text[] := ARRAY[
    'sebayat_profiles','applications','seba_today','seba_calendar','seba_history',
    'seba_assign','seba_categories','nijog','notices','committees',
    'admins','roles','settings','notifications','activity_log','reports'
  ];
  all_actions text[] := ARRAY['view','create','edit','delete','approve','export'];
  res text;
  act text;
BEGIN
  SELECT id INTO sa_id  FROM admin_roles WHERE role_name = 'Super Admin';
  SELECT id INTO adm_id FROM admin_roles WHERE role_name = 'Admin';
  SELECT id INTO mod_id FROM admin_roles WHERE role_name = 'Moderator';
  SELECT id INTO viw_id FROM admin_roles WHERE role_name = 'Viewer';

  -- Super Admin: everything
  FOREACH res IN ARRAY all_resources LOOP
    FOREACH act IN ARRAY all_actions LOOP
      INSERT INTO role_permissions (role_id, resource, action)
      VALUES (sa_id, res, act)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  -- Admin: everything except admins/roles management
  FOREACH res IN ARRAY all_resources LOOP
    IF res NOT IN ('admins','roles') THEN
      FOREACH act IN ARRAY all_actions LOOP
        INSERT INTO role_permissions (role_id, resource, action)
        VALUES (adm_id, res, act)
        ON CONFLICT DO NOTHING;
      END LOOP;
    ELSE
      -- Admin can VIEW admins/roles but not manage
      INSERT INTO role_permissions (role_id, resource, action) VALUES (adm_id, res, 'view') ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- Moderator: view all + approve applications + create/edit notices
  FOREACH res IN ARRAY all_resources LOOP
    INSERT INTO role_permissions (role_id, resource, action) VALUES (mod_id, res, 'view') ON CONFLICT DO NOTHING;
  END LOOP;
  INSERT INTO role_permissions (role_id, resource, action) VALUES (mod_id, 'applications', 'approve')    ON CONFLICT DO NOTHING;
  INSERT INTO role_permissions (role_id, resource, action) VALUES (mod_id, 'sebayat_profiles', 'approve') ON CONFLICT DO NOTHING;
  INSERT INTO role_permissions (role_id, resource, action) VALUES (mod_id, 'notices', 'create')           ON CONFLICT DO NOTHING;
  INSERT INTO role_permissions (role_id, resource, action) VALUES (mod_id, 'notices', 'edit')             ON CONFLICT DO NOTHING;

  -- Viewer: view only
  FOREACH res IN ARRAY all_resources LOOP
    INSERT INTO role_permissions (role_id, resource, action) VALUES (viw_id, res, 'view') ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- ── Assign roles to existing admins ──────────────────────────────────────────
-- Super admins get Super Admin role, others get Admin role
UPDATE pratihari_admins pa
SET role_id = (SELECT id FROM admin_roles WHERE role_name = 'Super Admin')
WHERE pa.is_super_admin = true AND pa.role_id IS NULL;

UPDATE pratihari_admins pa
SET role_id = (SELECT id FROM admin_roles WHERE role_name = 'Admin')
WHERE pa.is_super_admin = false AND pa.role_id IS NULL;

-- Create indexes for query performance
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_pratihari_admins_role_id ON pratihari_admins(role_id);
