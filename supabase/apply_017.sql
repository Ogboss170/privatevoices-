-- ============================================================
-- Migration 017: Feed Algorithm, Interaction Signals & Cursor Pagination
-- ============================================================

-- 1. Create Feed Interaction Event Enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feed_interaction_type') THEN
    CREATE TYPE feed_interaction_type AS ENUM (
      'VIEW_POST',
      'LIKE_POST',
      'COMMENT_POST',
      'REPOST_POST',
      'SAVE_POST',
      'SHARE_POST',
      'FOLLOW_USER',
      'OPEN_PROFILE',
      'HIDE_POST',
      'NOT_INTERESTED',
      'REPORT_POST',
      'BLOCK_USER',
      'MUTE_USER'
    );
  END IF;
END $$;

-- 2. User Feed Interactions Log Table
CREATE TABLE IF NOT EXISTS public.feed_interactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type   TEXT NOT NULL, -- 'post' | 'user' | 'community'
  target_id     UUID NOT NULL,
  event_type    feed_interaction_type NOT NULL,
  weight        FLOAT NOT NULL DEFAULT 1.0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feed_interactions_user_idx ON public.feed_interactions(user_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS feed_interactions_target_idx ON public.feed_interactions(target_type, target_id);

-- 3. User Feed Preferences & Affinity Matrix (Calculated offline or dynamically)
CREATE TABLE IF NOT EXISTS public.user_feed_preferences (
  user_id               UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  muted_keywords        TEXT[] DEFAULT '{}',
  hidden_post_ids       UUID[] DEFAULT '{}',
  preferred_categories  JSONB DEFAULT '{}'::jsonb,
  last_feed_refresh     TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE public.feed_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_feed_preferences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can insert and view own feed interactions" ON public.feed_interactions;
  CREATE POLICY "Users can insert and view own feed interactions" ON public.feed_interactions
    FOR ALL USING (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Users can view and manage own feed preferences" ON public.user_feed_preferences;
  CREATE POLICY "Users can view and manage own feed preferences" ON public.user_feed_preferences
    FOR ALL USING (auth.uid() = user_id);
END $$;
