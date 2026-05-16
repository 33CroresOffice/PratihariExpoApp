/*
  # Anchor history audit + beddha math helper functions

  ## Summary
  Adds an audit table for every anchor change made to a seba_group, plus
  pure SQL helper functions used by the schedule generator and any read paths
  that need on-the-fly math (e.g., reconciliation reports).

  ## New Tables
  - `seba_group_anchor_history`
    - `id` (uuid, pk)
    - `group_id` (uuid, FK → seba_groups)
    - `old_anchor_date` (date)
    - `new_anchor_date` (date)
    - `old_anchor_beddha` (integer)
    - `new_anchor_beddha` (integer)
    - `changed_by` (uuid, FK → auth.users)
    - `reason` (text)
    - `changed_at` (timestamptz, default now())

  ## New Functions
  - `beddha_for_date(p_group_id uuid, p_date date) RETURNS integer`
    Pure forward formula: returns the 1-based beddha number for the given date
    using the group's stored anchor.
  - `dates_for_beddha(p_group_id uuid, p_beddha integer, p_from date, p_to date) RETURNS SETOF date`
    Returns every calendar date in [from, to] that maps to the requested beddha.

  ## Security
  - RLS enabled on the audit table
  - Admins can read all rows; only admins can insert
*/

CREATE TABLE IF NOT EXISTS seba_group_anchor_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES seba_groups(id) ON DELETE CASCADE,
  old_anchor_date date,
  new_anchor_date date NOT NULL,
  old_anchor_beddha integer,
  new_anchor_beddha integer NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  reason text NOT NULL DEFAULT '',
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anchor_history_group ON seba_group_anchor_history(group_id);

ALTER TABLE seba_group_anchor_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view anchor history"
  ON seba_group_anchor_history FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()));

CREATE POLICY "Admins can insert anchor history"
  ON seba_group_anchor_history FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION beddha_for_date(p_group_id uuid, p_date date)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_anchor_date date;
  v_anchor_beddha integer;
  v_count integer;
  v_diff integer;
  v_offset integer;
BEGIN
  SELECT anchor_date, anchor_beddha, beddha_count
    INTO v_anchor_date, v_anchor_beddha, v_count
  FROM seba_groups
  WHERE id = p_group_id;

  IF v_anchor_date IS NULL THEN
    RETURN NULL;
  END IF;

  v_diff := p_date - v_anchor_date;
  v_offset := ((v_diff + (v_anchor_beddha - 1)) % v_count + v_count) % v_count;
  RETURN v_offset + 1;
END;
$$;

CREATE OR REPLACE FUNCTION dates_for_beddha(
  p_group_id uuid,
  p_beddha integer,
  p_from date,
  p_to date
) RETURNS SETOF date
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  d date;
BEGIN
  FOR d IN SELECT generate_series(p_from, p_to, INTERVAL '1 day')::date LOOP
    IF beddha_for_date(p_group_id, d) = p_beddha THEN
      RETURN NEXT d;
    END IF;
  END LOOP;
END;
$$;
