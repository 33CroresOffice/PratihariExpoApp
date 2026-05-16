/*
  # Add admin audit fields to seba_sessions

  ## Summary
  Adds two optional columns to seba_sessions so the dashboard can record
  which admin clicked "Mark Done" / "Start" and when.

  ## Changes
  - seba_sessions.marked_done_by (uuid, nullable, FK → auth.users)
  - seba_sessions.marked_done_at (timestamptz, nullable)
  - seba_sessions.started_by_admin (uuid, nullable, FK → auth.users)
    set when an admin manually triggers Start from the dashboard

  ## Security
  No new policies needed — existing admin policies already cover UPDATE on seba_sessions.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seba_sessions' AND column_name = 'marked_done_by'
  ) THEN
    ALTER TABLE seba_sessions
      ADD COLUMN marked_done_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      ADD COLUMN marked_done_at   timestamptz,
      ADD COLUMN started_by_admin uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Allow admins to insert sessions (needed for admin-initiated "Start")
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'seba_sessions' AND policyname = 'Admins can insert seba sessions'
  ) THEN
    CREATE POLICY "Admins can insert seba sessions"
      ON seba_sessions FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- Allow admins to update any seba session
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'seba_sessions' AND policyname = 'Admins can update seba sessions'
  ) THEN
    CREATE POLICY "Admins can update seba sessions"
      ON seba_sessions FOR UPDATE
      TO authenticated
      USING (
        EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid())
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid())
      );
  END IF;
END $$;
