/*
  # Add INSERT policy to pratihari_admins

  Allows super admins to add new admin rows.
  The existing SELECT policy only covers reads; there was no INSERT policy,
  causing "violates row-level security" when adding an admin.
*/

CREATE POLICY "Super admins can insert admin rows"
  ON pratihari_admins FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pratihari_admins pa
      WHERE pa.user_id = auth.uid() AND pa.is_super_admin = true
    )
  );
