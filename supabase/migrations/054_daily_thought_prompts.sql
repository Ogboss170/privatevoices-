-- ============================================================
-- Private Voices — Migration 054: Daily Thought Starters & Admin Management
-- ============================================================

CREATE TABLE IF NOT EXISTS public.daily_thought_prompts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag         TEXT NOT NULL DEFAULT 'Daily Reflection',
  prompt      TEXT NOT NULL,
  icon        TEXT NOT NULL DEFAULT '💭',
  active_date DATE DEFAULT CURRENT_DATE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_thought_prompts_active_date 
  ON public.daily_thought_prompts(active_date);

CREATE INDEX IF NOT EXISTS idx_daily_thought_prompts_is_active 
  ON public.daily_thought_prompts(is_active);

-- Enable RLS
ALTER TABLE public.daily_thought_prompts ENABLE ROW LEVEL SECURITY;

-- Everyone can read active prompts
DROP POLICY IF EXISTS "Anyone can read active prompts" ON public.daily_thought_prompts;
CREATE POLICY "Anyone can read active prompts" 
  ON public.daily_thought_prompts 
  FOR SELECT 
  USING (is_active = TRUE);

-- Only admins can insert, update, or delete prompts
DROP POLICY IF EXISTS "Admins can manage prompts" ON public.daily_thought_prompts;
CREATE POLICY "Admins can manage prompts" 
  ON public.daily_thought_prompts 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Seed initial starter prompts
INSERT INTO public.daily_thought_prompts (tag, prompt, icon, active_date, is_active)
VALUES 
  ('Daily Reflection', 'What is an opinion or perspective you hold that you rarely share out loud?', '💭', CURRENT_DATE, TRUE),
  ('Curiosity', 'What was a hard lesson you had to learn on your own without anyone warning you?', '🌱', CURRENT_DATE + INTERVAL '1 day', TRUE),
  ('Unfiltered Thought', 'If you had zero fear of judgment from friends or colleagues, what would you create or say today?', '🎭', CURRENT_DATE + INTERVAL '2 days', TRUE),
  ('Deep Question', 'What is something simple that genuinely brought you peace of mind this week?', '✨', CURRENT_DATE + INTERVAL '3 days', TRUE),
  ('Life Reflection', 'What is a piece of common advice that you think is completely wrong or misleading?', '🔍', CURRENT_DATE + INTERVAL '4 days', TRUE)
ON CONFLICT DO NOTHING;
