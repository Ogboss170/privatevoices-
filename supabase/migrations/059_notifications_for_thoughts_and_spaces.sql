-- ==============================================================================
-- Migration 059: Notifications for Daily Thoughts & Voice Space Stages
-- Supports:
-- 1. Automated trigger on public.prompt_comments:
--    - When a user reflects/replies on a prompt, notify authors of other comments in the thread
-- 2. Automated trigger on public.spaces:
--    - When a host goes live with a new Space, notify followers of that host
-- ==============================================================================

-- 1. Function & Trigger: Prompt Comment Reflection Notification
CREATE OR REPLACE FUNCTION public.notify_prompt_comment_subscribers()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_name TEXT;
  v_prompt_tag TEXT;
  v_prompt_text TEXT;
  v_recipient_id UUID;
BEGIN
  -- Determine display name (or masked persona)
  IF NEW.is_masked THEN
    v_actor_name := COALESCE(NEW.masked_persona, 'Masked Voice');
  ELSE
    SELECT COALESCE(display_name, username, 'Someone') INTO v_actor_name
    FROM public.profiles
    WHERE id = NEW.author_id;
  END IF;

  -- Get prompt info
  SELECT tag, prompt INTO v_prompt_tag, v_prompt_text
  FROM public.daily_thought_prompts
  WHERE id = NEW.prompt_id;

  -- Notify previous participants in this daily thought discussion (distinct, excluding the author)
  FOR v_recipient_id IN
    SELECT DISTINCT author_id
    FROM public.prompt_comments
    WHERE prompt_id = NEW.prompt_id
      AND author_id <> NEW.author_id
  LOOP
    INSERT INTO public.notifications (
      user_id,
      actor_id,
      type,
      title,
      body,
      target_url,
      is_read,
      created_at
    ) VALUES (
      v_recipient_id,
      NEW.author_id,
      'comment'::notification_type,
      'New Reflection on Thought of the Day',
      v_actor_name || ' shared a reflection on "' || LEFT(COALESCE(v_prompt_text, v_prompt_tag), 50) || '..."',
      '/journal#' || NEW.prompt_id,
      FALSE,
      NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_prompt_comment ON public.prompt_comments;
CREATE TRIGGER trg_notify_prompt_comment
  AFTER INSERT ON public.prompt_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_prompt_comment_subscribers();

-- 2. Function & Trigger: Space Live Notification to Followers
CREATE OR REPLACE FUNCTION public.notify_followers_space_live()
RETURNS TRIGGER AS $$
DECLARE
  v_host_name TEXT;
  v_follower_id UUID;
BEGIN
  -- Only trigger on new live space creation
  IF NEW.status = 'live' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status <> 'live')) THEN
    SELECT COALESCE(display_name, username, 'A member you follow') INTO v_host_name
    FROM public.profiles
    WHERE id = NEW.host_id;

    -- Notify all active followers of the host
    FOR v_follower_id IN
      SELECT follower_id
      FROM public.follows
      WHERE following_id = NEW.host_id
    LOOP
      INSERT INTO public.notifications (
        user_id,
        actor_id,
        type,
        title,
        body,
        target_url,
        is_read,
        created_at
      ) VALUES (
        v_follower_id,
        NEW.host_id,
        'community_activity'::notification_type,
        '🎙️ ' || v_host_name || ' is Live in Spaces',
        'Drop into "' || LEFT(NEW.title, 55) || '" to listen or request to speak with masked audio.',
        '/spaces?id=' || NEW.id,
        FALSE,
        NOW()
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_space_live ON public.spaces;
CREATE TRIGGER trg_notify_space_live
  AFTER INSERT OR UPDATE OF status ON public.spaces
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_followers_space_live();
