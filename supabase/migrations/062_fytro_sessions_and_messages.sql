-- ============================================================
-- Private Voices — Migration 062: Fytro Sessions & Messages (Multi-Session Chat History)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fytro_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'New Exploration',
  mode        TEXT NOT NULL DEFAULT 'sanctuary' CHECK (mode IN ('sanctuary', 'challenger', 'creative', 'shield')),
  pinned      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fytro_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES public.fytro_sessions(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_fytro_sessions_user ON public.fytro_sessions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_fytro_messages_session ON public.fytro_messages(session_id, created_at ASC);

-- Enable RLS
ALTER TABLE public.fytro_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fytro_messages ENABLE ROW LEVEL SECURITY;

-- Session Policies
DROP POLICY IF EXISTS "Users can read own fytro sessions" ON public.fytro_sessions;
CREATE POLICY "Users can read own fytro sessions"
  ON public.fytro_sessions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own fytro sessions" ON public.fytro_sessions;
CREATE POLICY "Users can insert own fytro sessions"
  ON public.fytro_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own fytro sessions" ON public.fytro_sessions;
CREATE POLICY "Users can update own fytro sessions"
  ON public.fytro_sessions FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own fytro sessions" ON public.fytro_sessions;
CREATE POLICY "Users can delete own fytro sessions"
  ON public.fytro_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Message Policies
DROP POLICY IF EXISTS "Users can read own fytro messages" ON public.fytro_messages;
CREATE POLICY "Users can read own fytro messages"
  ON public.fytro_messages FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own fytro messages" ON public.fytro_messages;
CREATE POLICY "Users can insert own fytro messages"
  ON public.fytro_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own fytro messages" ON public.fytro_messages;
CREATE POLICY "Users can delete own fytro messages"
  ON public.fytro_messages FOR DELETE
  USING (auth.uid() = user_id);
