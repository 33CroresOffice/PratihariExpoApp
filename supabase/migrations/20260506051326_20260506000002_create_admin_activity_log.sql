/*
  # Admin Activity Log — Unified Audit Trail

  ## Summary
  Creates a single comprehensive audit table that captures every admin action
  with full before/after diffs, actor identity, role snapshot, IP address,
  and user agent. All existing scattered audit data remains in its original
  tables for backward compatibility.

  ## New Tables

  ### admin_activity_log
  Central audit trail for all admin actions.
  - id: unique event id
  - actor_id: auth.users id of the admin who performed the action
  - actor_email: email snapshot at time of action (preserved even if email changes)
  - role_snapshot: role name at time of action (preserved even if role changes)
  - action_type: categorised action (login, create, update, delete, approve, etc.)
  - resource_type: which part of the system was affected
  - resource_id: the specific record affected (nullable)
  - resource_label: human-readable name of the affected record
  - old_value: JSON snapshot of fields BEFORE the change
  - new_value: JSON snapshot of fields AFTER the change
  - ip_address: client IP address (plain text, no geo lookup)
  - user_agent: browser/device user agent string
  - session_id: Supabase session id for session-level grouping
  - metadata: arbitrary extra context as JSON
  - created_at: when the event occurred

  ## Security
  - RLS enabled; admins can only insert their own log entries
  - Super admins can read all entries; other admins read only their own
  - No updates or deletes allowed — log is append-only

  ## Archive Table
  admin_activity_log_archive: identical structure for long-term cold storage.
  Data is archived by a scheduled job, not by this migration.

  ## Indexes
  Created on actor_id, action_type, resource_type, created_at for efficient filtering.
*/

CREATE TABLE IF NOT EXISTS admin_activity_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email    text NOT NULL DEFAULT '',
  role_snapshot  text NOT NULL DEFAULT '',
  action_type    text NOT NULL,
  resource_type  text NOT NULL DEFAULT '',
  resource_id    text,
  resource_label text NOT NULL DEFAULT '',
  old_value      jsonb,
  new_value      jsonb,
  ip_address     text NOT NULL DEFAULT '',
  user_agent     text NOT NULL DEFAULT '',
  session_id     text NOT NULL DEFAULT '',
  metadata       jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;

-- Any admin can insert their own log entries
CREATE POLICY "Admins can insert activity log"
  ON admin_activity_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = actor_id);

-- Super admins can read all entries
CREATE POLICY "Super admins can read all activity logs"
  ON admin_activity_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratihari_admins
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  );

-- Non-super admins can only read their own entries
CREATE POLICY "Admins can read own activity logs"
  ON admin_activity_log FOR SELECT
  TO authenticated
  USING (
    actor_id = auth.uid()
    AND EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid())
  );

-- No updates or deletes — log is append-only
-- (No UPDATE or DELETE policies created intentionally)

-- ── Archive table (identical structure, no RLS needed for cold storage) ───────
CREATE TABLE IF NOT EXISTS admin_activity_log_archive (
  LIKE admin_activity_log INCLUDING ALL
);

ALTER TABLE admin_activity_log_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read archived logs"
  ON admin_activity_log_archive FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratihari_admins
      WHERE user_id = auth.uid() AND is_super_admin = true
    )
  );

-- ── Indexes for efficient filtering ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_activity_log_actor_id     ON admin_activity_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_action_type  ON admin_activity_log(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_resource     ON admin_activity_log(resource_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at   ON admin_activity_log(created_at DESC);

-- Composite index for the most common combined filter (date + actor)
CREATE INDEX IF NOT EXISTS idx_activity_log_actor_date
  ON admin_activity_log(actor_id, created_at DESC);
