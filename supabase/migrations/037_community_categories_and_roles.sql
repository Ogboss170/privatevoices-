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
