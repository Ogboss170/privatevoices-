-- ============================================================
-- Private Voices — Migration 008: Automated In-App Notifications
-- Triggers for Whispers, Messages, Follows, Likes, and Comments
-- ============================================================

-- 1. Enable RLS and establish comprehensive policies
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- 2. Trigger: Whisper Notifications (Actor remains 100% anonymous)
CREATE OR REPLACE FUNCTION public.handle_new_whisper_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, actor_id, type, title, body, target_url, is_read)
  VALUES (
    NEW.recipient_id,
    NULL, -- Keep sender anonymous
    'whisper'::notification_type,
    'New Anonymous Whisper',
    'Someone sent you an anonymous whisper: "' || LEFT(NEW.content, 60) || '"',
    '/inbox',
    FALSE
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_whisper ON public.whispers;
CREATE TRIGGER trg_notify_on_whisper
  AFTER INSERT ON public.whispers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_whisper_notification();

-- 3. Trigger: 1-on-1 Direct Message Notifications
CREATE OR REPLACE FUNCTION public.handle_new_message_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recipient_id UUID;
  v_sender_name TEXT;
BEGIN
  -- Identify the partner recipient in the conversation
  SELECT 
    CASE 
      WHEN user_a_id = NEW.sender_id THEN user_b_id 
      ELSE user_a_id 
    END INTO v_recipient_id
  FROM public.conversations
  WHERE id = NEW.conversation_id;

  SELECT COALESCE(display_name, username, 'Someone') INTO v_sender_name
  FROM public.profiles
  WHERE id = NEW.sender_id;

  IF v_recipient_id IS NOT NULL AND v_recipient_id <> NEW.sender_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, title, body, target_url, is_read)
    VALUES (
      v_recipient_id,
      NEW.sender_id,
      'message'::notification_type,
      'New Direct Message',
      v_sender_name || ': "' || LEFT(NEW.content, 60) || '"',
      '/inbox?c=' || NEW.conversation_id,
      FALSE
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_message ON public.messages;
CREATE TRIGGER trg_notify_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_message_notification();

-- 4. Trigger: Follow Notifications
CREATE OR REPLACE FUNCTION public.handle_new_follow_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_follower_name TEXT;
BEGIN
  IF NEW.follower_id <> NEW.following_id THEN
    SELECT COALESCE(display_name, username, 'Someone') INTO v_follower_name
    FROM public.profiles
    WHERE id = NEW.follower_id;

    INSERT INTO public.notifications (user_id, actor_id, type, title, body, target_url, is_read)
    VALUES (
      NEW.following_id,
      NEW.follower_id,
      'follow'::notification_type,
      'New Follower',
      v_follower_name || ' started following you',
      '/profile',
      FALSE
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_follow ON public.follows;
CREATE TRIGGER trg_notify_on_follow
  AFTER INSERT ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_follow_notification();

-- 5. Trigger: Like Notifications
CREATE OR REPLACE FUNCTION public.handle_new_like_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_author_id UUID;
  v_liker_name TEXT;
BEGIN
  SELECT author_id INTO v_author_id
  FROM public.posts
  WHERE id = NEW.post_id;

  IF v_author_id IS NOT NULL AND v_author_id <> NEW.user_id THEN
    SELECT COALESCE(display_name, username, 'Someone') INTO v_liker_name
    FROM public.profiles
    WHERE id = NEW.user_id;

    INSERT INTO public.notifications (user_id, actor_id, type, title, body, target_url, is_read)
    VALUES (
      v_author_id,
      NEW.user_id,
      'like'::notification_type,
      'New Like',
      v_liker_name || ' liked your post',
      '/feed',
      FALSE
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_like ON public.likes;
CREATE TRIGGER trg_notify_on_like
  AFTER INSERT ON public.likes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_like_notification();

-- 6. Trigger: Comment Notifications
CREATE OR REPLACE FUNCTION public.handle_new_comment_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_author_id UUID;
  v_commenter_name TEXT;
BEGIN
  SELECT author_id INTO v_author_id
  FROM public.posts
  WHERE id = NEW.post_id;

  IF v_author_id IS NOT NULL AND v_author_id <> NEW.author_id THEN
    SELECT COALESCE(display_name, username, 'Someone') INTO v_commenter_name
    FROM public.profiles
    WHERE id = NEW.author_id;

    INSERT INTO public.notifications (user_id, actor_id, type, title, body, target_url, is_read)
    VALUES (
      v_author_id,
      NEW.author_id,
      'comment'::notification_type,
      'New Comment',
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

-- 7. Add notifications to Supabase Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
