-- ============================================================
-- Private Voices — Phase 2 Social Database Schema
-- ============================================================

-- ─── POSTS ──────────────────────────────────────────────────────────────────────
CREATE TABLE public.posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  image_urls    TEXT[] DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX posts_author_id_idx ON public.posts(author_id);
CREATE INDEX posts_created_at_idx ON public.posts(created_at DESC);

-- ─── HASHTAGS ───────────────────────────────────────────────────────────────────
CREATE TABLE public.hashtags (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT UNIQUE NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX hashtags_name_idx ON public.hashtags(LOWER(name));

CREATE TABLE public.post_hashtags (
  post_id       UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  hashtag_id    UUID NOT NULL REFERENCES public.hashtags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, hashtag_id)
);

CREATE INDEX post_hashtags_hashtag_id_idx ON public.post_hashtags(hashtag_id);

-- ─── LIKES ──────────────────────────────────────────────────────────────────────
CREATE TABLE public.likes (
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id       UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX likes_post_id_idx ON public.likes(post_id);

-- ─── COMMENTS ───────────────────────────────────────────────────────────────────
CREATE TABLE public.comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX comments_post_id_idx ON public.comments(post_id);

-- ─── BOOKMARKS / SAVED POSTS ────────────────────────────────────────────────────
CREATE TABLE public.saved_posts (
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id       UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- ─── REPOSTS / SHARES ───────────────────────────────────────────────────────────
CREATE TABLE public.reposts (
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id       UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- ─── CONTENT REPORTS ────────────────────────────────────────────────────────────
CREATE TABLE public.content_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type   TEXT NOT NULL, -- 'post', 'comment', 'profile'
  target_id     UUID NOT NULL,
  reason        TEXT NOT NULL,
  details       TEXT,
  status        TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'reviewed', 'dismissed', 'actioned'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── TRIGGERS: auto-update updated_at ───────────────────────────────────────────
CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────────
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Policies for posts
CREATE POLICY "Posts are viewable by everyone" ON public.posts FOR SELECT USING (TRUE);
CREATE POLICY "Users can create posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can delete own posts" ON public.posts FOR DELETE USING (auth.uid() = author_id);
CREATE POLICY "Users can update own posts" ON public.posts FOR UPDATE USING (auth.uid() = author_id);

-- Policies for likes
CREATE POLICY "Likes are viewable by everyone" ON public.likes FOR SELECT USING (TRUE);
CREATE POLICY "Users can like posts" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike posts" ON public.likes FOR DELETE USING (auth.uid() = user_id);

-- Policies for comments
CREATE POLICY "Comments are viewable by everyone" ON public.comments FOR SELECT USING (TRUE);
CREATE POLICY "Users can create comments" ON public.comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE USING (auth.uid() = author_id);

-- Policies for saved_posts
CREATE POLICY "Users can view own saved posts" ON public.saved_posts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can save posts" ON public.saved_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unsave posts" ON public.saved_posts FOR DELETE USING (auth.uid() = user_id);

-- Policies for reposts
CREATE POLICY "Reposts are viewable by everyone" ON public.reposts FOR SELECT USING (TRUE);
CREATE POLICY "Users can repost" ON public.reposts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove repost" ON public.reposts FOR DELETE USING (auth.uid() = user_id);

-- Policies for content_reports
CREATE POLICY "Users can create reports" ON public.content_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
