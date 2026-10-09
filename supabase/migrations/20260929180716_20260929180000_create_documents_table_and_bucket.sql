/*
  # Create Document Management table and storage bucket

  ## Purpose
  Allows admins to upload important PDF documents (ROR, temple records, etc.)
  that enrolled (approved) Sebayats can view in the mobile app.

  ## New Tables
  - `documents`
    - `id` (uuid, primary key)
    - `title` (text) — display title
    - `title_or` (text, nullable) — Odia title
    - `description` (text, nullable) — optional description
    - `description_or` (text, nullable) — optional Odia description
    - `file_url` (text) — public URL to the uploaded PDF
    - `file_name` (text) — original filename for download
    - `file_size` (bigint) — size in bytes
    - `category` (text) — document category (e.g. 'ror', 'temple', 'legal', 'other')
    - `is_active` (boolean) — toggle visibility
    - `display_order` (int) — sort order
    - `created_by` (uuid) — references auth.users
    - `created_at` / `updated_at` (timestamptz)

  ## New Storage Bucket
  - `documents` — public read, admin-only upload/delete/update, PDF only, 20MB limit

  ## Security
  - RLS enabled on `documents`
  - Authenticated users can SELECT active documents (enrolled sebayats are authenticated)
  - Only pratihari admins can INSERT, UPDATE, DELETE
  - Storage: public read, admin-only write/delete
*/

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  title_or text,
  description text,
  description_or text,
  file_url text NOT NULL,
  file_name text NOT NULL DEFAULT '',
  file_size bigint NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'other',
  is_active boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view active documents" ON documents;
CREATE POLICY "Authenticated users can view active documents"
  ON documents FOR SELECT
  TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can view all documents" ON documents;
CREATE POLICY "Admins can view all documents"
  ON documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratihari_admins
      WHERE pratihari_admins.user_id = auth.uid()
        AND pratihari_admins.is_disabled = false
    )
  );

DROP POLICY IF EXISTS "Admins can insert documents" ON documents;
CREATE POLICY "Admins can insert documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pratihari_admins
      WHERE pratihari_admins.user_id = auth.uid()
        AND pratihari_admins.is_disabled = false
    )
  );

DROP POLICY IF EXISTS "Admins can update documents" ON documents;
CREATE POLICY "Admins can update documents"
  ON documents FOR UPDATE
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

DROP POLICY IF EXISTS "Admins can delete documents" ON documents;
CREATE POLICY "Admins can delete documents"
  ON documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pratihari_admins
      WHERE pratihari_admins.user_id = auth.uid()
        AND pratihari_admins.is_disabled = false
    )
  );

CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS documents_updated_at ON documents;
CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_documents_updated_at();

CREATE INDEX IF NOT EXISTS documents_order_idx ON documents (is_active, display_order ASC);

-- Storage bucket for PDF documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  20971520,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can view documents" ON storage.objects;
CREATE POLICY "Public can view documents"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'documents');

DROP POLICY IF EXISTS "Admins can upload documents" ON storage.objects;
CREATE POLICY "Admins can upload documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documents' AND is_pratihari_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete documents" ON storage.objects;
CREATE POLICY "Admins can delete documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'documents' AND is_pratihari_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update documents" ON storage.objects;
CREATE POLICY "Admins can update documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'documents' AND is_pratihari_admin(auth.uid()));
