/*
  # Add scheduled_publish_at to notices

  Adds a nullable timestamp column `scheduled_publish_at` to the notices table.
  When set, the notice is intended to go live at that future time rather than immediately.
  The existing `is_published` and `published_at` columns remain unchanged.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notices' AND column_name = 'scheduled_publish_at'
  ) THEN
    ALTER TABLE notices ADD COLUMN scheduled_publish_at timestamptz DEFAULT NULL;
  END IF;
END $$;
