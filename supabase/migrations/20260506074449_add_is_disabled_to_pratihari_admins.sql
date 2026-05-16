/*
  # Add is_disabled column to pratihari_admins

  Allows super admins to disable an admin account without removing them,
  preventing dashboard login while preserving their record and role assignment.

  Changes:
  - pratihari_admins: add `is_disabled boolean DEFAULT false`
  - admin_users_view: drop and recreate to include is_disabled
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pratihari_admins' AND column_name = 'is_disabled'
  ) THEN
    ALTER TABLE pratihari_admins ADD COLUMN is_disabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DROP VIEW IF EXISTS admin_users_view;

CREATE VIEW admin_users_view
WITH (security_invoker = false)
AS
SELECT
  pa.id,
  pa.user_id,
  pa.role_id,
  pa.is_super_admin,
  pa.is_disabled,
  pa.added_by,
  pa.created_at,
  u.email
FROM pratihari_admins pa
JOIN auth.users u ON u.id = pa.user_id;

GRANT SELECT ON admin_users_view TO authenticated;
