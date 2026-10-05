-- ============================================================
-- Private Voices — Migration 021: Meaningful Post Views System
-- Enforces:
-- 1. 24-hour rate limit per user per post (unique authenticated view per day)
-- 2. Public view count (excluding post author's own views)
-- 3. Author-only viewer details (viewer list strictly restricted to post author)
-- 4. RPC function `record_post_view` with 24-hour deduplication and anti-spam check
-- ============================================================

-- ─── 1. POST VIEWS TABLE ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.post_views (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  viewer_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT post_views_unique_daily UNIQUE (post_id, viewer_id, viewed_at)
);

CREATE INDEX IF NOT EXISTS post_views_post_id_idx ON public.post_views(post_id);
CREATE INDEX IF NOT EXISTS post_views_viewer_id_idx ON public.post_views(viewer_id);
CREATE INDEX IF NOT EXISTS post_views_time_idx ON public.post_views(post_id, viewer_id, viewed_at DESC);

-- Enable RLS
ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;

-- RLS Policy 1: Authenticated users can insert their own view
CREATE POLICY "Users can record post view" ON public.post_views
  FOR INSERT WITH CHECK (auth.uid() = viewer_id);

-- RLS Policy 2: Viewer details are author-only (Only post author can inspect viewers list)
CREATE POLICY "Authors can view post viewers list" ON public.post_views
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_views.post_id
        AND p.author_id = auth.uid()
    )
  );

-- ─── 2. RPC FUNCTION: RECORD POST VIEW ───────────────────────────────────────
-- Safely records a post view enforcing:
-- - Excludes author's own views from incrementing public counts
-- - Enforces 24-hour window per user per post
-- - Anti-spam check (prevents double-counting within 24h)
CREATE OR REPLACE FUNCTION public.record_post_view(
  p_post_id UUID,
  p_viewer_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_author_id UUID;
  v_recent_view_count INT;
BEGIN
  -- Get post author
  SELECT author_id INTO v_author_id
  FROM public.posts
  WHERE id = p_post_id;

  IF v_author_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1. Exclude author's own view from public counts
  IF v_author_id = p_viewer_id THEN
    RETURN FALSE;
  END IF;

  -- 2. Anti-spam & 24-hour deduplication check
  SELECT COUNT(*) INTO v_recent_view_count
  FROM public.post_views
  WHERE post_id = p_post_id
    AND viewer_id = p_viewer_id
    AND viewed_at > (NOW() - INTERVAL '24 hours');

  IF v_recent_view_count > 0 THEN
    RETURN FALSE; -- Already counted in last 24 hours
  END IF;

  -- 3. Record valid view
  INSERT INTO public.post_views (post_id, viewer_id, viewed_at)
  VALUES (p_post_id, p_viewer_id, NOW());

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- ─── 3. HELPER FUNCTION: GET POST PUBLIC VIEW COUNT ──────────────────────────
-- Returns public view count excluding author views
CREATE OR REPLACE FUNCTION public.get_post_view_count(p_post_id UUID)
RETURNS INT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_author_id UUID;
  v_count INT;
BEGIN
  SELECT author_id INTO v_author_id FROM public.posts WHERE id = p_post_id;

  SELECT COUNT(DISTINCT viewer_id) INTO v_count
  FROM public.post_views
  WHERE post_id = p_post_id
    AND viewer_id != v_author_id;

  RETURN COALESCE(v_count, 0);
END;
$$;
