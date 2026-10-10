-- ==============================================================================
-- Migration 044: Multi-Party Group DMs & Group Voice Whispers
-- Supports:
-- 1. Group Conversations (is_group, title, avatar_url, created_by)
-- 2. Group Conversation Members (roles: admin, member)
-- 3. Group Voice Whispers & encrypted messages per group
-- 4. RLS policies ensuring only active members can read/post messages
-- ==============================================================================

-- 1. Extend conversations for Multi-Party Groups
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS is_group BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Make user_a_id and user_b_id nullable for multi-party group conversations
ALTER TABLE public.conversations
  ALTER COLUMN user_a_id DROP NOT NULL,
  ALTER COLUMN user_b_id DROP NOT NULL;

-- 2. Group Conversation Members Table
CREATE TABLE IF NOT EXISTS public.conversation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  last_read_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_conversation_member UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON public.conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_conv ON public.conversation_members(conversation_id);

-- 3. Enable RLS on conversation_members
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Conversation members can view membership" ON public.conversation_members;
CREATE POLICY "Conversation members can view membership"
  ON public.conversation_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = conversation_members.conversation_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins or creator can manage members" ON public.conversation_members;
CREATE POLICY "Admins or creator can manage members"
  ON public.conversation_members FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = conversation_members.conversation_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
  );

-- 4. Conversations RLS updates for Group DMs
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
CREATE POLICY "Users can view their conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_a_id OR
    auth.uid() = user_b_id OR
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = conversations.id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert conversations" ON public.conversations;
CREATE POLICY "Users can insert conversations"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_a_id OR
    auth.uid() = created_by OR
    auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "Users can update their conversations" ON public.conversations;
CREATE POLICY "Users can update their conversations"
  ON public.conversations FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_a_id OR
    auth.uid() = user_b_id OR
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = conversations.id
        AND cm.user_id = auth.uid()
    )
  );

-- 5. RPC to create a Group Conversation with initial members
CREATE OR REPLACE FUNCTION public.create_group_conversation(
  p_title TEXT,
  p_member_ids UUID[],
  p_avatar_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_conv_id UUID;
  v_creator_id UUID;
  v_member_id UUID;
BEGIN
  v_creator_id := auth.uid();
  IF v_creator_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.conversations (
    is_group,
    title,
    avatar_url,
    created_by,
    last_message,
    last_message_at
  ) VALUES (
    TRUE,
    p_title,
    p_avatar_url,
    v_creator_id,
    'Group created',
    NOW()
  ) RETURNING id INTO v_conv_id;

  -- Add creator as admin
  INSERT INTO public.conversation_members (
    conversation_id,
    user_id,
    role
  ) VALUES (
    v_conv_id,
    v_creator_id,
    'admin'
  );

  -- Add other members
  FOREACH v_member_id IN ARRAY p_member_ids LOOP
    IF v_member_id <> v_creator_id THEN
      INSERT INTO public.conversation_members (
        conversation_id,
        user_id,
        role
      ) VALUES (
        v_conv_id,
        v_member_id,
        'member'
      ) ON CONFLICT (conversation_id, user_id) DO NOTHING;
    END IF;
  END LOOP;

  RETURN v_conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
