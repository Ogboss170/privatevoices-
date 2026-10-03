-- ============================================================
-- Private Voices — Idempotent Consolidated Supabase Database Schema
-- Run this full script in your Supabase SQL Editor
-- (https://supabase.com/dashboard -> SQL Editor)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 1. ENUM TYPES ──────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visibility_anyone_followers_nobody') THEN
    CREATE TYPE visibility_anyone_followers_nobody AS ENUM ('anyone', 'followers', 'nobody');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'story_visibility_type') THEN
    CREATE TYPE story_visibility_type AS ENUM ('everyone', 'followers', 'close_friends', 'custom');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE notification_type AS ENUM (
      'like',
      'comment',
      'follow',
      'mention',
      'message',
      'whisper',
      'community_activity',
      'system'
    );
  END IF;
END $$;

-- ─── 2. PROFILES (extends Supabase auth.users) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  bio           TEXT,
  avatar_url    TEXT,
  is_private    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_]{3,30}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles (LOWER(username));

-- ─── 3. PRIVACY SETTINGS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.privacy_settings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  who_can_follow            visibility_anyone_followers_nobody NOT NULL DEFAULT 'anyone',
  who_can_message           visibility_anyone_followers_nobody NOT NULL DEFAULT 'anyone',
  whisper_visibility        visibility_anyone_followers_nobody NOT NULL DEFAULT 'anyone',
  story_visibility          story_visibility_type NOT NULL DEFAULT 'everyone',
  who_can_comment           visibility_anyone_followers_nobody NOT NULL DEFAULT 'anyone',
  who_can_mention           visibility_anyone_followers_nobody NOT NULL DEFAULT 'anyone',
  show_in_recommendations   BOOLEAN NOT NULL DEFAULT TRUE,
  allow_profile_indexing    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 4. FOLLOWS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT no_self_follow CHECK (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS follows_follower_idx  ON public.follows (follower_id);
CREATE INDEX IF NOT EXISTS follows_following_idx ON public.follows (following_id);

-- ─── 5. COMMUNITIES ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.communities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  banner_url    TEXT,
  avatar_url    TEXT,
  creator_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS communities_slug_idx ON public.communities(LOWER(slug));

CREATE TABLE IF NOT EXISTS public.community_members (
  community_id  UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'member',
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (community_id, user_id)
);

-- ─── 6. POSTS & SOCIAL ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  community_id  UUID REFERENCES public.communities(id) ON DELETE SET NULL,
  content       TEXT NOT NULL,
  image_urls    TEXT[] DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS posts_author_id_idx ON public.posts(author_id);
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON public.posts(created_at DESC);

CREATE TABLE IF NOT EXISTS public.likes (
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id       UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS likes_post_id_idx ON public.likes(post_id);

CREATE TABLE IF NOT EXISTS public.comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS comments_post_id_idx ON public.comments(post_id);

CREATE TABLE IF NOT EXISTS public.saved_posts (
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id       UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS public.reposts (
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id       UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- ─── 7. ANONYMOUS WHISPERS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whispers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content             TEXT NOT NULL,
  sender_session_hash TEXT,
  sender_ip_hash      TEXT,
  is_read             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS whispers_recipient_id_idx ON public.whispers(recipient_id);
CREATE INDEX IF NOT EXISTS whispers_created_at_idx ON public.whispers(created_at DESC);

-- ─── 8. DIRECT MESSAGING ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_message    TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT conversation_unique_users UNIQUE(user_a_id, user_b_id)
);

CREATE INDEX IF NOT EXISTS conversations_user_a_idx ON public.conversations(user_a_id);
CREATE INDEX IF NOT EXISTS conversations_user_b_idx ON public.conversations(user_b_id);

CREATE TABLE IF NOT EXISTS public.messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  image_url       TEXT,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON public.messages(created_at ASC);

-- ─── 9. STORIES ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content       TEXT,
  image_url     TEXT,
  media_type    TEXT NOT NULL DEFAULT 'text',
  visibility    story_visibility_type NOT NULL DEFAULT 'everyone',
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stories_author_id_idx ON public.stories(author_id);
CREATE INDEX IF NOT EXISTS stories_expires_at_idx ON public.stories(expires_at DESC);

CREATE TABLE IF NOT EXISTS public.story_views (
  story_id      UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (story_id, viewer_id)
);

-- ─── 10. NOTIFICATIONS & PUSH TOKENS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type          notification_type NOT NULL,
  title         TEXT NOT NULL,
  message       TEXT NOT NULL,
  entity_type   TEXT,
  entity_id     UUID,
  is_read       BOOLEAN NOT NULL DEFAULT FALSE,
  group_count   INTEGER DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_recipient_id_idx ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON public.notifications(created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  device_type   TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, expo_push_token)
);

-- ─── 11. MODERATION & SAFETY ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.content_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type   TEXT NOT NULL,
  target_id     UUID NOT NULL,
  reason        TEXT NOT NULL,
  details       TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT no_self_block CHECK (blocker_id != blocked_id)
);

CREATE TABLE IF NOT EXISTS public.user_mutes (
  muter_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  muted_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (muter_id, muted_id),
  CONSTRAINT no_self_mute CHECK (muter_id != muted_id)
);

CREATE TABLE IF NOT EXISTS public.user_suspensions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason        TEXT NOT NULL,
  suspended_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  target_type   TEXT,
  target_id     UUID,
  details       JSONB,
  ip_address    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 12. TRIGGERS & STORED FUNCTIONS ───────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_default_privacy_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.privacy_settings (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.create_profile(
  p_user_id     UUID,
  p_username    TEXT,
  p_display_name TEXT
)
RETURNS public.profiles AS $$
DECLARE
  new_profile public.profiles;
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (p_user_id, p_username, p_display_name)
  RETURNING * INTO new_profile;

  RETURN new_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 13. ROW LEVEL SECURITY & POLICIES ─────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whispers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_mutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_suspensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper to safely drop and recreate policies without erroring if they exist
DO $$ BEGIN
  -- profiles
  DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
  DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
  CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (TRUE);
  CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

  -- privacy_settings
  DROP POLICY IF EXISTS "Users can view their own privacy settings" ON public.privacy_settings;
  DROP POLICY IF EXISTS "Users can update their own privacy settings" ON public.privacy_settings;
  CREATE POLICY "Users can view their own privacy settings" ON public.privacy_settings FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "Users can update their own privacy settings" ON public.privacy_settings FOR UPDATE USING (auth.uid() = user_id);

  -- follows
  DROP POLICY IF EXISTS "Follows are publicly readable" ON public.follows;
  DROP POLICY IF EXISTS "Users can follow others" ON public.follows;
  DROP POLICY IF EXISTS "Users can unfollow" ON public.follows;
  CREATE POLICY "Follows are publicly readable" ON public.follows FOR SELECT USING (TRUE);
  CREATE POLICY "Users can follow others" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
  CREATE POLICY "Users can unfollow" ON public.follows FOR DELETE USING (auth.uid() = follower_id);

  -- posts
  DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
  DROP POLICY IF EXISTS "Users can create posts" ON public.posts;
  DROP POLICY IF EXISTS "Users can delete own posts" ON public.posts;
  DROP POLICY IF EXISTS "Users can update own posts" ON public.posts;
  CREATE POLICY "Posts are viewable by everyone" ON public.posts FOR SELECT USING (TRUE);
  CREATE POLICY "Users can create posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = author_id);
  CREATE POLICY "Users can delete own posts" ON public.posts FOR DELETE USING (auth.uid() = author_id);
  CREATE POLICY "Users can update own posts" ON public.posts FOR UPDATE USING (auth.uid() = author_id);

  -- likes
  DROP POLICY IF EXISTS "Likes are viewable by everyone" ON public.likes;
  DROP POLICY IF EXISTS "Users can like posts" ON public.likes;
  DROP POLICY IF EXISTS "Users can unlike posts" ON public.likes;
  CREATE POLICY "Likes are viewable by everyone" ON public.likes FOR SELECT USING (TRUE);
  CREATE POLICY "Users can like posts" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "Users can unlike posts" ON public.likes FOR DELETE USING (auth.uid() = user_id);

  -- comments
  DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.comments;
  DROP POLICY IF EXISTS "Users can create comments" ON public.comments;
  DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;
  CREATE POLICY "Comments are viewable by everyone" ON public.comments FOR SELECT USING (TRUE);
  CREATE POLICY "Users can create comments" ON public.comments FOR INSERT WITH CHECK (auth.uid() = author_id);
  CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE USING (auth.uid() = author_id);

  -- saved_posts
  DROP POLICY IF EXISTS "Users can view own saved posts" ON public.saved_posts;
  DROP POLICY IF EXISTS "Users can save posts" ON public.saved_posts;
  DROP POLICY IF EXISTS "Users can unsave posts" ON public.saved_posts;
  CREATE POLICY "Users can view own saved posts" ON public.saved_posts FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "Users can save posts" ON public.saved_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "Users can unsave posts" ON public.saved_posts FOR DELETE USING (auth.uid() = user_id);

  -- whispers
  DROP POLICY IF EXISTS "Anyone can send a whisper" ON public.whispers;
  DROP POLICY IF EXISTS "Recipients can view whispers" ON public.whispers;
  DROP POLICY IF EXISTS "Recipients can update whispers" ON public.whispers;
  DROP POLICY IF EXISTS "Recipients can delete whispers" ON public.whispers;
  CREATE POLICY "Anyone can send a whisper" ON public.whispers FOR INSERT WITH CHECK (TRUE);
  CREATE POLICY "Recipients can view whispers" ON public.whispers FOR SELECT USING (auth.uid() = recipient_id);
  CREATE POLICY "Recipients can update whispers" ON public.whispers FOR UPDATE USING (auth.uid() = recipient_id);
  CREATE POLICY "Recipients can delete whispers" ON public.whispers FOR DELETE USING (auth.uid() = recipient_id);

  -- conversations & messages
  DROP POLICY IF EXISTS "Participants can view conversations" ON public.conversations;
  DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
  DROP POLICY IF EXISTS "Participants can view messages" ON public.messages;
  DROP POLICY IF EXISTS "Participants can insert messages" ON public.messages;
  CREATE POLICY "Participants can view conversations" ON public.conversations FOR SELECT USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);
  CREATE POLICY "Users can create conversations" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = user_a_id OR auth.uid() = user_b_id);
  CREATE POLICY "Participants can view messages" ON public.messages FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations c 
      WHERE c.id = conversation_id AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
    )
  );
  CREATE POLICY "Participants can insert messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

  -- communities
  DROP POLICY IF EXISTS "Communities viewable by everyone" ON public.communities;
  DROP POLICY IF EXISTS "Users can create communities" ON public.communities;
  DROP POLICY IF EXISTS "Members viewable by everyone" ON public.community_members;
  DROP POLICY IF EXISTS "Users can join communities" ON public.community_members;
  DROP POLICY IF EXISTS "Users can leave communities" ON public.community_members;
  CREATE POLICY "Communities viewable by everyone" ON public.communities FOR SELECT USING (TRUE);
  CREATE POLICY "Users can create communities" ON public.communities FOR INSERT WITH CHECK (auth.uid() = creator_id);
  CREATE POLICY "Members viewable by everyone" ON public.community_members FOR SELECT USING (TRUE);
  CREATE POLICY "Users can join communities" ON public.community_members FOR INSERT WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "Users can leave communities" ON public.community_members FOR DELETE USING (auth.uid() = user_id);

  -- stories
  DROP POLICY IF EXISTS "Unexpired stories viewable" ON public.stories;
  DROP POLICY IF EXISTS "Users can create stories" ON public.stories;
  DROP POLICY IF EXISTS "Users can delete own stories" ON public.stories;
  CREATE POLICY "Unexpired stories viewable" ON public.stories FOR SELECT USING (expires_at > NOW());
  CREATE POLICY "Users can create stories" ON public.stories FOR INSERT WITH CHECK (auth.uid() = author_id);
  CREATE POLICY "Users can delete own stories" ON public.stories FOR DELETE USING (auth.uid() = author_id);

  -- notifications & push tokens
  DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
  DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
  DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
  DROP POLICY IF EXISTS "Users can view own push tokens" ON public.user_push_tokens;
  DROP POLICY IF EXISTS "Users can insert own push tokens" ON public.user_push_tokens;
  CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = recipient_id);
  CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = recipient_id);
  CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE USING (auth.uid() = recipient_id);
  CREATE POLICY "Users can view own push tokens" ON public.user_push_tokens FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "Users can insert own push tokens" ON public.user_push_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);

  -- moderation
  DROP POLICY IF EXISTS "Users can create reports" ON public.content_reports;
  CREATE POLICY "Users can create reports" ON public.content_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
END $$;
