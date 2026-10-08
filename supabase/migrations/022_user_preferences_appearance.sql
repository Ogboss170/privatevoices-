-- ============================================================
-- Migration: Appearance & Accessibility Preferences
-- Enables cloud syncing for Appearance settings across devices
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id           UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  theme             TEXT NOT NULL DEFAULT 'system',
  language          TEXT NOT NULL DEFAULT 'en',
  reduce_motion     BOOLEAN NOT NULL DEFAULT FALSE,
  high_contrast     BOOLEAN NOT NULL DEFAULT FALSE,
  compact_mode      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Policies: users can read & manage only their own preferences
CREATE POLICY "Users can read own preferences"
  ON public.user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON public.user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.user_preferences FOR UPDATE
  USING (auth.uid() = user_id);
