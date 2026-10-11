-- ==============================================================================
-- Migration 050: Fix Infinite Recursion on conversation_members and conversations
-- ==============================================================================

-- 1. Helper security-definer function to check if a user is a member of a conversation
-- Using SECURITY DEFINER bypasses RLS during the lookup, preventing infinite recursion
CREATE OR REPLACE FUNCTION public.is_conversation_member(p_conv_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = p_conv_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_admin(p_conv_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = p_conv_id AND user_id = p_user_id AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_conversation_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_admin(UUID, UUID) TO authenticated;

-- 2. Clean up recursive policies on conversation_members
DROP POLICY IF EXISTS "Conversation members can view membership" ON public.conversation_members;
CREATE POLICY "Conversation members can view membership"
  ON public.conversation_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    public.is_conversation_member(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "Admins or creator can manage members" ON public.conversation_members;
CREATE POLICY "Admins or creator can manage members"
  ON public.conversation_members FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid() OR
    public.is_conversation_admin(conversation_id, auth.uid())
  );

-- 3. Update conversations policies to use security-definer helper to prevent recursion loop
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Participants can view conversations" ON public.conversations;
CREATE POLICY "Participants can view conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_a_id OR
    auth.uid() = user_b_id OR
    public.is_conversation_member(id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_a_id OR
    auth.uid() = user_b_id OR
    auth.uid() = created_by OR
    auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "Users can update their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Participants can update conversations" ON public.conversations;
CREATE POLICY "Participants can update conversations"
  ON public.conversations FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_a_id OR
    auth.uid() = user_b_id OR
    public.is_conversation_member(id, auth.uid())
  );

NOTIFY pgrst, 'reload schema';
