-- ==============================================================================
-- Migration 045: Live Audio Spaces & Group Voice Lounges
-- Supports:
-- 1. spaces (title, topic, host_id, community_id, status: 'live'|'ended', started_at, ended_at)
-- 2. space_participants (space_id, user_id, role: 'host'|'speaker'|'listener', hand_raised: boolean, is_muted: boolean, joined_at)
-- 3. RLS policies allowing authenticated users to discover spaces, participate, speak, or listen
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  topic TEXT,
  host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  community_id UUID REFERENCES public.communities(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'ended')),
  speaker_count INT NOT NULL DEFAULT 1,
  listener_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_spaces_status ON public.spaces(status);
CREATE INDEX IF NOT EXISTS idx_spaces_host ON public.spaces(host_id);
CREATE INDEX IF NOT EXISTS idx_spaces_community ON public.spaces(community_id);

CREATE TABLE IF NOT EXISTS public.space_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'listener' CHECK (role IN ('host', 'speaker', 'listener')),
  hand_raised BOOLEAN NOT NULL DEFAULT FALSE,
  is_muted BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_space_participant UNIQUE (space_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_space_participants_space ON public.space_participants(space_id);
CREATE INDEX IF NOT EXISTS idx_space_participants_user ON public.space_participants(user_id);

-- Enable RLS
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_participants ENABLE ROW LEVEL SECURITY;

-- Spaces RLS
DROP POLICY IF EXISTS "Public can view spaces" ON public.spaces;
CREATE POLICY "Public can view spaces"
  ON public.spaces FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can create spaces" ON public.spaces;
CREATE POLICY "Authenticated users can create spaces"
  ON public.spaces FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Host can update space" ON public.spaces;
CREATE POLICY "Host can update space"
  ON public.spaces FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_id);

-- Space Participants RLS
DROP POLICY IF EXISTS "Public can view space participants" ON public.space_participants;
CREATE POLICY "Public can view space participants"
  ON public.space_participants FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can join or update own participation" ON public.space_participants;
CREATE POLICY "Users can join or update own participation"
  ON public.space_participants FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users or hosts can update participation" ON public.space_participants;
CREATE POLICY "Users or hosts can update participation"
  ON public.space_participants FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.spaces s
      WHERE s.id = space_participants.space_id AND s.host_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users or hosts can leave/remove participants" ON public.space_participants;
CREATE POLICY "Users or hosts can leave/remove participants"
  ON public.space_participants FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.spaces s
      WHERE s.id = space_participants.space_id AND s.host_id = auth.uid()
    )
  );

-- Realtime publication for spaces & participants
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.spaces;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.space_participants;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

NOTIFY pgrst, 'reload schema';
