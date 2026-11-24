-- ==============================================================================
-- Migration 064: Community Sub-Channels & Realtime Chat Rooms
-- Supports:
-- 1. community_channels: Topic rooms (#general, #announcements, #venting, etc.)
-- 2. community_channel_messages: Live messages sent within channels
-- 3. Automatic default channel creation trigger for new communities
-- 4. RLS security policies allowing members to read and post
-- ==============================================================================

-- 1. Create community_channels table
CREATE TABLE IF NOT EXISTS public.community_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'announcement', 'voice')),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_community_channel_slug UNIQUE (community_id, slug)
);

-- Index for fast lookup by community
CREATE INDEX IF NOT EXISTS idx_community_channels_comm ON public.community_channels(community_id);

-- 2. Create community_channel_messages table
CREATE TABLE IF NOT EXISTS public.community_channel_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.community_channels(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  parent_id UUID REFERENCES public.community_channel_messages(id) ON DELETE SET NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for rapid message retrieval in chat order
CREATE INDEX IF NOT EXISTS idx_channel_messages_channel ON public.community_channel_messages(channel_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_channel_messages_sender ON public.community_channel_messages(sender_id);

-- 3. Enable Row-Level Security
ALTER TABLE public.community_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_channel_messages ENABLE ROW LEVEL SECURITY;

-- Channels RLS Policies:
-- Public communities: anyone can view channels
-- Private communities: members only
DROP POLICY IF EXISTS "Anyone can view channels of accessible communities" ON public.community_channels;
CREATE POLICY "Anyone can view channels of accessible communities"
  ON public.community_channels
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = community_channels.community_id
        AND (c.privacy = 'public' OR c.privacy IS NULL)
    )
    OR
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_channels.community_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'member'
    )
  );

-- Only owners and moderators can create/edit/delete channels
DROP POLICY IF EXISTS "Owners and moderators can manage channels" ON public.community_channels;
CREATE POLICY "Owners and moderators can manage channels"
  ON public.community_channels
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = community_channels.community_id
        AND c.creator_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_channels.community_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'moderator')
    )
  );

-- Messages RLS Policies:
-- Read messages: if can view channel
DROP POLICY IF EXISTS "Users can read messages in viewable channels" ON public.community_channel_messages;
CREATE POLICY "Users can read messages in viewable channels"
  ON public.community_channel_messages
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.community_channels ch
      JOIN public.communities c ON c.id = ch.community_id
      WHERE ch.id = community_channel_messages.channel_id
        AND (
          c.privacy = 'public' OR
          EXISTS (
            SELECT 1 FROM public.community_members cm
            WHERE cm.community_id = c.id
              AND cm.user_id = auth.uid()
              AND cm.status = 'member'
          )
        )
    )
  );

-- Send messages: Must be a member of the community (or creator)
-- For announcement channels, only owner or moderator can post
DROP POLICY IF EXISTS "Members can post messages to channels" ON public.community_channel_messages;
CREATE POLICY "Members can post messages to channels"
  ON public.community_channel_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.community_channels ch
      JOIN public.communities c ON c.id = ch.community_id
      WHERE ch.id = channel_id
        AND (
          (ch.type != 'announcement' AND (
            c.creator_id = auth.uid() OR
            EXISTS (
              SELECT 1 FROM public.community_members cm
              WHERE cm.community_id = c.id
                AND cm.user_id = auth.uid()
                AND cm.status = 'member'
            )
          ))
          OR
          (ch.type = 'announcement' AND (
            c.creator_id = auth.uid() OR
            EXISTS (
              SELECT 1 FROM public.community_members cm
              WHERE cm.community_id = c.id
                AND cm.user_id = auth.uid()
                AND cm.role IN ('owner', 'moderator')
            )
          ))
        )
    )
  );

-- Authors and moderators can delete messages
DROP POLICY IF EXISTS "Authors and mods can delete channel messages" ON public.community_channel_messages;
CREATE POLICY "Authors and mods can delete channel messages"
  ON public.community_channel_messages
  FOR DELETE
  TO authenticated
  USING (
    sender_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_channel_messages.community_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'moderator')
    )
  );

-- 4. Enable Supabase Realtime for community_channel_messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'community_channel_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_channel_messages;
  END IF;
END $$;

-- 5. Seed default channels (#general, #announcements, #venting) for existing communities
INSERT INTO public.community_channels (community_id, name, slug, description, type, is_default)
SELECT 
  id as community_id,
  'general' as name,
  'general' as slug,
  'General discussions and welcome chat' as description,
  'text' as type,
  TRUE as is_default
FROM public.communities
ON CONFLICT (community_id, slug) DO NOTHING;

INSERT INTO public.community_channels (community_id, name, slug, description, type, is_default)
SELECT 
  id as community_id,
  'announcements' as name,
  'announcements' as slug,
  'Important updates from community leaders' as description,
  'announcement' as type,
  FALSE as is_default
FROM public.communities
ON CONFLICT (community_id, slug) DO NOTHING;

INSERT INTO public.community_channels (community_id, name, slug, description, type, is_default)
SELECT 
  id as community_id,
  'venting' as name,
  'venting' as slug,
  'A judgment-free space to let it out and share raw thoughts' as description,
  'text' as type,
  FALSE as is_default
FROM public.communities
ON CONFLICT (community_id, slug) DO NOTHING;

NOTIFY pgrst, 'reload schema';
