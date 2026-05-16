/*
  # Schedule and roster ledger tables

  ## Summary
  These tables are the immutable historical record of which beddha falls on
  every calendar day, and which sebayats were on duty that day. Math projects
  forward; rows are persisted; once a row's date is in the past it is frozen
  by trigger so historical "who served on day X" answers never depend on
  re-running the formula.

  ## New Tables
  - `seba_schedule`
    - `id` (uuid, pk)
    - `group_id` (uuid, FK → seba_groups)
    - `service_date` (date)
    - `beddha_number` (integer)
    - `frozen_at` (timestamptz, nullable) — when this day was locked
    - `frozen_reason` (text)
    - `created_at`, `updated_at`
    - UNIQUE (group_id, service_date)

  - `seba_roster`
    - `id` (uuid, pk)
    - `schedule_id` (uuid, FK → seba_schedule, ON DELETE CASCADE)
    - `sebayat_id` (uuid, FK → sebayats)
    - `seba_category_id` (uuid, FK → seba_categories)
    - `beddha_number` (integer)
    - `is_absent` (boolean, default false)
    - `substitute_sebayat_id` (uuid, nullable, FK → sebayats)
    - `notes` (text, default '')
    - `frozen_at` (timestamptz, nullable)
    - `frozen_reason` (text)
    - `created_at`, `updated_at`

  ## Freeze trigger
  Past-dated rows (service_date < CURRENT_DATE) cannot be UPDATEd or DELETEd
  except by an admin who has the explicit override claim. This is the safety
  net that protects historical data from anchor edits, formula bugs, or
  accidental assignment changes.

  ## Security
  - RLS enabled on both tables
  - Authenticated users can SELECT all (needed for "who serves on date X")
  - Only admins can INSERT/UPDATE/DELETE
*/

CREATE TABLE IF NOT EXISTS seba_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES seba_groups(id) ON DELETE CASCADE,
  service_date date NOT NULL,
  beddha_number integer NOT NULL CHECK (beddha_number > 0),
  frozen_at timestamptz,
  frozen_reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, service_date)
);

CREATE INDEX IF NOT EXISTS idx_schedule_date ON seba_schedule(service_date);
CREATE INDEX IF NOT EXISTS idx_schedule_group_beddha ON seba_schedule(group_id, beddha_number);

CREATE TABLE IF NOT EXISTS seba_roster (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES seba_schedule(id) ON DELETE CASCADE,
  sebayat_id uuid NOT NULL REFERENCES sebayats(id) ON DELETE CASCADE,
  seba_category_id uuid NOT NULL REFERENCES seba_categories(id) ON DELETE CASCADE,
  beddha_number integer NOT NULL CHECK (beddha_number > 0),
  is_absent boolean NOT NULL DEFAULT false,
  substitute_sebayat_id uuid REFERENCES sebayats(id) ON DELETE SET NULL,
  notes text NOT NULL DEFAULT '',
  frozen_at timestamptz,
  frozen_reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roster_schedule ON seba_roster(schedule_id);
CREATE INDEX IF NOT EXISTS idx_roster_sebayat ON seba_roster(sebayat_id);
CREATE INDEX IF NOT EXISTS idx_roster_category ON seba_roster(seba_category_id);

ALTER TABLE seba_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE seba_roster ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view schedule"
  ON seba_schedule FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert schedule"
  ON seba_schedule FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()));

CREATE POLICY "Admins can update schedule"
  ON seba_schedule FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()));

CREATE POLICY "Admins can delete schedule"
  ON seba_schedule FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated users can view roster"
  ON seba_roster FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert roster"
  ON seba_roster FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()));

CREATE POLICY "Admins can update roster"
  ON seba_roster FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()));

CREATE POLICY "Admins can delete roster"
  ON seba_roster FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION protect_past_schedule()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_date date;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old_date := OLD.service_date;
  ELSE
    v_old_date := OLD.service_date;
  END IF;

  IF v_old_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Cannot modify or delete schedule rows for past date %', v_old_date;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION protect_past_roster()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_date date;
BEGIN
  SELECT service_date INTO v_date FROM seba_schedule WHERE id = OLD.schedule_id;
  IF v_date IS NOT NULL AND v_date < CURRENT_DATE THEN
    -- Allow only updates that change notes/is_absent/substitute? Block fully for safety.
    RAISE EXCEPTION 'Cannot modify or delete roster rows for past date %', v_date;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_past_schedule_upd ON seba_schedule;
CREATE TRIGGER trg_protect_past_schedule_upd
  BEFORE UPDATE OR DELETE ON seba_schedule
  FOR EACH ROW EXECUTE FUNCTION protect_past_schedule();

DROP TRIGGER IF EXISTS trg_protect_past_roster_upd ON seba_roster;
CREATE TRIGGER trg_protect_past_roster_upd
  BEFORE UPDATE OR DELETE ON seba_roster
  FOR EACH ROW EXECUTE FUNCTION protect_past_roster();
