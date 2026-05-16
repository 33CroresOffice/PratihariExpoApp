/*
  # Seba Reminder Notification System

  ## Summary
  Adds infrastructure for three seba reminder types:
  1. Day-before evening reminder (default 6 PM)
  2. Morning-of reminder (default 6 AM)
  3. Preceding-niti live reminder triggered via external niti-tracker webhook

  ## Schema Changes
  1. seba_categories: add niti_sequence (int) column - daily order of each niti (1-40+)
  2. New table seba_notification_config - single-row admin-global settings
  3. New table niti_tracker_events - audit log of incoming webhook calls
  4. New feature_config entries for the three new events
  5. pg_cron jobs scheduled for evening (18:00 IST / 12:30 UTC) and morning (06:00 IST / 00:30 UTC)

  ## Security
  - RLS enabled on new tables
  - Admins can read/update seba_notification_config
  - niti_tracker_events: admins read, service_role inserts
*/

-- ============================================================
-- 1. niti_sequence column on seba_categories
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seba_categories' AND column_name = 'niti_sequence'
  ) THEN
    ALTER TABLE seba_categories ADD COLUMN niti_sequence integer;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_seba_categories_niti_sequence
  ON seba_categories(niti_sequence) WHERE niti_sequence IS NOT NULL;

-- ============================================================
-- 2. seba_notification_config (single row)
-- ============================================================
CREATE TABLE IF NOT EXISTS seba_notification_config (
  id                               integer PRIMARY KEY DEFAULT 1,
  evening_reminder_enabled         boolean NOT NULL DEFAULT true,
  evening_reminder_time            time    NOT NULL DEFAULT '18:00',
  morning_reminder_enabled         boolean NOT NULL DEFAULT true,
  morning_reminder_time            time    NOT NULL DEFAULT '06:00',
  preceding_niti_reminder_enabled  boolean NOT NULL DEFAULT true,
  preceding_niti_offset            integer NOT NULL DEFAULT 1 CHECK (preceding_niti_offset BETWEEN 1 AND 5),
  niti_tracker_integration_enabled boolean NOT NULL DEFAULT false,
  niti_tracker_webhook_secret      text    NOT NULL DEFAULT '',
  updated_at                       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seba_notification_config_single_row CHECK (id = 1)
);

ALTER TABLE seba_notification_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read seba notification config"
  ON seba_notification_config FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()));

CREATE POLICY "Admins can update seba notification config"
  ON seba_notification_config FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()));

CREATE POLICY "Admins can insert seba notification config"
  ON seba_notification_config FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()));

-- Seed the single row with a random webhook secret
INSERT INTO seba_notification_config (id, niti_tracker_webhook_secret)
VALUES (1, encode(gen_random_bytes(24), 'hex'))
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. niti_tracker_events (audit log)
-- ============================================================
CREATE TABLE IF NOT EXISTS niti_tracker_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  niti_sequence   integer,
  niti_name       text NOT NULL DEFAULT '',
  service_date    date,
  received_at     timestamptz NOT NULL DEFAULT now(),
  notified_count  integer NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'processed',
  error_message   text
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_niti_tracker_events_unique_processed
  ON niti_tracker_events(service_date, niti_sequence)
  WHERE status = 'processed';

CREATE INDEX IF NOT EXISTS idx_niti_tracker_events_received_at
  ON niti_tracker_events(received_at DESC);

ALTER TABLE niti_tracker_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read niti tracker events"
  ON niti_tracker_events FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()));

CREATE POLICY "Service role can insert niti tracker events"
  ON niti_tracker_events FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================
-- 4. Seed new feature_config entries for reminder events
-- ============================================================
INSERT INTO notification_feature_config
  (event_key, label, sms_enabled, whatsapp_enabled, push_enabled, admin_notification_enabled,
   sms_template, whatsapp_template, push_template, sort_order)
VALUES
  (
    'seba_evening_reminder',
    'Seba — Evening Reminder (Day Before)',
    false, false, false, false,
    'Reminder: You have {{seba_name}} seba tomorrow ({{service_date}}). Beddha #{{beddha_number}}. Please be prepared.',
    'Reminder: You have {{seba_name}} seba tomorrow ({{service_date}}). Beddha #{{beddha_number}}. Please be prepared.',
    'Your seba {{seba_name}} is tomorrow. Beddha #{{beddha_number}}.',
    10
  ),
  (
    'seba_morning_reminder',
    'Seba — Morning Reminder (Day Of)',
    false, false, false, false,
    'Good morning. Your seba today is {{seba_name}} at Beddha #{{beddha_number}}. Please arrive on time.',
    'Good morning. Your seba today is {{seba_name}} at Beddha #{{beddha_number}}. Please arrive on time.',
    'Your seba {{seba_name}} is today. Beddha #{{beddha_number}}.',
    11
  ),
  (
    'seba_preceding_niti_reminder',
    'Seba — Preceding Niti Reminder',
    false, false, false, false,
    '{{previous_niti_name}} (niti #{{previous_niti_sequence}}) has just started. Your seba {{seba_name}} is next — please proceed to the temple now.',
    '{{previous_niti_name}} (niti #{{previous_niti_sequence}}) has just started. Your seba {{seba_name}} is next — please proceed to the temple now.',
    'Your seba {{seba_name}} is next. {{previous_niti_name}} just started.',
    12
  )
ON CONFLICT (event_key) DO NOTHING;
