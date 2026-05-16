/*
  # Create notice_reads table

  Tracks which sebayats have read which notices for per-user unread state
  and future delivery analytics.

  1. New Table: notice_reads
    - `id` (uuid, primary key)
    - `notice_id` (uuid, FK → notices) — the notice that was read
    - `sebayat_id` (uuid, FK → sebayats) — the sebayat who read it
    - `read_at` (timestamptz) — when it was first read
    - Unique constraint on (notice_id, sebayat_id) — one row per user per notice

  2. Security
    - Enable RLS
    - Authenticated users can insert/read their own read records
    - Admins can read all records (for delivery analytics)
*/

CREATE TABLE IF NOT EXISTS notice_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id uuid NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  sebayat_id uuid NOT NULL REFERENCES sebayats(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(notice_id, sebayat_id)
);

ALTER TABLE notice_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sebayats can insert own read records"
  ON notice_reads FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sebayats
      WHERE sebayats.id = notice_reads.sebayat_id
        AND sebayats.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Sebayats can read own read records"
  ON notice_reads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sebayats
      WHERE sebayats.id = notice_reads.sebayat_id
        AND sebayats.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all notice reads"
  ON notice_reads FOR SELECT
  TO authenticated
  USING (public.is_pratihari_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_notice_reads_sebayat ON notice_reads(sebayat_id);
CREATE INDEX IF NOT EXISTS idx_notice_reads_notice ON notice_reads(notice_id);
