/*
  # Update Cron Scheduling for Multi-Stage Beddha Reminders

  ## Summary
  Rewrites reschedule_seba_reminder_jobs() to schedule four daily cron jobs:
  - seba-reminder-5day: 8 PM IST — offset_days=5
  - seba-reminder-3day: 8 PM IST — offset_days=3
  - seba-reminder-1day: 8 PM IST — offset_days=1
  - seba-reminder-dayof: 4 AM IST — offset_days=0

  ## Important Notes
  1. Old "seba-reminder-evening" and "seba-reminder-morning" jobs are unscheduled.
  2. Each new job calls seba-reminders with a JSON body containing offset_days.
  3. Admins can change times in seba_notification_config and call reschedule_seba_reminder_jobs().
*/

CREATE OR REPLACE FUNCTION reschedule_seba_reminder_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config       record;
  v_creds        record;
  v_5day_h       int;
  v_5day_m       int;
  v_3day_h       int;
  v_3day_m       int;
  v_1day_h       int;
  v_1day_m       int;
  v_dayof_h      int;
  v_dayof_m      int;
  v_body_5day    text;
  v_body_3day    text;
  v_body_1day    text;
  v_body_dayof   text;
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

  -- Unschedule ALL existing reminder jobs
  PERFORM cron.unschedule(jobid) FROM cron.job
    WHERE jobname IN (
      'seba-reminder-evening',
      'seba-reminder-morning',
      'seba-reminder-5day',
      'seba-reminder-3day',
      'seba-reminder-1day',
      'seba-reminder-dayof'
    );

  -- Extract IST times
  v_5day_h  := EXTRACT(HOUR   FROM v_config.five_day_reminder_time)::int;
  v_5day_m  := EXTRACT(MINUTE FROM v_config.five_day_reminder_time)::int;
  v_3day_h  := EXTRACT(HOUR   FROM v_config.three_day_reminder_time)::int;
  v_3day_m  := EXTRACT(MINUTE FROM v_config.three_day_reminder_time)::int;
  v_1day_h  := EXTRACT(HOUR   FROM v_config.one_day_reminder_time)::int;
  v_1day_m  := EXTRACT(MINUTE FROM v_config.one_day_reminder_time)::int;
  v_dayof_h := EXTRACT(HOUR   FROM v_config.morning_reminder_time)::int;
  v_dayof_m := EXTRACT(MINUTE FROM v_config.morning_reminder_time)::int;

  -- Convert IST to UTC for each stage (subtract 5h30m)
  v_5day_m := v_5day_m - 30;
  IF v_5day_m < 0 THEN v_5day_m := v_5day_m + 60; v_5day_h := v_5day_h - 1; END IF;
  v_5day_h := v_5day_h - 5;
  IF v_5day_h < 0 THEN v_5day_h := v_5day_h + 24; END IF;

  v_3day_m := v_3day_m - 30;
  IF v_3day_m < 0 THEN v_3day_m := v_3day_m + 60; v_3day_h := v_3day_h - 1; END IF;
  v_3day_h := v_3day_h - 5;
  IF v_3day_h < 0 THEN v_3day_h := v_3day_h + 24; END IF;

  v_1day_m := v_1day_m - 30;
  IF v_1day_m < 0 THEN v_1day_m := v_1day_m + 60; v_1day_h := v_1day_h - 1; END IF;
  v_1day_h := v_1day_h - 5;
  IF v_1day_h < 0 THEN v_1day_h := v_1day_h + 24; END IF;

  v_dayof_m := v_dayof_m - 30;
  IF v_dayof_m < 0 THEN v_dayof_m := v_dayof_m + 60; v_dayof_h := v_dayof_h - 1; END IF;
  v_dayof_h := v_dayof_h - 5;
  IF v_dayof_h < 0 THEN v_dayof_h := v_dayof_h + 24; END IF;

  v_body_5day  := '{"offset_days":5}';
  v_body_3day  := '{"offset_days":3}';
  v_body_1day  := '{"offset_days":1}';
  v_body_dayof := '{"offset_days":0}';

  -- 5-day reminder
  PERFORM cron.schedule(
    'seba-reminder-5day',
    v_5day_m || ' ' || v_5day_h || ' * * *',
    format($sql$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || %L,'apikey', %L),
        body := %L::jsonb
      );
    $sql$, v_creds.supabase_url || '/functions/v1/seba-reminders', v_creds.service_role_key, v_creds.service_role_key, v_body_5day)
  );

  -- 3-day reminder
  PERFORM cron.schedule(
    'seba-reminder-3day',
    v_3day_m || ' ' || v_3day_h || ' * * *',
    format($sql$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || %L,'apikey', %L),
        body := %L::jsonb
      );
    $sql$, v_creds.supabase_url || '/functions/v1/seba-reminders', v_creds.service_role_key, v_creds.service_role_key, v_body_3day)
  );

  -- 1-day reminder
  PERFORM cron.schedule(
    'seba-reminder-1day',
    v_1day_m || ' ' || v_1day_h || ' * * *',
    format($sql$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || %L,'apikey', %L),
        body := %L::jsonb
      );
    $sql$, v_creds.supabase_url || '/functions/v1/seba-reminders', v_creds.service_role_key, v_creds.service_role_key, v_body_1day)
  );

  -- Day-of reminder
  PERFORM cron.schedule(
    'seba-reminder-dayof',
    v_dayof_m || ' ' || v_dayof_h || ' * * *',
    format($sql$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || %L,'apikey', %L),
        body := %L::jsonb
      );
    $sql$, v_creds.supabase_url || '/functions/v1/seba-reminders', v_creds.service_role_key, v_creds.service_role_key, v_body_dayof)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION reschedule_seba_reminder_jobs() TO authenticated;