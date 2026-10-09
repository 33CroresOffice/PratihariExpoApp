/*
  # Complete Notification System: In-App Channel + Multi-Stage Beddha Reminders + Broadcast

  ## Summary
  Extends the existing notification infrastructure with:
  1. In-app notification channel for sebayats (modal + bell + notification list)
  2. Multi-stage beddha reminders at 5-day, 3-day, 1-day (8 PM IST) and day-of (4 AM IST)
  3. Manual broadcast notification support with recipient type selection
  4. Updated cron scheduling for 4 reminder stages

  ## New Tables

  ### sebayat_notifications
  Stores in-app notifications shown to sebayats via bell icon and modal.
  - id (uuid, PK)
  - sebayat_id (uuid, FK to sebayats, ON DELETE CASCADE)
  - event_key (text) — which event triggered this notification
  - title (text)
  - body (text)
  - reference_type (text, nullable) — e.g. 'notice', 'application', 'seba'
  - reference_id (uuid, nullable)
  - is_read (boolean, default false)
  - created_at (timestamptz)

  ## Modified Tables

  ### notification_feature_config
  - Added `inapp_enabled` boolean column (default false) — per-event in-app channel toggle
  - Added `inapp_title_template` text column — template for in-app notification title
  - Added `inapp_body_template` text column — template for in-app notification body

  ### notification_channels
  - Added 'inapp' channel seed row

  ### seba_notification_config
  - Added `five_day_reminder_enabled` boolean (default true)
  - Added `five_day_reminder_time` time (default '20:00')
  - Added `three_day_reminder_enabled` boolean (default true)
  - Added `three_day_reminder_time` time (default '20:00')
  - Added `one_day_reminder_enabled` boolean (default true)
  - Added `one_day_reminder_time` time (default '20:00')
  - Changed `morning_reminder_time` default from '06:00' to '04:00'
  - Changed `morning_reminder_enabled` to represent day-of reminder
  - Evening reminder fields repurposed for the 1-day-before 8PM reminder (existing config preserved, new fields take precedence)

  ## New Feature Config Entries
  - seba_5day_reminder — 5 days before at 8 PM IST
  - seba_3day_reminder — 3 days before at 8 PM IST
  - seba_1day_reminder — 1 day before at 8 PM IST (replaces seba_evening_reminder)
  - seba_dayof_reminder — day-of at 4 AM IST (replaces seba_morning_reminder)

  ## Security
  - RLS on sebayat_notifications: sebayats can read/update their own; service_role can insert
  - Existing admin policies unchanged
*/

-- ============================================================
-- 1. Add inapp_enabled columns to notification_feature_config
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_feature_config' AND column_name = 'inapp_enabled'
  ) THEN
    ALTER TABLE notification_feature_config ADD COLUMN inapp_enabled boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_feature_config' AND column_name = 'inapp_title_template'
  ) THEN
    ALTER TABLE notification_feature_config ADD COLUMN inapp_title_template text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_feature_config' AND column_name = 'inapp_body_template'
  ) THEN
    ALTER TABLE notification_feature_config ADD COLUMN inapp_body_template text NOT NULL DEFAULT '';
  END IF;
END $$;

-- ============================================================
-- 2. Add 'inapp' channel seed
-- ============================================================
INSERT INTO notification_channels (channel, enabled, push_mode) VALUES
  ('inapp', true, 'expo-go')
ON CONFLICT (channel) DO NOTHING;

-- ============================================================
-- 3. Create sebayat_notifications table
-- ============================================================
CREATE TABLE IF NOT EXISTS sebayat_notifications (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sebayat_id     uuid NOT NULL REFERENCES sebayats(id) ON DELETE CASCADE,
  event_key      text NOT NULL DEFAULT '',
  title          text NOT NULL DEFAULT '',
  body           text NOT NULL DEFAULT '',
  reference_type text,
  reference_id   uuid,
  is_read        boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sebayat_notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sebayat_notifications_sebayat_created
  ON sebayat_notifications(sebayat_id, created_at DESC);

DROP POLICY IF EXISTS "Sebayats can read own notifications" ON sebayat_notifications;
CREATE POLICY "Sebayats can read own notifications"
  ON sebayat_notifications FOR SELECT
  TO authenticated
  USING (
    sebayat_id IN (SELECT id FROM sebayats WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Sebayats can update own notifications" ON sebayat_notifications;
CREATE POLICY "Sebayats can update own notifications"
  ON sebayat_notifications FOR UPDATE
  TO authenticated
  USING (
    sebayat_id IN (SELECT id FROM sebayats WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    sebayat_id IN (SELECT id FROM sebayats WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Service role can insert sebayat notifications" ON sebayat_notifications;
CREATE POLICY "Service role can insert sebayat notifications"
  ON sebayat_notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read all sebayat notifications" ON sebayat_notifications;
CREATE POLICY "Admins can read all sebayat notifications"
  ON sebayat_notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid())
  );

-- ============================================================
-- 4. Add multi-stage reminder columns to seba_notification_config
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seba_notification_config' AND column_name = 'five_day_reminder_enabled'
  ) THEN
    ALTER TABLE seba_notification_config ADD COLUMN five_day_reminder_enabled boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seba_notification_config' AND column_name = 'five_day_reminder_time'
  ) THEN
    ALTER TABLE seba_notification_config ADD COLUMN five_day_reminder_time time NOT NULL DEFAULT '20:00';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seba_notification_config' AND column_name = 'three_day_reminder_enabled'
  ) THEN
    ALTER TABLE seba_notification_config ADD COLUMN three_day_reminder_enabled boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seba_notification_config' AND column_name = 'three_day_reminder_time'
  ) THEN
    ALTER TABLE seba_notification_config ADD COLUMN three_day_reminder_time time NOT NULL DEFAULT '20:00';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seba_notification_config' AND column_name = 'one_day_reminder_enabled'
  ) THEN
    ALTER TABLE seba_notification_config ADD COLUMN one_day_reminder_enabled boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seba_notification_config' AND column_name = 'one_day_reminder_time'
  ) THEN
    ALTER TABLE seba_notification_config ADD COLUMN one_day_reminder_time time NOT NULL DEFAULT '20:00';
  END IF;
END $$;

-- Update morning reminder default to 04:00 for day-of
UPDATE seba_notification_config SET morning_reminder_time = '04:00' WHERE id = 1 AND morning_reminder_time = '06:00';

-- ============================================================
-- 5. Seed new feature config entries for multi-stage reminders
-- ============================================================
INSERT INTO notification_feature_config
  (event_key, label, sms_enabled, whatsapp_enabled, push_enabled, inapp_enabled, admin_notification_enabled,
   sms_template, whatsapp_template, push_template, inapp_title_template, inapp_body_template, sort_order)
VALUES
  (
    'seba_5day_reminder',
    'Seba — 5 Day Reminder (8 PM)',
    false, false, false, true, false,
    'Reminder: You have {{seba_name}} seba in 5 days ({{service_date}}). Beddha #{{beddha_number}}. Please be prepared.',
    'Reminder: You have {{seba_name}} seba in 5 days ({{service_date}}). Beddha #{{beddha_number}}. Please be prepared.',
    'Your seba {{seba_name}} is in 5 days. Beddha #{{beddha_number}}.',
    'Seba in 5 days',
    'You have {{seba_name}} seba on {{service_date}} (Beddha #{{beddha_number}}). Please be prepared.',
    13
  ),
  (
    'seba_3day_reminder',
    'Seba — 3 Day Reminder (8 PM)',
    false, false, false, true, false,
    'Reminder: You have {{seba_name}} seba in 3 days ({{service_date}}). Beddha #{{beddha_number}}. Please be prepared.',
    'Reminder: You have {{seba_name}} seba in 3 days ({{service_date}}). Beddha #{{beddha_number}}. Please be prepared.',
    'Your seba {{seba_name}} is in 3 days. Beddha #{{beddha_number}}.',
    'Seba in 3 days',
    'You have {{seba_name}} seba on {{service_date}} (Beddha #{{beddha_number}}). Please be prepared.',
    14
  ),
  (
    'seba_1day_reminder',
    'Seba — 1 Day Reminder (8 PM)',
    false, false, false, true, false,
    'Reminder: You have {{seba_name}} seba tomorrow ({{service_date}}). Beddha #{{beddha_number}}. Please be prepared.',
    'Reminder: You have {{seba_name}} seba tomorrow ({{service_date}}). Beddha #{{beddha_number}}. Please be prepared.',
    'Your seba {{seba_name}} is tomorrow. Beddha #{{beddha_number}}.',
    'Seba tomorrow',
    'You have {{seba_name}} seba tomorrow on {{service_date}} (Beddha #{{beddha_number}}). Please be prepared.',
    15
  ),
  (
    'seba_dayof_reminder',
    'Seba — Day Of Reminder (4 AM)',
    false, false, false, true, false,
    'Good morning. Your seba today is {{seba_name}} at Beddha #{{beddha_number}}. Please arrive on time.',
    'Good morning. Your seba today is {{seba_name}} at Beddha #{{beddha_number}}. Please arrive on time.',
    'Your seba {{seba_name}} is today. Beddha #{{beddha_number}}.',
    'Seba today',
    'Your seba today is {{seba_name}} (Beddha #{{beddha_number}}). Please arrive on time.',
    16
  ),
  (
    'manual_broadcast',
    'Manual Broadcast',
    false, false, false, true, false,
    '{{message}}',
    '{{message}}',
    '{{title}}',
    '{{title}}',
    '{{message}}',
    20
  )
ON CONFLICT (event_key) DO NOTHING;

-- Update existing feature configs with inapp defaults
UPDATE notification_feature_config
SET inapp_enabled = true,
    inapp_title_template = CASE event_key
      WHEN 'registration_approved' THEN 'Registration Approved'
      WHEN 'registration_rejected' THEN 'Registration Rejected'
      WHEN 'registration_changes_requested' THEN 'Changes Requested'
      WHEN 'application_status_changed' THEN 'Application Update'
      WHEN 'notice_published' THEN '{{title}}'
      ELSE label
    END,
    inapp_body_template = CASE event_key
      WHEN 'registration_approved' THEN 'Dear {{name}}, your registration has been approved. Registration No: {{registration_no}}.'
      WHEN 'registration_rejected' THEN 'Dear {{name}}, your registration has been rejected. Reason: {{remarks}}.'
      WHEN 'registration_changes_requested' THEN 'Dear {{name}}, please update your registration. Remarks: {{remarks}}.'
      WHEN 'application_status_changed' THEN 'Your application status: {{status}}. {{remarks}}'
      WHEN 'notice_published' THEN '{{body}}'
      ELSE ''
    END
WHERE event_key IN ('registration_approved', 'registration_rejected', 'registration_changes_requested',
                    'application_status_changed', 'notice_published')
  AND inapp_title_template = '';

-- ============================================================
-- 6. Add notification_log INSERT policy for service_role (already exists but ensure)
-- ============================================================
DROP POLICY IF EXISTS "Service role can insert notification log" ON notification_log;
CREATE POLICY "Service role can insert notification log"
  ON notification_log FOR INSERT
  TO service_role
  WITH CHECK (true);