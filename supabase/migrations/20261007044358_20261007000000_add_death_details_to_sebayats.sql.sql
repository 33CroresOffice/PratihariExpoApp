/*
# Add Death Details tracking to sebayats

1. New Columns on `sebayats`
- `is_deceased` (boolean, default false) — marks the sebayat as deceased
- `date_of_death` (date, nullable) — date the sebayat passed away
- `place_of_death` (text, nullable) — where the sebayat died
- `cause_of_death` (text, nullable) — cause of death if known
- `death_notes` (text, nullable) — additional admin remarks about the death
- `deactivated_at` (timestamptz, nullable) — when the admin deactivated the profile upon death
- `reassigned_to` (uuid, nullable, references sebayats.id) — which sebayat took over the deceased's Nijog responsibilities

2. Security
- No RLS policy changes needed — existing UPDATE policies for admins on `sebayats` already cover new columns.
- The `reassigned_to` foreign key uses ON DELETE SET NULL so deleting the replacement sebayat doesn't cascade.

3. Important Notes
- When a sebayat is marked deceased, the admin dashboard also sets `is_suspended = true` to hide them from the member directory.
- The `reassigned_to` column is informational; actual Nijog assignment rows are moved via the admin dashboard to the replacement sebayat's record in `nijog_assignments`.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sebayats' AND column_name = 'is_deceased') THEN
    ALTER TABLE sebayats ADD COLUMN is_deceased boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sebayats' AND column_name = 'date_of_death') THEN
    ALTER TABLE sebayats ADD COLUMN date_of_death date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sebayats' AND column_name = 'place_of_death') THEN
    ALTER TABLE sebayats ADD COLUMN place_of_death text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sebayats' AND column_name = 'cause_of_death') THEN
    ALTER TABLE sebayats ADD COLUMN cause_of_death text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sebayats' AND column_name = 'death_notes') THEN
    ALTER TABLE sebayats ADD COLUMN death_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sebayats' AND column_name = 'deactivated_at') THEN
    ALTER TABLE sebayats ADD COLUMN deactivated_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sebayats' AND column_name = 'reassigned_to') THEN
    ALTER TABLE sebayats ADD COLUMN reassigned_to uuid REFERENCES sebayats(id) ON DELETE SET NULL;
  END IF;
END $$;
