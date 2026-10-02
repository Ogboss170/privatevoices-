-- ============================================================
-- Private Voices — Phase 6 Stories Database Schema
-- ============================================================

-- ─── STORIES (24-Hour Temporary Content) ──────────────────────────────────
CREATE TABLE public.stories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content       TEXT,
  image_url     TEXT,
  media_type    TEXT NOT NULL DEFAULT 'text', -- 'text', 'image'
  visibility    story_visibility_type NOT NULL DEFAULT 'everyone',
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX stories_author_id_idx ON public.stories(author_id);
CREATE INDEX stories_expires_at_idx ON public.stories(expires_at DESC);

-- ─── STORY VIEWS ──────────────────────────────────────────────────────────
CREATE TABLE public.story_views (
  story_id      UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (story_id, viewer_id)
);

CREATE INDEX story_views_story_id_idx ON public.story_views(story_id);

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

-- Stories RLS: Non-expired stories viewable by everyone; Authors can insert/delete
CREATE POLICY "Unexpired stories viewable" ON public.stories FOR SELECT USING (expires_at > NOW());
CREATE POLICY "Users can create stories" ON public.stories FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can delete own stories" ON public.stories FOR DELETE USING (auth.uid() = author_id);

-- Story views RLS: Authors can view their story viewers; Viewers can insert view
CREATE POLICY "Authors can view story viewers" ON public.story_views FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.author_id = auth.uid())
);
CREATE POLICY "Users can record story view" ON public.story_views FOR INSERT WITH CHECK (auth.uid() = viewer_id);
