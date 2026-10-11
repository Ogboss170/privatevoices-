-- ==============================================================================
-- Migration 048: Community Branding, Cover Banners & Facebook/Telegram Channel Controls
-- Supports:
-- 1. Expanding communities table with cover_url / banner_url, custom accent colors,
--    broadcast/channel mode, website/social link, and membership verification questions.
-- 2. Permissive RLS update policy for owners & moderators to update community profile
--    (name, description, avatar_url, cover_url, category, privacy, broadcast_mode).
-- ==============================================================================

-- 1. Ensure cover_url and branding columns exist
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS cover_url TEXT,
  ADD COLUMN IF NOT EXISTS broadcast_mode BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS external_link TEXT;

-- Fallback sync if banner_url was used previously
UPDATE public.communities
SET cover_url = banner_url
WHERE cover_url IS NULL AND banner_url IS NOT NULL;

-- 2. Update RLS policy so creators, owners, and moderators can update community details
DROP POLICY IF EXISTS "Owners and moderators can update community info" ON public.communities;
DROP POLICY IF EXISTS "Owners can update community settings" ON public.communities;
DROP POLICY IF EXISTS "Creators can update community" ON public.communities;

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
  )
  WITH CHECK (
    creator_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = communities.id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'moderator')
    )
  );

NOTIFY pgrst, 'reload schema';
