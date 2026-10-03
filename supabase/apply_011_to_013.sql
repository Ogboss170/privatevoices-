-- Private Voices: run once in Supabase SQL Editor (project trwraypolgqhkrxlijql). Safe to re-run.


-- ======== 011_post_media_storage.sql ========
-- ============================================================
-- Private Voices â€” Migration 011: Post Media Storage Bucket
-- ============================================================

-- Create public bucket for feed post media attachments if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-media',
  'post-media',
  true,
  15728640, -- 15MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 15728640,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Storage RLS Policies
DROP POLICY IF EXISTS "Authenticated users can upload post media" ON storage.objects;
CREATE POLICY "Authenticated users can upload post media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'post-media');

DROP POLICY IF EXISTS "Anyone can view post media" ON storage.objects;
CREATE POLICY "Anyone can view post media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'post-media');

DROP POLICY IF EXISTS "Users can delete own post media" ON storage.objects;
CREATE POLICY "Users can delete own post media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'post-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ======== 012_hashtag_sync_and_search.sql ========
-- ============================================================
-- Private Voices â€” Migration 012: Hashtags Sync & Discovery
-- ============================================================

-- 1. Ensure RLS policies exist for hashtags & post_hashtags
DROP POLICY IF EXISTS "Hashtags are viewable by everyone" ON public.hashtags;
CREATE POLICY "Hashtags are viewable by everyone"
ON public.hashtags FOR SELECT
USING (TRUE);

DROP POLICY IF EXISTS "Hashtags can be inserted by authenticated" ON public.hashtags;
CREATE POLICY "Hashtags can be inserted by authenticated"
ON public.hashtags FOR INSERT
WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Post hashtags are viewable by everyone" ON public.post_hashtags;
CREATE POLICY "Post hashtags are viewable by everyone"
ON public.post_hashtags FOR SELECT
USING (TRUE);

DROP POLICY IF EXISTS "Post hashtags can be inserted by authenticated" ON public.post_hashtags;
CREATE POLICY "Post hashtags can be inserted by authenticated"
ON public.post_hashtags FOR INSERT
WITH CHECK (TRUE);

-- 2. Function to automatically extract and link #hashtags on post create/update
CREATE OR REPLACE FUNCTION public.sync_post_hashtags()
RETURNS TRIGGER AS $$
DECLARE
  tag_record RECORD;
  tag_text TEXT;
  found_tag_id UUID;
BEGIN
  -- Clear previous associations if updating post content
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM public.post_hashtags WHERE post_id = NEW.id;
  END IF;

  -- Find and link all #hashtags from post content
  IF NEW.content IS NOT NULL AND NEW.content <> '' THEN
    FOR tag_record IN
      SELECT DISTINCT LOWER(m[1]) AS tag
      FROM regexp_matches(NEW.content, '#([A-Za-z0-9_]{2,50})', 'g') AS m
    LOOP
      tag_text := tag_record.tag;
      IF length(tag_text) > 0 THEN
        -- Upsert tag
        INSERT INTO public.hashtags (name)
        VALUES (tag_text)
        ON CONFLICT (LOWER(name)) DO UPDATE SET name = EXCLUDED.name
        RETURNING id INTO found_tag_id;

        IF found_tag_id IS NULL THEN
          SELECT id INTO found_tag_id FROM public.hashtags WHERE LOWER(name) = tag_text LIMIT 1;
        END IF;

        IF found_tag_id IS NOT NULL THEN
          INSERT INTO public.post_hashtags (post_id, hashtag_id)
          VALUES (NEW.id, found_tag_id)
          ON CONFLICT DO NOTHING;
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger on public.posts
DROP TRIGGER IF EXISTS trg_sync_post_hashtags ON public.posts;
CREATE TRIGGER trg_sync_post_hashtags
  AFTER INSERT OR UPDATE OF content ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_post_hashtags();

-- 4. Initial Seed of Popular Privacy Hashtags if empty
INSERT INTO public.hashtags (name)
VALUES
  ('privacy'),
  ('anonymous'),
  ('security'),
  ('freedom'),
  ('tech'),
  ('privatevoices'),
  ('crypto'),
  ('web3')
ON CONFLICT DO NOTHING;

-- ======== 013_interactive_polls.sql ========
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

