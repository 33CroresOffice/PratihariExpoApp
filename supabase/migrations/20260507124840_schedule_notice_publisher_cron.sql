/*
  # Schedule Notice Publisher Cron Job

  ## Summary
  Creates a pg_cron job that runs every minute to automatically publish
  notices whose scheduled_publish_at time has arrived. When a notice
  is published, it also fires the send-notification edge function so
  users receive their notifications at the configured time.

  ## What it does
  1. Enables pg_cron and pg_net extensions (idempotent)
  2. Creates a helper function `publish_scheduled_notices()` that:
     - Finds all notices where scheduled_publish_at <= now() and is_published = false
     - Sets is_published = true, published_at = now()
     - Calls the send-notification edge function for each published notice
  3. Schedules the cron job to run every minute

  ## Notes
  - The send-notification call uses the service role key stored in app settings
  - If SUPABASE_URL / service key not available, the HTTP call is skipped gracefully
  - The cron job is named 'publish-scheduled-notices' for easy identification
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================
-- Helper function: publish scheduled notices
-- ============================================================
CREATE OR REPLACE FUNCTION publish_scheduled_notices()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notice    record;
  v_url       text;
  v_auth      text;
BEGIN
  v_url  := current_setting('app.supabase_url',      true);
  v_auth := current_setting('app.service_role_key',  true);

  FOR v_notice IN
    SELECT id, title, body, target_type, target_ids, channels, notify_at
    FROM   notices
    WHERE  is_published       = false
      AND  scheduled_publish_at IS NOT NULL
      AND  scheduled_publish_at <= now()
  LOOP
    -- Mark as published
    UPDATE notices
    SET    is_published  = true,
           published_at  = now(),
           updated_at    = now()
    WHERE  id = v_notice.id;

    -- Fire notification if URL and auth key are configured
    IF v_url IS NOT NULL AND v_auth IS NOT NULL THEN
      PERFORM net.http_post(
        url     := v_url || '/functions/v1/send-notification',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || v_auth,
          'apikey',        v_auth
        ),
        body    := jsonb_build_object(
          'event',            'notice_published',
          'recipient_type',   'all',
          'template_vars',    jsonb_build_object(
            'title',  v_notice.title,
            'body',   v_notice.body
          )
        )
      );
    END IF;
  END LOOP;
END;
$$;

-- Drop existing job if present, then reschedule
SELECT cron.unschedule(jobid)
FROM   cron.job
WHERE  jobname = 'publish-scheduled-notices';

-- Run every minute
SELECT cron.schedule(
  'publish-scheduled-notices',
  '* * * * *',
  $$ SELECT publish_scheduled_notices(); $$
);
