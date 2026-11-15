-- ============================================================
-- Private Voices — Migration 061: Fytro Memory Vault (User-Governed Ephemeral & Persistent Cognitive Memory)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fytro_memories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category    TEXT NOT NULL DEFAULT 'perspective' CHECK (category IN ('perspective', 'value', 'dilemma', 'goal', 'context')),
  memory_text TEXT NOT NULL,
  importance  INT NOT NULL DEFAULT 1 CHECK (importance BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User-level index for fast retrieval during chat context assembly
CREATE INDEX IF NOT EXISTS idx_fytro_memories_user_id ON public.fytro_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_fytro_memories_created_at ON public.fytro_memories(created_at DESC);

-- Enable RLS
ALTER TABLE public.fytro_memories ENABLE ROW LEVEL SECURITY;

-- 1. Users can ONLY read their own memories
DROP POLICY IF EXISTS "Users can read own fytro memories" ON public.fytro_memories;
CREATE POLICY "Users can read own fytro memories"
  ON public.fytro_memories
  FOR SELECT
  USING (auth.uid() = user_id);

-- 2. Users can insert memories
DROP POLICY IF EXISTS "Users can insert own fytro memories" ON public.fytro_memories;
CREATE POLICY "Users can insert own fytro memories"
  ON public.fytro_memories
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 3. Users can update their memories
DROP POLICY IF EXISTS "Users can update own fytro memories" ON public.fytro_memories;
CREATE POLICY "Users can update own fytro memories"
  ON public.fytro_memories
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 4. Users can delete individual memories
DROP POLICY IF EXISTS "Users can delete own fytro memories" ON public.fytro_memories;
CREATE POLICY "Users can delete own fytro memories"
  ON public.fytro_memories
  FOR DELETE
  USING (auth.uid() = user_id);

-- 5. RPC function: Instant Total Burn (Wipe all memories for current user)
CREATE OR REPLACE FUNCTION public.burn_fytro_memories()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM public.fytro_memories
  WHERE user_id = auth.uid();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.burn_fytro_memories() TO authenticated;
