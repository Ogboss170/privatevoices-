-- ==============================================================================
-- Migration 047: Live Audio Spaces Quick Polls
-- Supports:
-- 1. space_polls (id, space_id, question, created_by, status: 'active' | 'ended', created_at)
-- 2. space_poll_options (id, poll_id, option_text, vote_count)
-- 3. space_poll_votes (id, poll_id, option_id, user_id)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.space_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_space_polls_space ON public.space_polls(space_id);

CREATE TABLE IF NOT EXISTS public.space_poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.space_polls(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  vote_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_space_poll_options_poll ON public.space_poll_options(poll_id);

CREATE TABLE IF NOT EXISTS public.space_poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.space_polls(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES public.space_poll_options(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_space_poll_vote UNIQUE (poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_space_poll_votes_user ON public.space_poll_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_space_poll_votes_poll ON public.space_poll_votes(poll_id);

-- Enable RLS
ALTER TABLE public.space_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_poll_votes ENABLE ROW LEVEL SECURITY;

-- space_polls RLS
DROP POLICY IF EXISTS "Public can view space polls" ON public.space_polls;
CREATE POLICY "Public can view space polls"
  ON public.space_polls FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Hosts and speakers can create space polls" ON public.space_polls;
CREATE POLICY "Hosts and speakers can create space polls"
  ON public.space_polls FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM public.space_participants sp
      WHERE sp.space_id = space_polls.space_id
        AND sp.user_id = auth.uid()
        AND sp.role IN ('host', 'speaker')
    )
  );

DROP POLICY IF EXISTS "Hosts can update space polls" ON public.space_polls;
CREATE POLICY "Hosts can update space polls"
  ON public.space_polls FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM public.spaces s
      WHERE s.id = space_polls.space_id AND s.host_id = auth.uid()
    )
  );

-- space_poll_options RLS
DROP POLICY IF EXISTS "Public can view space poll options" ON public.space_poll_options;
CREATE POLICY "Public can view space poll options"
  ON public.space_poll_options FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Poll creator can insert options" ON public.space_poll_options;
CREATE POLICY "Poll creator can insert options"
  ON public.space_poll_options FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.space_polls sp
      WHERE sp.id = space_poll_options.poll_id AND sp.created_by = auth.uid()
    )
  );

-- space_poll_votes RLS
DROP POLICY IF EXISTS "Public can view poll votes" ON public.space_poll_votes;
CREATE POLICY "Public can view poll votes"
  ON public.space_poll_votes FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Participants can cast votes" ON public.space_poll_votes;
CREATE POLICY "Participants can cast votes"
  ON public.space_poll_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Vote count auto-increment function
CREATE OR REPLACE FUNCTION public.handle_space_poll_vote()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.space_poll_options
  SET vote_count = vote_count + 1
  WHERE id = NEW.option_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_space_poll_vote ON public.space_poll_votes;
CREATE TRIGGER trg_space_poll_vote
  AFTER INSERT ON public.space_poll_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_space_poll_vote();

-- Realtime publications
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.space_polls;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.space_poll_options;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.space_poll_votes;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

NOTIFY pgrst, 'reload schema';
