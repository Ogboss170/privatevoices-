-- ============================================================
-- Private Voices — Migration 010: Automated Mentions Notifications
-- ============================================================

-- 1. Trigger for Mentions in Posts
CREATE OR REPLACE FUNCTION public.handle_new_post_mentions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mentioned_username TEXT;
  v_mentioned_id UUID;
  v_author_name TEXT;
BEGIN
  SELECT COALESCE(display_name, username, 'Someone') INTO v_author_name
  FROM public.profiles
  WHERE id = NEW.author_id;

  FOR v_mentioned_username IN
    SELECT DISTINCT LOWER(m[1])
    FROM regexp_matches(NEW.content, '@([a-zA-Z0-9_]{1,30})', 'g') AS m
  LOOP
    SELECT id INTO v_mentioned_id
    FROM public.profiles
    WHERE LOWER(username) = v_mentioned_username;

    IF v_mentioned_id IS NOT NULL AND v_mentioned_id <> NEW.author_id THEN
      INSERT INTO public.notifications (user_id, actor_id, type, title, body, target_url, is_read)
      VALUES (
        v_mentioned_id,
        NEW.author_id,
        'mention'::notification_type,
        'You were mentioned in a Voice',
        v_author_name || ' mentioned you in a Voice: "' || LEFT(NEW.content, 60) || '"',
        '/feed',
        FALSE
      );
    END IF;
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_post_mention ON public.posts;
CREATE TRIGGER trg_notify_on_post_mention
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_post_mentions();

-- 2. Trigger for Mentions in Comments
CREATE OR REPLACE FUNCTION public.handle_new_comment_mentions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mentioned_username TEXT;
  v_mentioned_id UUID;
  v_author_name TEXT;
BEGIN
  SELECT COALESCE(display_name, username, 'Someone') INTO v_author_name
  FROM public.profiles
  WHERE id = NEW.author_id;

  FOR v_mentioned_username IN
    SELECT DISTINCT LOWER(m[1])
    FROM regexp_matches(NEW.content, '@([a-zA-Z0-9_]{1,30})', 'g') AS m
  LOOP
    SELECT id INTO v_mentioned_id
    FROM public.profiles
    WHERE LOWER(username) = v_mentioned_username;

    IF v_mentioned_id IS NOT NULL AND v_mentioned_id <> NEW.author_id THEN
      INSERT INTO public.notifications (user_id, actor_id, type, title, body, target_url, is_read)
      VALUES (
        v_mentioned_id,
        NEW.author_id,
        'mention'::notification_type,
        'You were mentioned in a Comment',
        v_author_name || ' mentioned you in a comment: "' || LEFT(NEW.content, 60) || '"',
        '/feed',
        FALSE
      );
    END IF;
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_comment_mention ON public.comments;
CREATE TRIGGER trg_notify_on_comment_mention
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_comment_mentions();
