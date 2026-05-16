/*
  # Create Event Images Table

  ## Purpose
  Allows admins to upload and manage event/carousel images displayed
  in the home screen slider panel for all users.

  ## New Tables
  - `event_images`
    - `id` (uuid, primary key)
    - `title` (text) — display title shown on the slide
    - `subtitle` (text, nullable) — optional subtitle
    - `image_url` (text) — publicly accessible image URL
    - `display_order` (int) — controls sort order in the carousel
    - `is_active` (boolean) — toggle visibility without deleting
    - `created_by` (uuid) — references auth.users
    - `created_at` / `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Authenticated users can SELECT active images
  - Only pratihari admins can INSERT, UPDATE, DELETE
*/

CREATE TABLE IF NOT EXISTS event_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  subtitle text,
  image_url text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE event_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active event images"
  ON event_images FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can view all event images"
  ON event_images FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratihari_admins
      WHERE pratihari_admins.user_id = auth.uid()
        AND pratihari_admins.is_disabled = false
    )
  );

CREATE POLICY "Admins can insert event images"
  ON event_images FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pratihari_admins
      WHERE pratihari_admins.user_id = auth.uid()
        AND pratihari_admins.is_disabled = false
    )
  );

CREATE POLICY "Admins can update event images"
  ON event_images FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratihari_admins
      WHERE pratihari_admins.user_id = auth.uid()
        AND pratihari_admins.is_disabled = false
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pratihari_admins
      WHERE pratihari_admins.user_id = auth.uid()
        AND pratihari_admins.is_disabled = false
    )
  );

CREATE POLICY "Admins can delete event images"
  ON event_images FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratihari_admins
      WHERE pratihari_admins.user_id = auth.uid()
        AND pratihari_admins.is_disabled = false
    )
  );

CREATE OR REPLACE FUNCTION update_event_images_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER event_images_updated_at
  BEFORE UPDATE ON event_images
  FOR EACH ROW EXECUTE FUNCTION update_event_images_updated_at();

CREATE INDEX IF NOT EXISTS event_images_order_idx ON event_images (is_active, display_order ASC);
