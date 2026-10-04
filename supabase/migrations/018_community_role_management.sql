-- ============================================================
-- Private Voices — Migration 018: Community Role Management
-- Allow owners/moderators to update member roles
-- ============================================================

-- Owners can update any member's role in their community
CREATE POLICY "Owners can update member roles"
  ON public.community_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_members.community_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'owner'
    )
  );

-- Moderators can also update member roles
-- (further restrictions enforced at app layer — mods cannot promote to owner or demote other mods)
CREATE POLICY "Moderators can update member roles"
  ON public.community_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_members.community_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'moderator')
    )
  );
