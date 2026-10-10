-- Migration 036: Granular Notification Preferences & Enhanced Push Dispatch
-- Creates public.notification_preferences table with default preferences and connects with push notifications.

-- 1. Create notification_preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id                UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  push_enabled           BOOLEAN NOT NULL DEFAULT TRUE,
  comments_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  mentions_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  direct_messages_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  whispers_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  likes_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  followers_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  community_announcements_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can view own notification preferences"
ON public.notification_preferences FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can insert own notification preferences"
ON public.notification_preferences FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can update own notification preferences"
ON public.notification_preferences FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. Auto-create default notification preferences when a profile is created
CREATE OR REPLACE FUNCTION public.create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_create_default_notification_preferences ON public.profiles;
CREATE TRIGGER trg_create_default_notification_preferences
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_notification_preferences();

-- Backfill existing profiles
INSERT INTO public.notification_preferences (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- Ensure users can update their push tokens during upsert
DROP POLICY IF EXISTS "Users can update own push tokens" ON public.user_push_tokens;
CREATE POLICY "Users can update own push tokens"
ON public.user_push_tokens FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Update send_expo_push_notification to respect user preferences
CREATE OR REPLACE FUNCTION public.send_expo_push_notification()
RETURNS TRIGGER AS $fn$
DECLARE
  token_record RECORD;
  payload JSONB;
  prefs RECORD;
  should_send BOOLEAN := TRUE;
BEGIN
  -- Fetch recipient's notification preferences
  SELECT * INTO prefs
  FROM public.notification_preferences
  WHERE user_id = NEW.user_id;

  IF FOUND THEN
    -- If push is globally disabled for user, abort dispatch
    IF prefs.push_enabled = FALSE THEN
      RETURN NEW;
    END IF;

    -- Evaluate category-specific push preference
    IF NEW.type = 'comment' AND prefs.comments_enabled = FALSE THEN
      should_send := FALSE;
    ELSIF NEW.type = 'mention' AND prefs.mentions_enabled = FALSE THEN
      should_send := FALSE;
    ELSIF NEW.type = 'message' AND prefs.direct_messages_enabled = FALSE THEN
      should_send := FALSE;
    ELSIF NEW.type = 'whisper' AND prefs.whispers_enabled = FALSE THEN
      should_send := FALSE;
    ELSIF NEW.type = 'like' AND prefs.likes_enabled = FALSE THEN
      should_send := FALSE;
    ELSIF NEW.type = 'follow' AND prefs.followers_enabled = FALSE THEN
      should_send := FALSE;
    ELSIF NEW.type = 'community_activity' AND prefs.community_announcements_enabled = FALSE THEN
      should_send := FALSE;
    END IF;
  END IF;

  IF should_send = FALSE THEN
    RETURN NEW;
  END IF;

  -- Dispatch to all registered push tokens for the recipient
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
      -- Silently skip if pg_net is unavailable in the environment
      NULL;
    END;
  END LOOP;

  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Re-bind the push notification trigger to public.notifications
DROP TRIGGER IF EXISTS trg_send_expo_push_notification ON public.notifications;
CREATE TRIGGER trg_send_expo_push_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.send_expo_push_notification();

-- 6. Enhance comment notifications to support parent comment replies
CREATE OR REPLACE FUNCTION public.handle_new_comment_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_post_author_id UUID;
  v_parent_author_id UUID;
  v_commenter_name TEXT;
BEGIN
  -- Get post author
  SELECT author_id INTO v_post_author_id
  FROM public.posts
  WHERE id = NEW.post_id;

  -- Get parent comment author if this is a nested reply
  IF NEW.parent_id IS NOT NULL THEN
    SELECT author_id INTO v_parent_author_id
    FROM public.comments
    WHERE id = NEW.parent_id;
  END IF;

  SELECT COALESCE(display_name, username, 'Someone') INTO v_commenter_name
  FROM public.profiles
  WHERE id = NEW.author_id;

  -- If it's a reply to another user's comment, notify the parent comment author
  IF v_parent_author_id IS NOT NULL AND v_parent_author_id <> NEW.author_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, title, body, target_url, is_read)
    VALUES (
      v_parent_author_id,
      NEW.author_id,
      'comment'::notification_type,
      'New Reply to Your Comment',
      v_commenter_name || ' replied to your comment: "' || LEFT(NEW.content, 60) || '"',
      '/feed',
      FALSE
    );
  END IF;

  -- Also notify post author if they are not the commenter and not the parent comment author (to avoid duplicate notifications)
  IF v_post_author_id IS NOT NULL 
     AND v_post_author_id <> NEW.author_id 
     AND (v_parent_author_id IS NULL OR v_post_author_id <> v_parent_author_id) THEN
    INSERT INTO public.notifications (user_id, actor_id, type, title, body, target_url, is_read)
    VALUES (
      v_post_author_id,
      NEW.author_id,
      'comment'::notification_type,
      'New Comment on Your Post',
      v_commenter_name || ' commented: "' || LEFT(NEW.content, 60) || '"',
      '/feed',
      FALSE
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_comment ON public.comments;
CREATE TRIGGER trg_notify_on_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_comment_notification();

