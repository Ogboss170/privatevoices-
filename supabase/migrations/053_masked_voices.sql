-- ============================================================
-- Private Voices — Migration 053: Masked Voices (Pseudonymous Participation)
-- ============================================================

-- Add is_masked and masked_persona to posts
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS is_masked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS masked_persona TEXT DEFAULT NULL;

-- Add is_masked and masked_persona to comments
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS is_masked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS masked_persona TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS posts_is_masked_idx ON public.posts(is_masked);
CREATE INDEX IF NOT EXISTS comments_is_masked_idx ON public.comments(is_masked);

COMMENT ON COLUMN public.posts.is_masked IS 'Indicates if the post was published pseudonymously using Masked Voices.';
COMMENT ON COLUMN public.posts.masked_persona IS 'Public display name pseudonym for the post (e.g. Masked Voice, Thoughtful Owl).';
