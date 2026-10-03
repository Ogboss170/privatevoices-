-- Private Voices: 014_push_notifications.sql
-- Run in Supabase SQL Editor (project trwraypolgqhkrxlijql). Safe to re-run.
-- ============================================================
-- Private Voices — Migration 014: Expo Push Tokens & Delivery
-- ============================================================

-- 1. Push Tokens Table
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expo_push_token  TEXT NOT NULL,
  device_type      TEXT NOT NULL DEFAULT 'mobile',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, expo_push_token)
);

CREATE INDEX IF NOT EXISTS user_push_tokens_user_id_idx ON public.user_push_tokens(user_id);

-- 2. Row Level Security
ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own push tokens" ON public.user_push_tokens;
CREATE POLICY "Users can view own push tokens"
ON public.user_push_tokens FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can register own push tokens" ON public.user_push_tokens;
CREATE POLICY "Users can register own push tokens"
ON public.user_push_tokens FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own push tokens" ON public.user_push_tokens;
CREATE POLICY "Users can delete own push tokens"
ON public.user_push_tokens FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 3. Enable pg_net extension if available
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 4. Function & Trigger to automatically dispatch push notifications to Expo API
CREATE OR REPLACE FUNCTION public.send_expo_push_notification()
RETURNS TRIGGER AS $fn$
DECLARE
  token_record RECORD;
  payload JSONB;
BEGIN
  FOR token_record IN
    SELECT expo_push_token FROM public.user_push_tokens WHERE user_id = NEW.user_id
  LOOP
    payload := jsonb_build_object(
      'to', token_record.expo_push_token,
      'sound', 'default',
      'title', NEW.title,
      'body', COALESCE(NEW.body, 'New activity on Private Voices'),
      'data', jsonb_build_object(
        'notificationId', NEW.id,
        'targetUrl', NEW.target_url,
        'type', NEW.type
      )
    );

    BEGIN
      PERFORM net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
        body := payload
      );
    EXCEPTION WHEN OTHERS THEN
      -- Silently skip if pg_net is not active in current environment
      NULL;
    END;
  END LOOP;

  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_send_expo_push_notification ON public.notifications;
CREATE TRIGGER trg_send_expo_push_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.send_expo_push_notification();
