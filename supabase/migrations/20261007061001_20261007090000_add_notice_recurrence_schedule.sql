/*
# Add recurring notice schedule support

1. New columns on `notices`
- `repeat_start_date` (date, nullable) — first calendar date on which a recurring notice may publish.
- `repeat_days` (jsonb, default []) — weekday numbers selected for weekly or custom schedules, using PostgreSQL day-of-week values 0 through 6 where Sunday is 0.

2. Existing columns used
- `repeat_enabled` continues to turn recurrence on or off.
- `repeat_frequency` now supports `daily`, `weekly`, `monthly`, and `custom`.
- `repeat_end_date` remains the optional last eligible date.
- `scheduled_publish_at` continues to provide the initial publish time and the time of day for later recurring publications.
- `last_repeated_at` prevents a notice from publishing more than once on the same calendar day.

3. Scheduler behavior
- The existing `publish_scheduled_notices()` function now handles both one-time and recurring notices.
- Daily notices publish on each eligible date.
- Weekly notices publish only on selected weekdays.
- Monthly notices publish on the same day number as the recurrence start date.
- Custom notices publish only on selected weekdays.
- Recurrence stops after `repeat_end_date` when one is provided.

4. Security and safety
- No new table or policy is introduced.
- Existing notice permissions remain unchanged.
- The migration is additive and idempotent; it does not remove or rename existing data.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notices' AND column_name = 'repeat_start_date'
  ) THEN
    ALTER TABLE public.notices ADD COLUMN repeat_start_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notices' AND column_name = 'repeat_days'
  ) THEN
    ALTER TABLE public.notices ADD COLUMN repeat_days jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

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
  v_current_dow text;
BEGIN
  v_url := current_setting('app.supabase_url', true);
  v_auth := current_setting('app.service_role_key', true);
  v_current_dow := extract(dow FROM current_date)::text;

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
      AND repeat_start_date <= current_date
      AND (repeat_end_date IS NULL OR repeat_end_date >= current_date)
      AND (last_repeated_at IS NULL OR last_repeated_at::date < current_date)
      AND current_time >= (scheduled_publish_at AT TIME ZONE 'Asia/Kolkata')::time
    )
  LOOP
    v_is_due := false;

    IF v_notice.is_published = false THEN
      v_is_due := true;
    ELSIF v_notice.repeat_frequency = 'daily' THEN
      v_is_due := true;
    ELSIF v_notice.repeat_frequency = 'monthly' THEN
      v_is_due := extract(day FROM current_date) = extract(day FROM v_notice.repeat_start_date);
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
