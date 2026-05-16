/*
  # Schedule Seba Reminder Cron Jobs

  ## Summary
  Configures pg_cron + pg_net extensions and schedules two daily jobs
  that invoke the seba-reminders Edge Function at the configured times.

  ## Jobs
  - seba-reminder-evening: daily at 12:30 UTC (18:00 IST) in evening mode
  - seba-reminder-morning: daily at 00:30 UTC (06:00 IST) in morning mode

  ## Helper Function
  reschedule_seba_reminder_jobs() — admin-callable function that rewrites
  both cron schedules based on the current values in seba_notification_config.
  Converts IST times to UTC for cron and uses pg_net.http_post to call the
  edge function.
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant usage so authenticated admins can trigger the reschedule helper
GRANT USAGE ON SCHEMA cron TO postgres;

-- ============================================================
-- Helper: reschedule both reminder cron jobs from current config
-- ============================================================
CREATE OR REPLACE FUNCTION reschedule_seba_reminder_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config    record;
  v_url       text;
  v_auth      text;
  v_evening_h int;
  v_evening_m int;
  v_morning_h int;
  v_morning_m int;
  v_evening_cron text;
  v_morning_cron text;
  v_body_evening text;
  v_body_morning text;
BEGIN
  -- Require admin
  IF NOT EXISTS (SELECT 1 FROM pratihari_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  SELECT * INTO v_config FROM seba_notification_config WHERE id = 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'config_missing';
  END IF;

  -- Project URL and service key from vault (fall back to env if not stored)
  v_url  := current_setting('app.supabase_url', true);
  v_auth := current_setting('app.service_role_key', true);

  -- Unschedule existing jobs if they exist
  PERFORM cron.unschedule(jobid) FROM cron.job
    WHERE jobname IN ('seba-reminder-evening', 'seba-reminder-morning');

  -- Convert IST (UTC+5:30) to UTC
  -- evening_time in IST minus 5h30m = UTC time
  v_evening_h := EXTRACT(HOUR   FROM v_config.evening_reminder_time)::int;
  v_evening_m := EXTRACT(MINUTE FROM v_config.evening_reminder_time)::int;
  v_morning_h := EXTRACT(HOUR   FROM v_config.morning_reminder_time)::int;
  v_morning_m := EXTRACT(MINUTE FROM v_config.morning_reminder_time)::int;

  -- Subtract 5h30m for UTC
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

  v_body_evening := $json${"mode":"evening"}$json$;
  v_body_morning := $json${"mode":"morning"}$json$;

  -- Schedule evening job
  PERFORM cron.schedule(
    'seba-reminder-evening',
    v_evening_cron,
    format($sql$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer ' || %L,
          'apikey', %L
        ),
        body := %L::jsonb
      );
    $sql$, v_url || '/functions/v1/seba-reminders', v_auth, v_auth, v_body_evening)
  );

  -- Schedule morning job
  PERFORM cron.schedule(
    'seba-reminder-morning',
    v_morning_cron,
    format($sql$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer ' || %L,
          'apikey', %L
        ),
        body := %L::jsonb
      );
    $sql$, v_url || '/functions/v1/seba-reminders', v_auth, v_auth, v_body_morning)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION reschedule_seba_reminder_jobs() TO authenticated;
