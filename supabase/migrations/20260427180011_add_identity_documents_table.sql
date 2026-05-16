/*
  # Add identity_documents table

  1. New Tables
    - `identity_documents`
      - `id` (uuid, PK)
      - `sebayat_id` (uuid, FK to sebayats.id)
      - `id_type` (text) — e.g. "Aadhar Card", "PAN Card", "Voter ID"
      - `photo_url` (text) — uploaded scan/photo
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `identity_documents`
    - Sebayats can read/insert/update/delete their own documents
*/

CREATE TABLE IF NOT EXISTS identity_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sebayat_id uuid NOT NULL REFERENCES sebayats(id) ON DELETE CASCADE,
  id_type text NOT NULL DEFAULT '',
  photo_url text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE identity_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sebayat can view own id documents"
  ON identity_documents FOR SELECT
  TO authenticated
  USING (sebayat_id = auth.uid());

CREATE POLICY "Sebayat can insert own id documents"
  ON identity_documents FOR INSERT
  TO authenticated
  WITH CHECK (sebayat_id = auth.uid());

CREATE POLICY "Sebayat can update own id documents"
  ON identity_documents FOR UPDATE
  TO authenticated
  USING (sebayat_id = auth.uid())
  WITH CHECK (sebayat_id = auth.uid());

CREATE POLICY "Sebayat can delete own id documents"
  ON identity_documents FOR DELETE
  TO authenticated
  USING (sebayat_id = auth.uid());
