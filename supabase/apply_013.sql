-- Private Voices: 013_interactive_polls.sql
-- Run in Supabase SQL Editor (project trwraypolgqhkrxlijql). Safe to re-run.
-- ============================================================
-- Private Voices â€” Migration 013: Interactive Polls & Votes
-- ============================================================

-- 1. Polls Table
CREATE TABLE IF NOT EXISTS public.polls (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  question      TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT polls_post_id_unique UNIQUE (post_id)
);

CREATE INDEX IF NOT EXISTS polls_post_id_idx ON public.polls(post_id);

-- 2. Poll Options Table
CREATE TABLE IF NOT EXISTS public.poll_options (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id       UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_text   TEXT NOT NULL,
  option_order  INT NOT NULL DEFAULT 0,
  vote_count    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS poll_options_poll_id_idx ON public.poll_options(poll_id);

-- 3. Poll Votes Table (Prevent duplicate voting)
CREATE TABLE IF NOT EXISTS public.poll_votes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id       UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_id     UUID NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT poll_votes_user_poll_unique UNIQUE (poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS poll_votes_poll_id_idx ON public.poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS poll_votes_user_id_idx ON public.poll_votes(user_id);

-- 4. Function & Trigger to automatically update vote counts and enforce integrity
CREATE OR REPLACE FUNCTION public.handle_poll_vote()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment vote count on chosen option
  UPDATE public.poll_options
  SET vote_count = vote_count + 1
  WHERE id = NEW.option_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_handle_poll_vote ON public.poll_votes;
CREATE TRIGGER trg_handle_poll_vote
  AFTER INSERT ON public.poll_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_poll_vote();

-- 5. Enable Row Level Security
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- Polls RLS
DROP POLICY IF EXISTS "Polls are viewable by everyone" ON public.polls;
CREATE POLICY "Polls are viewable by everyone"
ON public.polls FOR SELECT
USING (TRUE);

DROP POLICY IF EXISTS "Authenticated users can create polls" ON public.polls;
CREATE POLICY "Authenticated users can create polls"
ON public.polls FOR INSERT
TO authenticated
WITH CHECK (TRUE);

-- Poll Options RLS
DROP POLICY IF EXISTS "Poll options are viewable by everyone" ON public.poll_options;
CREATE POLICY "Poll options are viewable by everyone"
ON public.poll_options FOR SELECT
USING (TRUE);

DROP POLICY IF EXISTS "Authenticated users can create poll options" ON public.poll_options;
CREATE POLICY "Authenticated users can create poll options"
ON public.poll_options FOR INSERT
TO authenticated
WITH CHECK (TRUE);

-- Poll Votes RLS
DROP POLICY IF EXISTS "Poll votes are viewable by everyone" ON public.poll_votes;
CREATE POLICY "Poll votes are viewable by everyone"
ON public.poll_votes FOR SELECT
USING (TRUE);

DROP POLICY IF EXISTS "Users can vote once per poll" ON public.poll_votes;
CREATE POLICY "Users can vote once per poll"
ON public.poll_votes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Enable Realtime for live vote updates
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='poll_options') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_options; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='poll_votes') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes; END IF; END $$;
