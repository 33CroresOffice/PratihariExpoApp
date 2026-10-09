/*
# Fix recurring notice time-zone handling

1. Modified database function
- Updates `publish_scheduled_notices()` so recurrence dates and times are evaluated in Asia/Kolkata time.

2. Behavior
- Daily, weekly, monthly, and custom recurring notices use the same local calendar and clock that administrators see in the dashboard.
- Existing one-time scheduled notices continue to use their stored timestamp.

3. Safety
- No tables, columns, rows, or policies are removed.
- The function remains an existing security-definer scheduler and keeps its current notification behavior.
*/

CREATE OR REPLACE FUNCTION public.publish_scheduled_notices()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notice record;
  v_url text;
  v_auth text;
  v_is_due boolean;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_now_time time := (now() AT TIME ZONE 'Asia/Kolkata')::time;
  v_current_dow text;
BEGIN
  v_url := current_setting('app.supabase_url', true);
  v_auth := current_setting('app.service_role_key', true);
  v_current_dow := extract(dow FROM v_today)::text;

  FOR v_notice IN
    SELECT id, title, body, target_type, target_ids, channels, notify_at,
           repeat_enabled, repeat_frequency, repeat_start_date, repeat_end_date,
           repeat_days, scheduled_publish_at, last_repeated_at, is_published
    FROM public.notices
    WHERE (
      is_published = false
      AND scheduled_publish_at IS NOT NULL
      AND scheduled_publish_at <= now()
    )
    OR (
      is_published = true
      AND repeat_enabled = true
      AND scheduled_publish_at IS NOT NULL
      AND repeat_start_date IS NOT NULL
      AND repeat_start_date <= v_today
      AND (repeat_end_date IS NULL OR repeat_end_date >= v_today)
      AND (last_repeated_at IS NULL OR (last_repeated_at AT TIME ZONE 'Asia/Kolkata')::date < v_today)
      AND v_now_time >= (scheduled_publish_at AT TIME ZONE 'Asia/Kolkata')::time
    )
  LOOP
    v_is_due := false;

    IF v_notice.is_published = false THEN
      v_is_due := true;
    ELSIF v_notice.repeat_frequency = 'daily' THEN
      v_is_due := true;
    ELSIF v_notice.repeat_frequency = 'monthly' THEN
      v_is_due := extract(day FROM v_today) = extract(day FROM v_notice.repeat_start_date);
    ELSIF v_notice.repeat_frequency IN ('weekly', 'custom') THEN
      v_is_due := COALESCE(v_notice.repeat_days ? v_current_dow, false);
    END IF;

    IF NOT v_is_due THEN
      CONTINUE;
    END IF;

    UPDATE public.notices
    SET is_published = true,
        published_at = now(),
        last_repeated_at = CASE WHEN repeat_enabled THEN now() ELSE last_repeated_at END,
        updated_at = now()
    WHERE id = v_notice.id;

    IF v_url IS NOT NULL AND v_auth IS NOT NULL THEN
      PERFORM net.http_post(
        url := v_url || '/functions/v1/send-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_auth,
          'apikey', v_auth
        ),
        body := jsonb_build_object(
          'event', 'notice_published',
          'recipient_type', COALESCE(v_notice.target_type, 'all'),
          'template_vars', jsonb_build_object(
            'title', v_notice.title,
            'body', v_notice.body
          )
        )
      );
    END IF;
  END LOOP;
END;
$$;
