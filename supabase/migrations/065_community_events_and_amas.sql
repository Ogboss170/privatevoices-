-- ==============================================================================
-- Migration 065: Community Events & AMAs (Ask Me Anything)
-- Supports:
-- 1. community_events: Scheduled events, live AMAs, and webinars
-- 2. community_event_rsvps: Member RSVP attendance tracking (going, maybe, interested)
-- 3. community_ama_questions: Upvoted AMA question submissions and host answers
-- 4. RLS security policies for viewing, RSVPing, asking, and hosting
-- ==============================================================================

-- 1. Create community_events table
CREATE TABLE IF NOT EXISTS public.community_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'ama' CHECK (event_type IN ('ama', 'voice_stage', 'workshop', 'hangout')),
  host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  guest_name TEXT,
  guest_title TEXT,
  guest_avatar_url TEXT,
  banner_url TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'ended', 'cancelled')),
  meeting_url TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  rsvp_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_events_comm ON public.community_events(community_id, start_time ASC);

-- 2. Create community_event_rsvps table
CREATE TABLE IF NOT EXISTS public.community_event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.community_events(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'going' CHECK (status IN ('going', 'interested', 'not_going')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_event_user_rsvp UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_rsvps_event ON public.community_event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_user ON public.community_event_rsvps(user_id);

-- 3. Create community_ama_questions table (for member upvoted questions)
CREATE TABLE IF NOT EXISTS public.community_ama_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.community_events(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  upvotes INTEGER NOT NULL DEFAULT 0,
  is_answered BOOLEAN NOT NULL DEFAULT FALSE,
  answer TEXT,
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ama_questions_event ON public.community_ama_questions(event_id, upvotes DESC);

-- 4. Enable Row Level Security
ALTER TABLE public.community_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_ama_questions ENABLE ROW LEVEL SECURITY;

-- Events Policies
DROP POLICY IF EXISTS "Anyone can view community events" ON public.community_events;
CREATE POLICY "Anyone can view community events"
  ON public.community_events
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = community_events.community_id
        AND (c.privacy = 'public' OR c.privacy IS NULL)
    )
    OR
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_events.community_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'member'
    )
  );

DROP POLICY IF EXISTS "Owners and moderators can manage events" ON public.community_events;
CREATE POLICY "Owners and moderators can manage events"
  ON public.community_events
  FOR ALL
  TO authenticated
  USING (
    host_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = community_events.community_id
        AND c.creator_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_events.community_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'moderator')
    )
  );

-- RSVP Policies
DROP POLICY IF EXISTS "Users can read RSVPs" ON public.community_event_rsvps;
CREATE POLICY "Users can read RSVPs"
  ON public.community_event_rsvps FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Members can manage their own RSVP" ON public.community_event_rsvps;
CREATE POLICY "Members can manage their own RSVP"
  ON public.community_event_rsvps
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- AMA Question Policies
DROP POLICY IF EXISTS "Anyone can read AMA questions" ON public.community_ama_questions;
CREATE POLICY "Anyone can read AMA questions"
  ON public.community_ama_questions FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Members can submit AMA questions" ON public.community_ama_questions;
CREATE POLICY "Members can submit AMA questions"
  ON public.community_ama_questions
  FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "Hosts and mods can answer AMA questions" ON public.community_ama_questions;
CREATE POLICY "Hosts and mods can answer AMA questions"
  ON public.community_ama_questions
  FOR UPDATE
  TO authenticated
  USING (
    author_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.community_events e
      WHERE e.id = community_ama_questions.event_id
        AND (e.host_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.community_members cm
          WHERE cm.community_id = e.community_id
            AND cm.user_id = auth.uid()
            AND cm.role IN ('owner', 'moderator')
        ))
    )
  );

NOTIFY pgrst, 'reload schema';
