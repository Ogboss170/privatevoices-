-- ============================================================
-- Private Voices — Migration 063: Fytro AI Message Feedback & Reports
-- ============================================================

-- Table: fytro_feedback
-- Stores user reactions (like/dislike) and structured feedback on AI messages.
CREATE TABLE IF NOT EXISTS public.fytro_feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  TEXT NOT NULL,
  session_id  UUID REFERENCES public.fytro_sessions(id) ON DELETE SET NULL,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction    TEXT NOT NULL CHECK (reaction IN ('like', 'dislike')),
  reasons     TEXT[] DEFAULT '{}',
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_fytro_feedback_user_message UNIQUE (user_id, message_id)
);

-- Table: fytro_reports
-- Stores user reports on harmful, unsafe, or abusive AI responses.
CREATE TABLE IF NOT EXISTS public.fytro_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  TEXT NOT NULL,
  session_id  UUID REFERENCES public.fytro_sessions(id) ON DELETE SET NULL,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  details     TEXT,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_fytro_feedback_user_msg ON public.fytro_feedback(user_id, message_id);
CREATE INDEX IF NOT EXISTS idx_fytro_feedback_reaction ON public.fytro_feedback(reaction);
CREATE INDEX IF NOT EXISTS idx_fytro_reports_user ON public.fytro_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_fytro_reports_status ON public.fytro_reports(status);

-- Enable Row Level Security
ALTER TABLE public.fytro_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fytro_reports ENABLE ROW LEVEL SECURITY;

-- Feedback Policies:
-- Users can view their own feedback
DROP POLICY IF EXISTS "Users can read own fytro feedback" ON public.fytro_feedback;
CREATE POLICY "Users can read own fytro feedback"
  ON public.fytro_feedback FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own feedback
DROP POLICY IF EXISTS "Users can insert own fytro feedback" ON public.fytro_feedback;
CREATE POLICY "Users can insert own fytro feedback"
  ON public.fytro_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own feedback (e.g. changing reaction or adding reasons)
DROP POLICY IF EXISTS "Users can update own fytro feedback" ON public.fytro_feedback;
CREATE POLICY "Users can update own fytro feedback"
  ON public.fytro_feedback FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own feedback (e.g. untoggling reaction)
DROP POLICY IF EXISTS "Users can delete own fytro feedback" ON public.fytro_feedback;
CREATE POLICY "Users can delete own fytro feedback"
  ON public.fytro_feedback FOR DELETE
  USING (auth.uid() = user_id);

-- Report Policies:
-- Users can read their own reports
DROP POLICY IF EXISTS "Users can read own fytro reports" ON public.fytro_reports;
CREATE POLICY "Users can read own fytro reports"
  ON public.fytro_reports FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create reports
DROP POLICY IF EXISTS "Users can insert own fytro reports" ON public.fytro_reports;
CREATE POLICY "Users can insert own fytro reports"
  ON public.fytro_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);
