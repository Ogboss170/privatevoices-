-- ============================================================
-- Private Voices — Phase 3 Whispers & Messaging Database Schema
-- ============================================================

-- ─── ANONYMOUS WHISPERS ───────────────────────────────────────────────────────
CREATE TABLE public.whispers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content             TEXT NOT NULL,
  -- Sender safety metadata (hidden from recipient, retained for safety/moderation)
  sender_session_hash TEXT,
  sender_ip_hash      TEXT,
  reply_content       TEXT,
  replied_at          TIMESTAMPTZ,
  is_read             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX whispers_recipient_id_idx ON public.whispers(recipient_id);
CREATE INDEX whispers_created_at_idx ON public.whispers(created_at DESC);

-- ─── CONVERSATIONS & MESSAGES (Identity-based Direct Messaging) ─────────────
CREATE TABLE public.conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_message  TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT conversation_unique_users UNIQUE(user_a_id, user_b_id)
);

CREATE INDEX conversations_user_a_idx ON public.conversations(user_a_id);
CREATE INDEX conversations_user_b_idx ON public.conversations(user_b_id);

CREATE TABLE public.messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  image_url       TEXT,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX messages_conversation_id_idx ON public.messages(conversation_id);
CREATE INDEX messages_created_at_idx ON public.messages(created_at ASC);

-- ─── COMMUNITIES ─────────────────────────────────────────────────────────────
CREATE TABLE public.communities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  banner_url    TEXT,
  avatar_url    TEXT,
  creator_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX communities_slug_idx ON public.communities(LOWER(slug));

CREATE TABLE public.community_members (
  community_id  UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'member', -- 'owner', 'moderator', 'member'
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (community_id, user_id)
);

-- Add community_id column to posts table
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES public.communities(id) ON DELETE SET NULL;

-- ─── TRIGGERS ────────────────────────────────────────────────────────────────
CREATE TRIGGER whispers_updated_at
  BEFORE UPDATE ON public.whispers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER communities_updated_at
  BEFORE UPDATE ON public.communities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────
ALTER TABLE public.whispers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

-- Whispers RLS: Anyone can send a whisper; Recipient can read & update their whispers
CREATE POLICY "Anyone can send a whisper" ON public.whispers FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Recipients can view whispers" ON public.whispers FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY "Recipients can update whispers" ON public.whispers FOR UPDATE USING (auth.uid() = recipient_id);
CREATE POLICY "Recipients can delete whispers" ON public.whispers FOR DELETE USING (auth.uid() = recipient_id);

-- Conversations RLS: Participants can view and manage their conversations
CREATE POLICY "Participants can view conversations" ON public.conversations FOR SELECT USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);
CREATE POLICY "Users can create conversations" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- Messages RLS: Participants can view and send messages
CREATE POLICY "Participants can view messages" ON public.messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.conversations c 
    WHERE c.id = conversation_id AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
  )
);
CREATE POLICY "Participants can insert messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Communities RLS: Viewable by everyone; Creators can manage
CREATE POLICY "Communities viewable by everyone" ON public.communities FOR SELECT USING (TRUE);
CREATE POLICY "Users can create communities" ON public.communities FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Members viewable by everyone" ON public.community_members FOR SELECT USING (TRUE);
CREATE POLICY "Users can join communities" ON public.community_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave communities" ON public.community_members FOR DELETE USING (auth.uid() = user_id);
