/*
  # Create Notification Module Tables

  ## Summary
  Sets up the complete notification system infrastructure with four new tables
  and appropriate RLS policies.

  ## New Tables

  ### 1. notification_channels
  Stores global configuration for each notification channel (sms, whatsapp, push).
  - `channel` (text, primary key) — channel identifier: 'sms', 'whatsapp', 'push'
  - `enabled` (boolean) — global on/off switch for this channel
  - `push_mode` (text) — for push channel: 'expo-go' or 'production'
  - `updated_at` (timestamptz) — last updated timestamp

  ### 2. notification_feature_config
  Maps each app event to per-channel enabled flags and message templates.
  - `event_key` (text, primary key) — e.g. 'registration_approved', 'notice_published'
  - `label` (text) — human-readable event name shown in admin UI
  - `sms_enabled`, `whatsapp_enabled`, `push_enabled` (boolean) — per-channel toggles
  - `sms_template`, `whatsapp_template`, `push_template` (text) — message templates with {{variable}} placeholders
  - `admin_notification_enabled` (boolean) — whether to create in-dashboard admin alert
  - `sort_order` (int) — display order in admin UI

  ### 3. notification_log
  Audit trail of every notification sent or attempted.
  - `id` (uuid, primary key)
  - `event_key` (text) — which event triggered this
  - `channel` (text) — 'sms', 'whatsapp', 'push', 'admin'
  - `recipient_type` (text) — 'sebayat' or 'admin'
  - `recipient_sebayat_id` (uuid, nullable FK to sebayats)
  - `recipient_phone` (text, nullable)
  - `status` (text) — 'sent', 'failed', 'skipped'
  - `provider_response` (jsonb) — raw response from MSG91/Expo
  - `error_message` (text, nullable)
  - `created_at` (timestamptz)

  ### 4. push_tokens
  Stores Expo push tokens per sebayat.
  - `id` (uuid, primary key)
  - `sebayat_id` (uuid, FK to sebayats)
  - `token` (text) — Expo push token
  - `mode` (text) — 'expo-go' or 'production'
  - `platform` (text) — 'ios', 'android', 'web'
  - `created_at`, `updated_at` (timestamptz)

  ### 5. admin_notifications
  In-dashboard notification bell entries for admins.
  - `id` (uuid, primary key)
  - `event_key` (text)
  - `title` (text)
  - `body` (text)
  - `reference_type` (text, nullable) — e.g. 'sebayat', 'application', 'notice'
  - `reference_id` (uuid, nullable)
  - `is_read` (boolean)
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Admins (pratihari_admins) can read/write all notification config and logs
  - Sebayats can only insert/update their own push tokens
  - Admin notifications readable by admins only

  ## Seed Data
  Inserts default channel configs and feature configs with sensible defaults.
*/

-- ============================================================
-- Table: notification_channels
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_channels (
  channel      text PRIMARY KEY,
  enabled      boolean NOT NULL DEFAULT false,
  push_mode    text NOT NULL DEFAULT 'expo-go',
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notification_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read notification channels"
  ON notification_channels FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can update notification channels"
  ON notification_channels FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid())
  );

-- ============================================================
-- Table: notification_feature_config
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_feature_config (
  event_key                  text PRIMARY KEY,
  label                      text NOT NULL DEFAULT '',
  sms_enabled                boolean NOT NULL DEFAULT false,
  whatsapp_enabled           boolean NOT NULL DEFAULT false,
  push_enabled               boolean NOT NULL DEFAULT false,
  admin_notification_enabled boolean NOT NULL DEFAULT true,
  sms_template               text NOT NULL DEFAULT '',
  whatsapp_template          text NOT NULL DEFAULT '',
  push_template              text NOT NULL DEFAULT '',
  sort_order                 int NOT NULL DEFAULT 0,
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notification_feature_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read notification feature config"
  ON notification_feature_config FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can update notification feature config"
  ON notification_feature_config FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid())
  );

-- ============================================================
-- Table: notification_log
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_log (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key             text NOT NULL DEFAULT '',
  channel               text NOT NULL DEFAULT '',
  recipient_type        text NOT NULL DEFAULT 'sebayat',
  recipient_sebayat_id  uuid REFERENCES sebayats(id) ON DELETE SET NULL,
  recipient_phone       text,
  status                text NOT NULL DEFAULT 'sent',
  provider_response     jsonb,
  error_message         text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read notification log"
  ON notification_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "Service role can insert notification log"
  ON notification_log FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================
-- Table: push_tokens
-- ============================================================
CREATE TABLE IF NOT EXISTS push_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sebayat_id   uuid NOT NULL REFERENCES sebayats(id) ON DELETE CASCADE,
  token        text NOT NULL,
  mode         text NOT NULL DEFAULT 'expo-go',
  platform     text NOT NULL DEFAULT 'unknown',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sebayat_id, token)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sebayats can insert own push tokens"
  ON push_tokens FOR INSERT
  TO authenticated
  WITH CHECK (
    sebayat_id IN (
      SELECT id FROM sebayats WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Sebayats can update own push tokens"
  ON push_tokens FOR UPDATE
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

CREATE POLICY "Admins can read push tokens"
  ON push_tokens FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "Service role can manage push tokens"
  ON push_tokens FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================
-- Table: admin_notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_notifications (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key      text NOT NULL DEFAULT '',
  title          text NOT NULL DEFAULT '',
  body           text NOT NULL DEFAULT '',
  reference_type text,
  reference_id   uuid,
  is_read        boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read admin notifications"
  ON admin_notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can update admin notifications"
  ON admin_notifications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "Service role can insert admin notifications"
  ON admin_notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================
-- Seed: default channel configs
-- ============================================================
INSERT INTO notification_channels (channel, enabled, push_mode) VALUES
  ('sms',       false, 'expo-go'),
  ('whatsapp',  false, 'expo-go'),
  ('push',      false, 'expo-go')
ON CONFLICT (channel) DO NOTHING;

-- ============================================================
-- Seed: default feature configs
-- ============================================================
INSERT INTO notification_feature_config
  (event_key, label, sms_enabled, whatsapp_enabled, push_enabled, admin_notification_enabled,
   sms_template, whatsapp_template, push_template, sort_order)
VALUES
  (
    'registration_submitted',
    'Registration Submitted',
    false, false, false, true,
    'Dear Admin, a new registration has been submitted by {{name}} ({{phone}}). Please review at your earliest convenience.',
    'Dear Admin, a new registration has been submitted by {{name}} ({{phone}}). Please review at your earliest convenience.',
    'New registration submitted by {{name}}',
    1
  ),
  (
    'registration_approved',
    'Registration Approved',
    false, false, false, false,
    'Dear {{name}}, your registration has been approved. Your registration number is {{registration_no}}. Welcome to the Nijog system.',
    'Dear {{name}}, your registration has been approved. Your registration number is {{registration_no}}. Welcome to the Nijog system.',
    'Your registration has been approved. Registration No: {{registration_no}}',
    2
  ),
  (
    'registration_rejected',
    'Registration Rejected',
    false, false, false, false,
    'Dear {{name}}, your registration has been rejected. Reason: {{remarks}}. Please contact us for more information.',
    'Dear {{name}}, your registration has been rejected. Reason: {{remarks}}. Please contact us for more information.',
    'Your registration was not approved. Reason: {{remarks}}',
    3
  ),
  (
    'registration_changes_requested',
    'Changes Requested',
    false, false, false, false,
    'Dear {{name}}, your registration requires some changes. Remarks: {{remarks}}. Please update and resubmit.',
    'Dear {{name}}, your registration requires some changes. Remarks: {{remarks}}. Please update and resubmit.',
    'Changes requested on your registration. Remarks: {{remarks}}',
    4
  ),
  (
    'application_status_changed',
    'Application Status Changed',
    false, false, false, true,
    'Dear {{name}}, your application status has been updated to {{status}}. {{remarks}}',
    'Dear {{name}}, your application status has been updated to {{status}}. {{remarks}}',
    'Application status updated to {{status}}',
    5
  ),
  (
    'notice_published',
    'Notice Published',
    false, false, false, false,
    'Important Notice: {{title}} — {{body}}',
    'Important Notice: {{title}} — {{body}}',
    '{{title}}',
    6
  )
ON CONFLICT (event_key) DO NOTHING;
