/*
  # Add Odia content columns to committees, committee_members, and event_images

  ## Summary
  Adds optional Odia (_or) translation columns so admins can enter Odia text
  for committee and event image content. The app uses pickLocalized() to show
  the Odia version when the language is set to Odia, falling back to English.

  ## New Columns

  ### committees
  - `title_or` (text, nullable) — Odia translation of committee title
  - `description_or` (text, nullable) — Odia translation of description

  ### committee_members
  - `name_or` (text, nullable) — Odia translation of member name
  (role_or and description_or already exist from a prior migration)

  ### event_images
  - `title_or` (text, nullable) — Odia translation of image title
  - `subtitle_or` (text, nullable) — Odia translation of subtitle
  (caption_or already exists; keeping it for backward compatibility)

  ## Notes
  - All columns are nullable so existing records are unaffected
  - No RLS changes needed (inherits existing table policies)
*/

DO $$
BEGIN
  -- committees table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'committees' AND column_name = 'title_or') THEN
    ALTER TABLE committees ADD COLUMN title_or text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'committees' AND column_name = 'description_or') THEN
    ALTER TABLE committees ADD COLUMN description_or text;
  END IF;

  -- committee_members table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'committee_members' AND column_name = 'name_or') THEN
    ALTER TABLE committee_members ADD COLUMN name_or text;
  END IF;

  -- event_images table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_images' AND column_name = 'title_or') THEN
    ALTER TABLE event_images ADD COLUMN title_or text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_images' AND column_name = 'subtitle_or') THEN
    ALTER TABLE event_images ADD COLUMN subtitle_or text;
  END IF;
END $$;
