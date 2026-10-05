-- ============================================================
-- Private Voices — Migration 019: Nested Comments Support
-- Add parent_id column to public.comments to support nested replies
-- ============================================================

ALTER TABLE public.comments 
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS comments_parent_id_idx ON public.comments(parent_id);
