-- ==============================================================================
-- Migration 066: Custom Community Post Flairs & Category Filtering
-- Supports:
-- 1. community_flairs: Pre-defined custom tags per community (e.g. [Question], [Story], [Advice], [Announcement])
-- 2. Adding flair_id and flair_name columns to public.posts
-- 3. Automatic seeding of default flairs for existing communities
-- 4. RLS security policies allowing members to pick flairs and owners/mods to manage them
-- ==============================================================================

-- 1. Create community_flairs table
CREATE TABLE IF NOT EXISTS public.community_flairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  bg_color TEXT NOT NULL DEFAULT 'rgba(99, 102, 241, 0.1)',
  icon TEXT DEFAULT '🏷️',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_community_flair_name UNIQUE (community_id, name)
);

CREATE INDEX IF NOT EXISTS idx_community_flairs_comm ON public.community_flairs(community_id);

-- 2. Add flair fields to posts table
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS flair_id UUID REFERENCES public.community_flairs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS flair_name TEXT,
  ADD COLUMN IF NOT EXISTS flair_color TEXT;

CREATE INDEX IF NOT EXISTS idx_posts_flair ON public.posts(flair_id);

-- 3. Enable RLS
ALTER TABLE public.community_flairs ENABLE ROW LEVEL SECURITY;

-- Flairs Policies
DROP POLICY IF EXISTS "Anyone can view community flairs" ON public.community_flairs;
CREATE POLICY "Anyone can view community flairs"
  ON public.community_flairs
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Owners and moderators can manage community flairs" ON public.community_flairs;
CREATE POLICY "Owners and moderators can manage community flairs"
  ON public.community_flairs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = community_flairs.community_id
        AND (c.creator_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.community_members cm
          WHERE cm.community_id = c.id
            AND cm.user_id = auth.uid()
            AND cm.role IN ('owner', 'moderator')
        ))
    )
  );

-- 4. Seed default flairs for all existing communities
INSERT INTO public.community_flairs (community_id, name, color, bg_color, icon)
SELECT id, 'Discussion', '#6366f1', 'rgba(99, 102, 241, 0.1)', '💭' FROM public.communities
ON CONFLICT (community_id, name) DO NOTHING;

INSERT INTO public.community_flairs (community_id, name, color, bg_color, icon)
SELECT id, 'Question', '#0284c7', 'rgba(2, 132, 199, 0.1)', '❓' FROM public.communities
ON CONFLICT (community_id, name) DO NOTHING;

INSERT INTO public.community_flairs (community_id, name, color, bg_color, icon)
SELECT id, 'Personal Story', '#d97706', 'rgba(217, 119, 6, 0.1)', '📖' FROM public.communities
ON CONFLICT (community_id, name) DO NOTHING;

INSERT INTO public.community_flairs (community_id, name, color, bg_color, icon)
SELECT id, 'Advice', '#16a34a', 'rgba(22, 163, 74, 0.1)', '💡' FROM public.communities
ON CONFLICT (community_id, name) DO NOTHING;

INSERT INTO public.community_flairs (community_id, name, color, bg_color, icon)
SELECT id, 'Announcement', '#dc2626', 'rgba(220, 38, 38, 0.1)', '📢' FROM public.communities
ON CONFLICT (community_id, name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
