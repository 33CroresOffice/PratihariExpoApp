/*
  # Add repeat publish columns to notices

  Allows a notice to be republished on a recurring schedule (daily, weekly, etc.)
  after its initial publish.

  1. New columns on notices
    - `repeat_enabled` (boolean, default false) — whether the notice repeats
    - `repeat_frequency` (text, nullable) — 'daily' | 'weekly' | 'monthly' | 'yearly'
    - `repeat_interval` (integer, default 1) — every N units (e.g. every 2 weeks)
    - `repeat_end_date` (date, nullable) — optional end date for repetition
    - `last_repeated_at` (timestamptz, nullable) — last time the notice was auto-republished

  2. Notes
    - When repeat_enabled is true, the notice will be eligible for automatic
      re-publishing based on the frequency/interval settings.
    - repeat_end_date is optional; if null the notice repeats indefinitely.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notices' AND column_name = 'repeat_enabled'
  ) THEN
    ALTER TABLE notices ADD COLUMN repeat_enabled boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notices' AND column_name = 'repeat_frequency'
  ) THEN
    ALTER TABLE notices ADD COLUMN repeat_frequency text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notices' AND column_name = 'repeat_interval'
  ) THEN
    ALTER TABLE notices ADD COLUMN repeat_interval integer NOT NULL DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notices' AND column_name = 'repeat_end_date'
  ) THEN
    ALTER TABLE notices ADD COLUMN repeat_end_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notices' AND column_name = 'last_repeated_at'
  ) THEN
    ALTER TABLE notices ADD COLUMN last_repeated_at timestamptz;
  END IF;
END $$;
