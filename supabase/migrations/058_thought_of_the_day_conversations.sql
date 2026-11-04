-- ==============================================================================
-- Migration 058: Thought of the Day Conversations, Reactions & Bookmarks
-- Supports:
-- 1. prompt_reactions (user_id, prompt_id, created_at) -> like / resonate with thought
-- 2. prompt_saves (user_id, prompt_id, created_at) -> save / bookmark thought
-- 3. prompt_comments (id, prompt_id, author_id, content, is_masked, masked_persona, created_at, updated_at)
-- 4. prompt_reshares (user_id, prompt_id, quote, created_at) -> reshare to feed
-- 5. prompt_comment_likes (user_id, comment_id, created_at)
-- ==============================================================================

-- 1. Prompt Likes / Resonances
CREATE TABLE IF NOT EXISTS public.prompt_reactions (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES public.daily_thought_prompts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, prompt_id)
);

CREATE INDEX IF NOT EXISTS idx_prompt_reactions_prompt ON public.prompt_reactions(prompt_id);

-- 2. Prompt Saves / Bookmarks
CREATE TABLE IF NOT EXISTS public.prompt_saves (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES public.daily_thought_prompts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, prompt_id)
);

CREATE INDEX IF NOT EXISTS idx_prompt_saves_prompt ON public.prompt_saves(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_saves_user ON public.prompt_saves(user_id);

-- 3. Prompt Comments / Conversations
CREATE TABLE IF NOT EXISTS public.prompt_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID NOT NULL REFERENCES public.daily_thought_prompts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_masked BOOLEAN NOT NULL DEFAULT FALSE,
  masked_persona TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prompt_comments_prompt ON public.prompt_comments(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_comments_created_at ON public.prompt_comments(created_at);

-- 4. Prompt Reshares
CREATE TABLE IF NOT EXISTS public.prompt_reshares (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES public.daily_thought_prompts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, prompt_id)
);

CREATE INDEX IF NOT EXISTS idx_prompt_reshares_prompt ON public.prompt_reshares(prompt_id);

-- 5. Prompt Comment Likes
CREATE TABLE IF NOT EXISTS public.prompt_comment_likes (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  comment_id UUID NOT NULL REFERENCES public.prompt_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_prompt_comment_likes_comment ON public.prompt_comment_likes(comment_id);

-- Enable RLS
ALTER TABLE public.prompt_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_reshares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_comment_likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Prompt Reactions
DROP POLICY IF EXISTS "Anyone can view prompt reactions" ON public.prompt_reactions;
CREATE POLICY "Anyone can view prompt reactions" ON public.prompt_reactions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can toggle their own prompt reactions" ON public.prompt_reactions;
CREATE POLICY "Users can toggle their own prompt reactions" ON public.prompt_reactions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS Policies: Prompt Saves
DROP POLICY IF EXISTS "Users can view their own prompt saves" ON public.prompt_saves;
CREATE POLICY "Users can view their own prompt saves" ON public.prompt_saves
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their prompt saves" ON public.prompt_saves;
CREATE POLICY "Users can manage their prompt saves" ON public.prompt_saves
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS Policies: Prompt Comments
DROP POLICY IF EXISTS "Anyone can read prompt comments" ON public.prompt_comments;
CREATE POLICY "Anyone can read prompt comments" ON public.prompt_comments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can create prompt comments" ON public.prompt_comments;
CREATE POLICY "Authenticated users can create prompt comments" ON public.prompt_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors can delete their prompt comments" ON public.prompt_comments;
CREATE POLICY "Authors can delete their prompt comments" ON public.prompt_comments
  FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- RLS Policies: Prompt Reshares
DROP POLICY IF EXISTS "Anyone can view prompt reshares" ON public.prompt_reshares;
CREATE POLICY "Anyone can view prompt reshares" ON public.prompt_reshares
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can manage their prompt reshares" ON public.prompt_reshares;
CREATE POLICY "Users can manage their prompt reshares" ON public.prompt_reshares
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS Policies: Prompt Comment Likes
DROP POLICY IF EXISTS "Anyone can view prompt comment likes" ON public.prompt_comment_likes;
CREATE POLICY "Anyone can view prompt comment likes" ON public.prompt_comment_likes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can manage their prompt comment likes" ON public.prompt_comment_likes;
CREATE POLICY "Users can manage their prompt comment likes" ON public.prompt_comment_likes
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
