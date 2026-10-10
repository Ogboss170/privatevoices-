-- ==============================================================================
-- Migration 042: Next-Gen Direct Messaging Superpowers
-- Supports:
-- 1. Instagram-style emoji reactions & reply quoting on messages
-- 2. Vanishing / Disappearing mode (self-destruct after viewing / timed cleanup)
-- 3. Rich media attachments (video, GIF, audio waveform data)
-- ==============================================================================

-- 1. Extend public.messages with reactions, reply quotes, media types, and vanishing mode
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reply_to_content TEXT,
  ADD COLUMN IF NOT EXISTS reply_to_sender TEXT,
  ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'text' CHECK (media_type IN ('text', 'image', 'video', 'audio', 'gif')),
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS is_disappearing BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS disappearing_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_deleted_for_everyone BOOLEAN DEFAULT FALSE;

-- 2. Extend public.conversations with vanishing mode configuration
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS vanish_mode_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS vanish_duration_seconds INT DEFAULT 86400; -- default 24h

-- 3. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON public.messages(reply_to_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_disappearing ON public.messages(is_disappearing, disappearing_expires_at);

-- 4. RPC to atomically add/toggle an Instagram-style reaction on a DM message
CREATE OR REPLACE FUNCTION public.toggle_dm_reaction(
  p_message_id UUID,
  p_emoji TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_reactions JSONB;
  v_users JSONB;
  v_uid TEXT;
  v_sender UUID;
  v_exists BOOLEAN;
BEGIN
  v_uid := auth.uid()::TEXT;
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Unauthorized');
  END IF;

  SELECT reactions, sender_id INTO v_reactions, v_sender
  FROM public.messages
  WHERE id = p_message_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Message not found');
  END IF;

  v_reactions := COALESCE(v_reactions, '{}'::jsonb);
  v_users := COALESCE(v_reactions -> p_emoji, '[]'::jsonb);

  -- Check if user already reacted with this emoji
  IF v_users ? v_uid THEN
    -- Remove user reaction
    SELECT jsonb_agg(elem)
    INTO v_users
    FROM jsonb_array_elements_text(v_users) elem
    WHERE elem <> v_uid;

    v_users := COALESCE(v_users, '[]'::jsonb);
    IF jsonb_array_length(v_users) = 0 THEN
      v_reactions := v_reactions - p_emoji;
    ELSE
      v_reactions := jsonb_set(v_reactions, ARRAY[p_emoji], v_users);
    END IF;
  ELSE
    -- Add user reaction
    v_users := v_users || to_jsonb(v_uid);
    v_reactions := jsonb_set(v_reactions, ARRAY[p_emoji], v_users);
  END IF;

  UPDATE public.messages
  SET reactions = v_reactions
  WHERE id = p_message_id;

  RETURN jsonb_build_object('success', TRUE, 'reactions', v_reactions);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.toggle_dm_reaction(UUID, TEXT) TO authenticated, service_role;

-- 5. RPC to toggle Vanish Mode in a conversation
CREATE OR REPLACE FUNCTION public.toggle_conversation_vanish_mode(
  p_conversation_id UUID,
  p_enabled BOOLEAN,
  p_duration_seconds INT DEFAULT 86400
)
RETURNS JSONB AS $$
BEGIN
  UPDATE public.conversations
  SET vanish_mode_enabled = p_enabled,
      vanish_duration_seconds = COALESCE(p_duration_seconds, 86400)
  WHERE id = p_conversation_id
    AND (user_a_id = auth.uid() OR user_b_id = auth.uid());

  RETURN jsonb_build_object(
    'success', TRUE,
    'vanish_mode_enabled', p_enabled,
    'vanish_duration_seconds', p_duration_seconds
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.toggle_conversation_vanish_mode(UUID, BOOLEAN, INT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
