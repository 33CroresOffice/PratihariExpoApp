/*
  # Extend notices table with targeting and scheduling columns

  Adds audience targeting, delivery channel selection, and notification
  scheduling capabilities to the existing notices table.

  1. New columns on notices
    - `target_type` (text) DEFAULT 'all' — 'all' | 'group' | 'individual'
    - `target_ids` (jsonb) — group codes or sebayat UUIDs based on target_type
    - `channels` (jsonb) — selected delivery channels e.g. ["sms","whatsapp","push"]
    - `notify_at` (timestamptz, nullable) — scheduled delivery time chosen by admin
    - `notification_sent_at` (timestamptz, nullable) — stamped when delivery fires

  2. Notes
    - All channel delivery is stored but not triggered (system goes live later)
    - notify_at = NULL means "at time of publish"
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notices' AND column_name = 'target_type'
  ) THEN
    ALTER TABLE notices ADD COLUMN target_type text NOT NULL DEFAULT 'all';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notices' AND column_name = 'target_ids'
  ) THEN
    ALTER TABLE notices ADD COLUMN target_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notices' AND column_name = 'channels'
  ) THEN
    ALTER TABLE notices ADD COLUMN channels jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notices' AND column_name = 'notify_at'
  ) THEN
    ALTER TABLE notices ADD COLUMN notify_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notices' AND column_name = 'notification_sent_at'
  ) THEN
    ALTER TABLE notices ADD COLUMN notification_sent_at timestamptz;
  END IF;
END $$;
