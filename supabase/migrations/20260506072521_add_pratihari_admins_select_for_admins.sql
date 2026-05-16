/*
  # Allow admins to read all pratihari_admins rows

  The existing SELECT policy only returns a user's own row.
  The admin dashboard lists all admins, so any admin must be
  able to read the full table. We add a second SELECT policy
  scoped to authenticated admins.
*/

CREATE POLICY "Admins can read all admin rows"
  ON pratihari_admins FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratihari_admins pa
      WHERE pa.user_id = auth.uid()
    )
  );
