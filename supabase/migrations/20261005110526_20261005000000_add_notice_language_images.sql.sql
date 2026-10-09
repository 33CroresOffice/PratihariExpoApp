/*
# Add bilingual notice image storage

1. New columns on `notices`
- `image_url` (text, nullable) — public image URL for the English notice section.
- `image_or_url` (text, nullable) — public image URL for the Odia notice section.

2. Storage
- Creates the public `notice-images` bucket for notice artwork.
- Allows public reads so published notices can display their images.
- Allows authenticated Pratihari admins to upload, update, and delete notice images.

3. Security
- No existing table RLS policies are changed.
- Storage writes are restricted through the existing `is_pratihari_admin(auth.uid())` check.

4. Notes
- The migration is idempotent and preserves all existing notice data.
- Images are limited to common web image formats and 5 MB per file.
*/

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notices') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'notices' AND column_name = 'image_url'
    ) THEN
      ALTER TABLE public.notices ADD COLUMN image_url text;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'notices' AND column_name = 'image_or_url'
    ) THEN
      ALTER TABLE public.notices ADD COLUMN image_or_url text;
    END IF;
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'notice-images',
  'notice-images',
  true,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can view notice images" ON storage.objects;
CREATE POLICY "Public can view notice images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'notice-images');

DROP POLICY IF EXISTS "Admins can upload notice images" ON storage.objects;
CREATE POLICY "Admins can upload notice images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'notice-images' AND public.is_pratihari_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update notice images" ON storage.objects;
CREATE POLICY "Admins can update notice images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'notice-images' AND public.is_pratihari_admin(auth.uid()))
  WITH CHECK (bucket_id = 'notice-images' AND public.is_pratihari_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete notice images" ON storage.objects;
CREATE POLICY "Admins can delete notice images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'notice-images' AND public.is_pratihari_admin(auth.uid()));