/*
  # Add admin storage policies for profile-photos bucket

  ## Problem
  When an admin uploads an ID document photo via the Add Profile flow, the upload
  to the `profile-photos` storage bucket fails with "new row violates row-level
  security policy". The existing INSERT policy only allows uploads where the first
  folder segment equals `auth.uid()` (designed for sebayats uploading their own photo).
  Admins use a temp folder prefix (not their UID) for new profiles under construction.

  ## Changes
  - Add INSERT policy: admins can upload to any path in profile-photos
  - Add UPDATE policy: admins can update/replace any photo in profile-photos
  - Add DELETE policy: admins can delete any photo in profile-photos
*/

CREATE POLICY "Admins can upload profile photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND public.is_pratihari_admin(auth.uid())
  );

CREATE POLICY "Admins can update profile photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND public.is_pratihari_admin(auth.uid())
  )
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND public.is_pratihari_admin(auth.uid())
  );

CREATE POLICY "Admins can delete profile photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND public.is_pratihari_admin(auth.uid())
  );
