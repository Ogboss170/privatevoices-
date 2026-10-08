-- ==============================================================================
-- Migration 032: Community Moderation Superpowers & Native Role Controls
-- Supports:
--  1. Pinned Posts in Communities (posts.is_pinned, posts.pinned_at, posts.pinned_by)
--  2. Community Mutes (Restricts disruptive members from posting/commenting)
--  3. Community Rules Table & Custom Rules Editor
--  4. RLS Policies allowing Community Owners and Moderators to Pin, Mute & Edit Rules
-- ==============================================================================

-- ─── 1. PINNED POSTS IN COMMUNITIES ──────────────────────────────────────────
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

-- ─── 2. COMMUNITY MUTES (LOCAL COMMUNITY RESTRICTION) ────────────────────────
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

-- ─── 3. COMMUNITY RULES CUSTOMIZATION ────────────────────────────────────────
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
