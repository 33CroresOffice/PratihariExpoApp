/*
  # Create application-attachments storage bucket

  ## Summary
  Creates the 'application-attachments' storage bucket used by the
  My Applications feature for uploading supporting documents.
  The bucket is private (not public) — access is controlled via RLS policies.

  ## Security
  - Authenticated sebayats can upload to their own folder
  - Authenticated sebayats can read and delete their own files
  - Admins can read and delete all attachments
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('application-attachments', 'application-attachments', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  -- Upload policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Sebayats can upload application attachments'
  ) THEN
    CREATE POLICY "Sebayats can upload application attachments"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'application-attachments'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  -- Read policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Sebayats can read own application attachments'
  ) THEN
    CREATE POLICY "Sebayats can read own application attachments"
      ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'application-attachments'
        AND (
          (storage.foldername(name))[1] = auth.uid()::text
          OR EXISTS (
            SELECT 1 FROM pratihari_admins
            WHERE pratihari_admins.user_id = auth.uid()
          )
        )
      );
  END IF;

  -- Delete own policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Sebayats can delete own application attachments'
  ) THEN
    CREATE POLICY "Sebayats can delete own application attachments"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'application-attachments'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  -- Admin delete policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins can delete application attachments'
  ) THEN
    CREATE POLICY "Admins can delete application attachments"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'application-attachments'
        AND EXISTS (
          SELECT 1 FROM pratihari_admins
          WHERE pratihari_admins.user_id = auth.uid()
        )
      );
  END IF;
END $$;
