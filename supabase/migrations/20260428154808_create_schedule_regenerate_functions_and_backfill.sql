/*
  # Schedule regeneration functions + initial backfill

  ## Summary
  Adds the procedural pieces needed to populate and maintain the schedule and
  roster ledgers, then runs an initial backfill for the rolling window.

  ## New Functions
  - `regenerate_schedule(p_group_id uuid, p_through_date date)`
    Inserts missing seba_schedule rows from the group's anchor date through
    p_through_date. Existing rows are left alone (past data is immutable; future
    rows already match the formula by construction).
  - `regenerate_roster_for_sebayat(p_sebayat_id uuid)`
    Rebuilds the seba_roster rows for this sebayat from CURRENT_DATE forward.
    Past rows are protected by trigger and left untouched.
  - `regenerate_all_future_roster()`
    Convenience: rebuild future rosters for every sebayat. Used after schedule
    extension or anchor changes.

  ## Backfill
  Generates schedule rows from each group's anchor through today + 5 years and
  rebuilds the future roster for every sebayat using their current selections.

  ## Notes
  Roster regeneration touches only future-dated schedule rows, so it is always
  safe to call. The freeze trigger guarantees correctness even if a developer
  passes a wider window by mistake.
*/

CREATE OR REPLACE FUNCTION regenerate_schedule(p_group_id uuid, p_through_date date)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_anchor_date date;
  v_anchor_beddha integer;
  v_count integer;
  d date;
  v_inserted integer := 0;
  v_beddha integer;
BEGIN
  SELECT anchor_date, anchor_beddha, beddha_count
    INTO v_anchor_date, v_anchor_beddha, v_count
  FROM seba_groups
  WHERE id = p_group_id;

  IF v_anchor_date IS NULL THEN
    RETURN 0;
  END IF;

  FOR d IN SELECT generate_series(v_anchor_date, p_through_date, INTERVAL '1 day')::date LOOP
    v_beddha := beddha_for_date(p_group_id, d);
    INSERT INTO seba_schedule (group_id, service_date, beddha_number)
    VALUES (p_group_id, d, v_beddha)
    ON CONFLICT (group_id, service_date) DO NOTHING;
    IF FOUND THEN
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  RETURN v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION regenerate_roster_for_sebayat(p_sebayat_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  -- Remove future, unfrozen roster entries for this sebayat to avoid duplicates
  DELETE FROM seba_roster r
  USING seba_schedule s
  WHERE r.schedule_id = s.id
    AND r.sebayat_id = p_sebayat_id
    AND s.service_date >= CURRENT_DATE;

  INSERT INTO seba_roster (schedule_id, sebayat_id, seba_category_id, beddha_number)
  SELECT s.id, sel.sebayat_id, sel.seba_category_id, sel.beddha_number
  FROM sebayat_seba_selections sel
  JOIN seba_categories cat ON cat.id = sel.seba_category_id
  JOIN seba_schedule s
    ON s.group_id = cat.group_id
   AND s.beddha_number = sel.beddha_number
   AND s.service_date >= CURRENT_DATE
  WHERE sel.sebayat_id = p_sebayat_id;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION regenerate_all_future_roster()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  s record;
  v_total integer := 0;
BEGIN
  FOR s IN SELECT id FROM sebayats LOOP
    v_total := v_total + regenerate_roster_for_sebayat(s.id);
  END LOOP;
  RETURN v_total;
END;
$$;

-- Initial backfill: schedule rows for each group through today + 5 years
DO $$
DECLARE
  g record;
BEGIN
  FOR g IN SELECT id FROM seba_groups LOOP
    PERFORM regenerate_schedule(g.id, (CURRENT_DATE + INTERVAL '5 years')::date);
  END LOOP;
END $$;

-- Initial roster rebuild for all sebayats
SELECT regenerate_all_future_roster();
