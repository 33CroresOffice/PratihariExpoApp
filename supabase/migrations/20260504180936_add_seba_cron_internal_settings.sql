/*
  # Internal settings for seba reminder cron

  Creates a private table to hold the Supabase URL + service role key that
  pg_cron uses to invoke the Edge Function. Only service_role can read/write;
  regular users cannot see the key.
*/

CREATE TABLE IF NOT EXISTS _seba_cron_settings (
  id         integer PRIMARY KEY DEFAULT 1,
  supabase_url text NOT NULL DEFAULT '',
  service_role_key text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT _seba_cron_settings_single_row CHECK (id = 1)
);

ALTER TABLE _seba_cron_settings ENABLE ROW LEVEL SECURITY;

-- No policies: only service_role bypasses RLS; regular users cannot read.

INSERT INTO _seba_cron_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Admin-callable function to set cron settings (one-time wire up)
CREATE OR REPLACE FUNCTION set_seba_cron_credentials(p_url text, p_service_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'admin_only';
  END IF;
  UPDATE _seba_cron_settings
    SET supabase_url = p_url, service_role_key = p_service_key, updated_at = now()
    WHERE id = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION set_seba_cron_credentials(text, text) TO authenticated;

-- Rewrite reschedule_seba_reminder_jobs to read creds from this table
CREATE OR REPLACE FUNCTION reschedule_seba_reminder_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config       record;
  v_creds        record;
  v_evening_h    int;
  v_evening_m    int;
  v_morning_h    int;
  v_morning_m    int;
  v_evening_cron text;
  v_morning_cron text;
  v_body_evening text;
  v_body_morning text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  SELECT * INTO v_config FROM seba_notification_config WHERE id = 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'config_missing'; END IF;

  SELECT * INTO v_creds FROM _seba_cron_settings WHERE id = 1;
  IF NOT FOUND OR v_creds.supabase_url = '' OR v_creds.service_role_key = '' THEN
    RAISE EXCEPTION 'cron_credentials_missing';
  END IF;

  -- Unschedule existing jobs
  PERFORM cron.unschedule(jobid) FROM cron.job
    WHERE jobname IN ('seba-reminder-evening', 'seba-reminder-morning');

  -- Convert IST to UTC (subtract 5h30m)
  v_evening_h := EXTRACT(HOUR   FROM v_config.evening_reminder_time)::int;
  v_evening_m := EXTRACT(MINUTE FROM v_config.evening_reminder_time)::int;
  v_morning_h := EXTRACT(HOUR   FROM v_config.morning_reminder_time)::int;
  v_morning_m := EXTRACT(MINUTE FROM v_config.morning_reminder_time)::int;

  v_evening_m := v_evening_m - 30;
  IF v_evening_m < 0 THEN v_evening_m := v_evening_m + 60; v_evening_h := v_evening_h - 1; END IF;
  v_evening_h := v_evening_h - 5;
  IF v_evening_h < 0 THEN v_evening_h := v_evening_h + 24; END IF;

  v_morning_m := v_morning_m - 30;
  IF v_morning_m < 0 THEN v_morning_m := v_morning_m + 60; v_morning_h := v_morning_h - 1; END IF;
  v_morning_h := v_morning_h - 5;
  IF v_morning_h < 0 THEN v_morning_h := v_morning_h + 24; END IF;

  v_evening_cron := v_evening_m || ' ' || v_evening_h || ' * * *';
  v_morning_cron := v_morning_m || ' ' || v_morning_h || ' * * *';

  v_body_evening := '{"mode":"evening"}';
  v_body_morning := '{"mode":"morning"}';

  PERFORM cron.schedule(
    'seba-reminder-evening',
    v_evening_cron,
    format($sql$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || %L,'apikey', %L),
        body := %L::jsonb
      );
    $sql$, v_creds.supabase_url || '/functions/v1/seba-reminders', v_creds.service_role_key, v_creds.service_role_key, v_body_evening)
  );

  PERFORM cron.schedule(
    'seba-reminder-morning',
    v_morning_cron,
    format($sql$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || %L,'apikey', %L),
        body := %L::jsonb
      );
    $sql$, v_creds.supabase_url || '/functions/v1/seba-reminders', v_creds.service_role_key, v_creds.service_role_key, v_body_morning)
  );
END;
$$;
