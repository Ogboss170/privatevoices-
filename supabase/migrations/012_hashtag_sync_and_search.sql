-- ============================================================
-- Private Voices — Migration 012: Hashtags Sync & Discovery
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
