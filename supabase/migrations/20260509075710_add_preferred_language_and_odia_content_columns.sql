/*
  # Add language preference and optional Odia content columns

  1. Changes
    - Adds `preferred_language` column to `sebayats` (default 'en') so each user's language choice syncs across devices.
    - Adds optional Odia sibling columns to admin-managed content tables. Admins may leave them empty; the app falls back to the English value.
      - `notices`: `title_or`, `body_or`
      - `committee_members`: `role_or`, `description_or`
      - `event_images`: `caption_or`

  2. Security
    - No RLS policy changes. Existing policies continue to apply.

  3. Notes
    - All new columns are nullable with no enforced default (except `preferred_language` which defaults to 'en').
    - Uses IF NOT EXISTS guards to make the migration idempotent.
    - A check constraint restricts `preferred_language` to 'en' or 'or'.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sebayats' AND column_name = 'preferred_language'
  ) THEN
    ALTER TABLE sebayats ADD COLUMN preferred_language text DEFAULT 'en';
    ALTER TABLE sebayats ADD CONSTRAINT sebayats_preferred_language_check
      CHECK (preferred_language IN ('en','or'));
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notices') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notices' AND column_name='title_or') THEN
      ALTER TABLE notices ADD COLUMN title_or text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notices' AND column_name='body_or') THEN
      ALTER TABLE notices ADD COLUMN body_or text;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'committee_members') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='committee_members' AND column_name='role_or') THEN
      ALTER TABLE committee_members ADD COLUMN role_or text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='committee_members' AND column_name='description_or') THEN
      ALTER TABLE committee_members ADD COLUMN description_or text;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_images') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='event_images' AND column_name='caption_or') THEN
      ALTER TABLE event_images ADD COLUMN caption_or text;
    END IF;
  END IF;
END $$;
