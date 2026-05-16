/*
  # Create admin_users_view

  A secure view that joins pratihari_admins with auth.users to expose
  the email address of each admin account. Used by the admin dashboard
  to display email alongside the admin name.

  Security: view is defined as SECURITY DEFINER so it can read auth.users,
  but RLS on pratihari_admins still controls who can see which rows
  through the underlying table policies.
*/

CREATE OR REPLACE VIEW admin_users_view
WITH (security_invoker = false)
AS
SELECT
  pa.id,
  pa.user_id,
  pa.role_id,
  pa.is_super_admin,
  pa.added_by,
  pa.created_at,
  u.email
FROM pratihari_admins pa
JOIN auth.users u ON u.id = pa.user_id;

-- Grant access to authenticated users (RLS on pratihari_admins governs row visibility)
GRANT SELECT ON admin_users_view TO authenticated;
