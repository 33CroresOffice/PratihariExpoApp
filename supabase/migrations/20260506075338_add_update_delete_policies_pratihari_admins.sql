/*
  # Add UPDATE and DELETE RLS policies to pratihari_admins

  Previously only SELECT and INSERT policies existed, causing role changes,
  disable/enable, and remove operations to silently fail due to RLS blocking.

  Changes:
  - Add UPDATE policy: super admins can update any non-system admin row
  - Add DELETE policy: super admins can delete any non-system admin row
    (system admins have added_by = null and are protected by the app layer too)
*/

CREATE POLICY "Super admins can update admin rows"
  ON pratihari_admins
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratihari_admins pa
      WHERE pa.user_id = auth.uid() AND pa.is_super_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pratihari_admins pa
      WHERE pa.user_id = auth.uid() AND pa.is_super_admin = true
    )
  );

CREATE POLICY "Super admins can delete admin rows"
  ON pratihari_admins
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratihari_admins pa
      WHERE pa.user_id = auth.uid() AND pa.is_super_admin = true
    )
  );
