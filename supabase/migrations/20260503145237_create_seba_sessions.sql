/*
  # Create seba_sessions table

  ## Summary
  Adds a new table to track real-time seba attendance sessions initiated by sebayats
  (or recorded by admins). This is separate from the existing seba_roster which tracks
  scheduled duties — sessions record actual check-in/check-out timing.

  ## New Tables

  ### `seba_sessions`
  - `id` — Primary key
  - `sebayat_id` — FK to sebayats; whose session this is
  - `roster_id` — Optional FK to seba_roster; links to the scheduled duty slot
  - `seba_category_id` — FK to seba_categories; which seba was performed
  - `service_date` — The calendar date the seba was performed
  - `started_at` — Timestamp when the sebayat tapped "Start Seba"
  - `ended_at` — Timestamp when the sebayat tapped "End Seba" (nullable until ended)
  - `duration_minutes` — Computed duration in whole minutes (nullable until ended)
  - `notes` — Free-text notes (admin or sebayat)
  - `created_at`, `updated_at` — Audit timestamps

  ## Security
  - RLS enabled
  - Sebayats: can INSERT their own sessions, UPDATE their own sessions, SELECT their own
  - Admins: full SELECT on all sessions; can INSERT/UPDATE on behalf of any sebayat
*/

CREATE TABLE IF NOT EXISTS seba_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sebayat_id          uuid NOT NULL REFERENCES sebayats(id) ON DELETE CASCADE,
  roster_id           uuid REFERENCES seba_roster(id) ON DELETE SET NULL,
  seba_category_id    uuid NOT NULL REFERENCES seba_categories(id) ON DELETE CASCADE,
  service_date        date NOT NULL,
  started_at          timestamptz NOT NULL DEFAULT now(),
  ended_at            timestamptz,
  duration_minutes    integer,
  notes               text NOT NULL DEFAULT '',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Index for fast per-sebayat history lookups
CREATE INDEX IF NOT EXISTS seba_sessions_sebayat_id_idx ON seba_sessions(sebayat_id);
-- Index for per-date lookups
CREATE INDEX IF NOT EXISTS seba_sessions_service_date_idx ON seba_sessions(service_date);

ALTER TABLE seba_sessions ENABLE ROW LEVEL SECURITY;

-- Sebayats: select their own sessions
CREATE POLICY "Sebayats can view their own sessions"
  ON seba_sessions FOR SELECT
  TO authenticated
  USING (
    sebayat_id IN (
      SELECT id FROM sebayats WHERE auth_user_id = auth.uid()
    )
  );

-- Sebayats: start a session for themselves
CREATE POLICY "Sebayats can start their own sessions"
  ON seba_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    sebayat_id IN (
      SELECT id FROM sebayats WHERE auth_user_id = auth.uid()
    )
  );

-- Sebayats: update their own session (to record ended_at)
CREATE POLICY "Sebayats can end their own sessions"
  ON seba_sessions FOR UPDATE
  TO authenticated
  USING (
    sebayat_id IN (
      SELECT id FROM sebayats WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    sebayat_id IN (
      SELECT id FROM sebayats WHERE auth_user_id = auth.uid()
    )
  );

-- Admins: full select on all sessions
CREATE POLICY "Admins can view all sessions"
  ON seba_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()
    )
  );

-- Admins: insert sessions on behalf of any sebayat
CREATE POLICY "Admins can insert sessions for any sebayat"
  ON seba_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()
    )
  );

-- Admins: update any session
CREATE POLICY "Admins can update any session"
  ON seba_sessions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()
    )
  );
