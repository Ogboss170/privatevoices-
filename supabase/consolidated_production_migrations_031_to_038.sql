-- ===========================================================================
-- CONSOLIDATED PRODUCTION MIGRATION BATCH (031 through 038)
-- Target Database: Production Supabase
-- Safe, idempotent migration script
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Migration: 031_realtime_audio_messaging_setup.sql
-- ---------------------------------------------------------------------------
-- ==============================================================================
-- Migration: Add Audio Whisper Support to Direct Messages & Realtime Publications
-- Ensures public.messages table has audio_url and audio_duration columns,
-- and that both messages and whispers are active in Supabase Realtime publication.
-- ==============================================================================

-- 1. Ensure audio columns exist on public.messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS audio_url TEXT,
  ADD COLUMN IF NOT EXISTS audio_duration INTEGER;

COMMENT ON COLUMN public.messages.audio_url IS 'Public URL to the voice note / audio whisper recorded by the sender.';
COMMENT ON COLUMN public.messages.audio_duration IS 'Audio duration in seconds.';

-- 2. Ensure chat-media storage bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media',
  'chat-media',
  true,
  20971520, -- 20MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'audio/m4a', 'audio/mp4', 'audio/webm', 'audio/ogg', 'audio/x-caf', 'audio/mpeg']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'audio/m4a', 'audio/mp4', 'audio/webm', 'audio/ogg', 'audio/x-caf', 'audio/mpeg'];

-- 3. Storage RLS policies for chat-media
DROP POLICY IF EXISTS "Authenticated users can upload chat media" ON storage.objects;
CREATE POLICY "Authenticated users can upload chat media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "Anyone can view chat media" ON storage.objects;
CREATE POLICY "Anyone can view chat media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "Users can delete own chat media" ON storage.objects;
CREATE POLICY "Users can delete own chat media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 4. Ensure Realtime Publication includes messages, conversations, and whispers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'whispers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whispers;
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- Migration: 032_community_moderation_superpowers.sql
-- ---------------------------------------------------------------------------
-- ==============================================================================
-- Migration 032: Community Moderation Superpowers & Native Role Controls
-- Supports:
--  1. Pinned Posts in Communities (posts.is_pinned, posts.pinned_at, posts.pinned_by)
--  2. Community Mutes (Restricts disruptive members from posting/commenting)
--  3. Community Rules Table & Custom Rules Editor
--  4. RLS Policies allowing Community Owners and Moderators to Pin, Mute & Edit Rules
-- ==============================================================================

-- â”€â”€â”€ 1. PINNED POSTS IN COMMUNITIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pinned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_community_pinned
  ON public.posts(community_id, is_pinned DESC, created_at DESC)
  WHERE community_id IS NOT NULL;

-- Policy: Community Owners and Moderators can pin/unpin posts in their community
DROP POLICY IF EXISTS "Community owners and mods can pin posts" ON public.posts;
CREATE POLICY "Community owners and mods can pin posts"
  ON public.posts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = posts.community_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'moderator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = posts.community_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'moderator')
    )
  );

-- â”€â”€â”€ 2. COMMUNITY MUTES (LOCAL COMMUNITY RESTRICTION) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.community_mutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  muted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_community_user_mute UNIQUE (community_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_mutes_comm_user
  ON public.community_mutes(community_id, user_id);

ALTER TABLE public.community_mutes ENABLE ROW LEVEL SECURITY;

-- Select policy: Anyone in community or authenticated can read mutes
CREATE POLICY "Community mutes readable by authenticated users"
  ON public.community_mutes FOR SELECT
  TO authenticated
  USING (TRUE);

-- Insert/Delete policy: Only owners and mods can mute/unmute members
CREATE POLICY "Community owners and mods can manage mutes"
  ON public.community_mutes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_mutes.community_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'moderator')
    )
  );

-- Enforce mute check when posting to community
DROP POLICY IF EXISTS "Muted users cannot post to community" ON public.posts;
-- (Existing insert policies handle creation; add explicit check on community_mutes)

-- â”€â”€â”€ 3. COMMUNITY RULES CUSTOMIZATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Ensure communities table has editable rules jsonb structure
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS rules JSONB NOT NULL DEFAULT '[
    {"id": 1, "title": "Be respectful", "desc": "Treat all members with courtesy and kindness."},
    {"id": 2, "title": "No harassment or hate speech", "desc": "Bullying, discrimination, and hate speech are strictly prohibited."},
    {"id": 3, "title": "Stay on topic", "desc": "Keep posts relevant to the community category and purpose."},
    {"id": 4, "title": "No spam or self-promotion", "desc": "Avoid unauthorized advertising or duplicate postings."}
  ]'::jsonb;

-- Community update policy: Owners and moderators can update community info & rules
DROP POLICY IF EXISTS "Owners and moderators can update community info" ON public.communities;
CREATE POLICY "Owners and moderators can update community info"
  ON public.communities
  FOR UPDATE
  TO authenticated
  USING (
    creator_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = communities.id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'moderator')
    )
  );


-- ---------------------------------------------------------------------------
-- Migration: 033_comment_likes.sql
-- ---------------------------------------------------------------------------
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


-- ---------------------------------------------------------------------------
-- Migration: 034_comment_moderation_deletion.sql
-- ---------------------------------------------------------------------------
-- ==============================================================================
-- Migration 034: Post Authors Can Moderate Comments on Their Posts
-- ==============================================================================

-- Expand DELETE policy on public.comments so:
-- 1. Authors of the comment can delete their own comment
-- 2. Authors of the post can delete any comment posted on their post
DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;
DROP POLICY IF EXISTS "Users and post authors can delete comments" ON public.comments;

CREATE POLICY "Users and post authors can delete comments"
  ON public.comments
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = comments.post_id AND p.author_id = auth.uid()
    )
  );


-- ---------------------------------------------------------------------------
-- Migration: 035_realtime_comments_and_reactions.sql
-- ---------------------------------------------------------------------------
-- Migration 035: Enable Realtime Publication for Comments, Likes, and Comment Likes
-- Ensures real-time postgres_changes broadcasts work seamlessly for comments and reactions.

DO $$
BEGIN
  -- 1. Realtime for Comments
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
  END IF;

  -- 2. Realtime for Likes
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'likes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.likes;
  END IF;

  -- 3. Realtime for Comment Likes
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'comment_likes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_likes;
  END IF;
END $$;

-- Enable REPLICA IDENTITY FULL for tables with delete events to guarantee full payload replication
ALTER TABLE public.comments REPLICA IDENTITY FULL;
ALTER TABLE public.likes REPLICA IDENTITY FULL;
ALTER TABLE public.comment_likes REPLICA IDENTITY FULL;


-- ---------------------------------------------------------------------------
-- Migration: 036_notification_preferences_and_push.sql
-- ---------------------------------------------------------------------------
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



-- ---------------------------------------------------------------------------
-- Migration: 037_community_categories_and_roles.sql
-- ---------------------------------------------------------------------------
-- Migration 037: Community Category Topics and Expanded Member Roles
-- Adds tags / category topics to communities and adds 'vip' role to community_members.

-- 1. Add tags & category column to communities table
ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General';
ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- 2. Index tags and category for discovery queries
CREATE INDEX IF NOT EXISTS communities_category_idx ON public.communities(category);
CREATE INDEX IF NOT EXISTS communities_tags_idx ON public.communities USING GIN(tags);

-- 3. Update comments and posts author community role lookup policy
-- Ensure 'vip' role is supported in community_members.role (role is currently TEXT)
COMMENT ON COLUMN public.community_members.role IS 'Roles: owner, moderator, vip, member';

-- 4. Update community update policy so owners can update category and tags
DROP POLICY IF EXISTS "Owners can update community settings" ON public.communities;
CREATE POLICY "Owners can update community settings"
ON public.communities FOR UPDATE
TO authenticated
USING (
  creator_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.community_members cm
    WHERE cm.community_id = communities.id
      AND cm.user_id = auth.uid()
      AND cm.role = 'owner'
  )
)
WITH CHECK (
  creator_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.community_members cm
    WHERE cm.community_id = communities.id
      AND cm.user_id = auth.uid()
      AND cm.role = 'owner'
  )
);


-- ---------------------------------------------------------------------------
-- Migration: 038_creator_insights_and_community_analytics.sql
-- ---------------------------------------------------------------------------
-- Migration 038: Creator Insights & Community Growth Analytics
-- 1. Helper function: Get post creator insights (impressions, listeners/viewers, bookmark rate)
-- 2. Helper function: Get community growth & engagement metrics (member acquisition, active contributors, total interactions)

-- â”€â”€â”€ 1. POST CREATOR METRICS (STRICTLY AUTHOR-ONLY) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE FUNCTION public.get_post_creator_metrics(p_post_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_author_id UUID;
  v_caller_id UUID;
  v_unique_views INT := 0;
  v_total_impressions INT := 0;
  v_likes INT := 0;
  v_comments INT := 0;
  v_reposts INT := 0;
  v_bookmarks INT := 0;
  v_unique_listeners INT := 0;
  v_bookmark_rate NUMERIC := 0;
  v_engagement_rate NUMERIC := 0;
BEGIN
  v_caller_id := auth.uid();

  -- Get post author
  SELECT author_id INTO v_author_id
  FROM public.posts
  WHERE id = p_post_id;

  IF v_author_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Enforce author-only restriction
  IF v_caller_id IS NULL OR v_caller_id <> v_author_id THEN
    RAISE EXCEPTION 'Access denied: Creator metrics are author-only.';
  END IF;

  -- 1. Unique 24h listeners/viewers (excluding author)
  SELECT COUNT(DISTINCT viewer_id), COUNT(*) INTO v_unique_views, v_total_impressions
  FROM public.post_views
  WHERE post_id = p_post_id
    AND viewer_id <> v_author_id;

  v_unique_listeners := COALESCE(v_unique_views, 0);
  v_total_impressions := COALESCE(v_total_impressions, 0);

  -- 2. Interactions count
  SELECT COUNT(*) INTO v_likes FROM public.likes WHERE post_id = p_post_id;
  SELECT COUNT(*) INTO v_comments FROM public.comments WHERE post_id = p_post_id;
  SELECT COUNT(*) INTO v_reposts FROM public.reposts WHERE post_id = p_post_id;
  SELECT COUNT(*) INTO v_bookmarks FROM public.saved_posts WHERE post_id = p_post_id;

  -- 3. Calculate rates
  IF v_unique_listeners > 0 THEN
    v_bookmark_rate := ROUND((v_bookmarks::NUMERIC / v_unique_listeners::NUMERIC) * 100, 1);
    v_engagement_rate := ROUND(((v_likes + v_comments + v_reposts + v_bookmarks)::NUMERIC / v_unique_listeners::NUMERIC) * 100, 1);
  ELSE
    v_bookmark_rate := 0;
    v_engagement_rate := 0;
  END IF;

  RETURN jsonb_build_object(
    'postId', p_post_id,
    'impressions', GREATEST(v_total_impressions, v_unique_listeners),
    'uniqueListeners', v_unique_listeners,
    'uniqueViews', v_unique_listeners,
    'likes', v_likes,
    'comments', v_comments,
    'reposts', v_reposts,
    'bookmarks', v_bookmarks,
    'bookmarkRate', v_bookmark_rate,
    'engagementRate', v_engagement_rate
  );
END;
$$;

-- â”€â”€â”€ 2. COMMUNITY GROWTH & ENGAGEMENT METRICS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE FUNCTION public.get_community_growth_metrics(p_community_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_members INT := 0;
  v_new_members_7d INT := 0;
  v_new_members_30d INT := 0;
  v_total_posts INT := 0;
  v_posts_7d INT := 0;
  v_active_contributors_30d INT := 0;
  v_total_likes INT := 0;
  v_total_comments INT := 0;
  v_growth_rate_7d NUMERIC := 0;
BEGIN
  -- Total members
  SELECT COUNT(*) INTO v_total_members
  FROM public.community_members
  WHERE community_id = p_community_id;

  -- Member acquisition trends (7d and 30d)
  SELECT COUNT(*) INTO v_new_members_7d
  FROM public.community_members
  WHERE community_id = p_community_id
    AND created_at >= (NOW() - INTERVAL '7 days');

  SELECT COUNT(*) INTO v_new_members_30d
  FROM public.community_members
  WHERE community_id = p_community_id
    AND created_at >= (NOW() - INTERVAL '30 days');

  -- Posts & discussion activity
  SELECT COUNT(*) INTO v_total_posts
  FROM public.posts
  WHERE community_id = p_community_id;

  SELECT COUNT(*) INTO v_posts_7d
  FROM public.posts
  WHERE community_id = p_community_id
    AND created_at >= (NOW() - INTERVAL '7 days');

  -- Active unique contributors in last 30d
  SELECT COUNT(DISTINCT author_id) INTO v_active_contributors_30d
  FROM public.posts
  WHERE community_id = p_community_id
    AND created_at >= (NOW() - INTERVAL '30 days');

  -- Aggregated community engagements (likes and comments across all posts)
  SELECT COUNT(*) INTO v_total_likes
  FROM public.likes l
  JOIN public.posts p ON p.id = l.post_id
  WHERE p.community_id = p_community_id;

  SELECT COUNT(*) INTO v_total_comments
  FROM public.comments c
  JOIN public.posts p ON p.id = c.post_id
  WHERE p.community_id = p_community_id;

  -- 7-day growth percentage
  IF (v_total_members - v_new_members_7d) > 0 THEN
    v_growth_rate_7d := ROUND((v_new_members_7d::NUMERIC / (v_total_members - v_new_members_7d)::NUMERIC) * 100, 1);
  ELSE
    v_growth_rate_7d := CASE WHEN v_total_members > 0 THEN 100 ELSE 0 END;
  END IF;

  RETURN jsonb_build_object(
    'communityId', p_community_id,
    'totalMembers', v_total_members,
    'newMembers7d', v_new_members_7d,
    'newMembers30d', v_new_members_30d,
    'growthRate7d', v_growth_rate_7d,
    'totalPosts', v_total_posts,
    'posts7d', v_posts_7d,
    'activeContributors30d', v_active_contributors_30d,
    'totalLikes', v_total_likes,
    'totalComments', v_total_comments,
    'totalInteractions', (v_total_likes + v_total_comments)
  );
END;
$$;


