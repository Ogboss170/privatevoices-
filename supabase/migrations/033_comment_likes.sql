-- ==============================================================================
-- Migration 033: Comment Likes Support
-- Supports:
--  1. public.comment_likes table (user_id, comment_id, created_at)
--  2. RLS policies (Viewable by everyone, authenticated users can like/unlike)
--  3. Realtime notifications trigger on comment like (optional / non-blocking)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.comment_likes (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON public.comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id ON public.comment_likes(user_id);

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Comment likes are viewable by everyone" ON public.comment_likes;
CREATE POLICY "Comment likes are viewable by everyone"
  ON public.comment_likes FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Authenticated users can like comments" ON public.comment_likes;
CREATE POLICY "Authenticated users can like comments"
  ON public.comment_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unlike their own comment likes" ON public.comment_likes;
CREATE POLICY "Users can unlike their own comment likes"
  ON public.comment_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Optional notification trigger when a comment is liked
CREATE OR REPLACE FUNCTION public.handle_new_comment_like_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_comment_author_id UUID;
  v_post_id UUID;
  v_liker_name TEXT;
BEGIN
  -- Retrieve comment author and parent post_id
  SELECT author_id, post_id INTO v_comment_author_id, v_post_id
  FROM public.comments
  WHERE id = NEW.comment_id;

  -- Only notify if the liker is not the comment author
  IF v_comment_author_id IS NOT NULL AND v_comment_author_id <> NEW.user_id THEN
    SELECT COALESCE(display_name, username, 'Someone') INTO v_liker_name
    FROM public.profiles
    WHERE id = NEW.user_id;

    INSERT INTO public.notifications (user_id, actor_id, type, title, body, target_url, is_read)
    VALUES (
      v_comment_author_id,
      NEW.user_id,
      'like'::notification_type,
      'New Comment Like',
      v_liker_name || ' liked your comment',
      '/feed',
      FALSE
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_comment_like ON public.comment_likes;
CREATE TRIGGER trg_notify_on_comment_like
  AFTER INSERT ON public.comment_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_comment_like_notification();
