-- ============================================================
-- Migration 018: Add Nested Comment Replies Support
-- ============================================================

-- 1. Add parent_id column to public.comments table
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'comments' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE public.comments ADD COLUMN parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. Create index on parent_id for fast reply tree lookups
CREATE INDEX IF NOT EXISTS comments_parent_id_idx ON public.comments(parent_id);
