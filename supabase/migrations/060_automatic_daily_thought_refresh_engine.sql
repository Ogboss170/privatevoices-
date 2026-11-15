-- ============================================================
-- Private Voices — Migration 060: Automatic Daily Thought Refresh Engine & Extended Curated Pool
-- ============================================================

-- 1. Create a master catalog of evergreen introspective prompts
CREATE TABLE IF NOT EXISTS public.thought_prompt_catalog (
  id SERIAL PRIMARY KEY,
  tag TEXT NOT NULL,
  prompt TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL DEFAULT '💭'
);

-- Enable RLS
ALTER TABLE public.thought_prompt_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read thought catalog" ON public.thought_prompt_catalog;
CREATE POLICY "Public can read thought catalog"
  ON public.thought_prompt_catalog
  FOR SELECT
  USING (true);

-- Seed diverse, deep introspective prompts (30+ evergreen thoughts for guaranteed month-long unique daily cycle)
INSERT INTO public.thought_prompt_catalog (tag, prompt, icon) VALUES
  ('Daily Reflection', 'What is an opinion or perspective you hold that you rarely share out loud?', '💭'),
  ('Curiosity', 'What was a hard lesson you had to learn on your own without anyone warning you?', '🌱'),
  ('Unfiltered Thought', 'If you had zero fear of judgment from friends or colleagues, what would you create or say today?', '🎭'),
  ('Deep Question', 'What is something simple that genuinely brought you peace of mind this week?', '✨'),
  ('Life Reflection', 'What is a piece of common advice that you think is completely wrong or misleading?', '🔍'),
  ('Vulnerability', 'What is something you pretend to understand just to avoid feeling foolish?', '🌊'),
  ('Inner Peace', 'When was the last time you felt truly present and disconnected from technology?', '🍃'),
  ('Growth', 'What version of yourself did you have to let go of to become who you are now?', '🪴'),
  ('Honesty', 'If you could send a one-sentence message to your younger self, what would it say?', '✉️'),
  ('Connection', 'What is a compliment someone gave you years ago that you still remember today?', '🫂'),
  ('Courage', 'What is a boundary you set that was terrifying at the time, but saved your sanity?', '🛡️'),
  ('Authenticity', 'What part of your personality only comes out when you are completely alone?', '🔮'),
  ('Gratitude', 'Who is an unsung person in your life whose presence makes hard days lighter?', '☀️'),
  ('Curiosity', 'What is a question you wish someone would ask you right now?', '❓'),
  ('Wisdom', 'What is a mistake you made that ended up opening the most important door in your life?', '🗝️'),
  ('Self-Discovery', 'What are you tolerating right now that you know you shouldn''t be?', '⏳'),
  ('Mind Space', 'What thought keeps knocking on the door of your mind when you try to sleep?', '🌙'),
  ('Perspective', 'What would change about your life if you stopped worrying about other people''s timelines?', '🧭'),
  ('Emotional Truth', 'What is a grief or disappointment you never allowed yourself to fully process?', '🌧️'),
  ('Simplicity', 'What is a small ritual in your day that makes you feel human again?', '☕'),
  ('Unspoken', 'What is a secret dream you don''t speak aloud because you fear sounding unrealistic?', '🚀'),
  ('Clarity', 'If you had to describe your current season of life in three honest words, what would they be?', '🍂'),
  ('Compassion', 'What is something you need to forgive yourself for this week?', '🕊️'),
  ('Creativity', 'What were you obsessed with doing as a child that you haven''t touched in years?', '🎨'),
  ('Quiet Truth', 'What is the biggest difference between how people perceive you and how you feel inside?', '🪞'),
  ('Ambition', 'Are you currently chasing what you genuinely desire, or what you were told to achieve?', '🏔️'),
  ('Resilience', 'What gave you strength during the hardest month you ever endured?', '⚡'),
  ('Serenity', 'What noise in your life do you need to turn down right now?', '🤫'),
  ('Reflection', 'What is something you used to judge people for, until life taught you better?', '⚖️'),
  ('Hope', 'What is one thing you are quietly looking forward to in the coming weeks?', '🌅')
ON CONFLICT (prompt) DO NOTHING;

-- 2. Function to automatically fetch or initialize today's prompt
-- If today has no prompt in daily_thought_prompts, it deterministically picks one based on today's date
CREATE OR REPLACE FUNCTION public.get_or_create_daily_thought()
RETURNS TABLE (
  id UUID,
  tag TEXT,
  prompt TEXT,
  icon TEXT,
  active_date DATE,
  is_active BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_prompt RECORD;
  v_catalog_count INT;
  v_day_offset INT;
  v_catalog_row RECORD;
  v_inserted_id UUID;
BEGIN
  -- 1. Try to fetch existing active prompt for today
  SELECT p.id, p.tag, p.prompt, p.icon, p.active_date, p.is_active
  INTO v_prompt
  FROM public.daily_thought_prompts p
  WHERE p.active_date = v_today AND p.is_active = TRUE
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v_prompt.id, v_prompt.tag, v_prompt.prompt, v_prompt.icon, v_prompt.active_date, v_prompt.is_active;
    RETURN;
  END IF;

  -- 2. No prompt exists for today — compute deterministic index based on epoch day
  SELECT COUNT(*) INTO v_catalog_count FROM public.thought_prompt_catalog;
  
  IF v_catalog_count IS NULL OR v_catalog_count = 0 THEN
    -- Fallback default
    INSERT INTO public.daily_thought_prompts (tag, prompt, icon, active_date, is_active)
    VALUES ('Daily Reflection', 'What is an opinion or perspective you hold that you rarely share out loud?', '💭', v_today, TRUE)
    RETURNING public.daily_thought_prompts.id INTO v_inserted_id;
    
    RETURN QUERY 
    SELECT v_inserted_id, 'Daily Reflection'::TEXT, 'What is an opinion or perspective you hold that you rarely share out loud?'::TEXT, '💭'::TEXT, v_today, TRUE;
    RETURN;
  END IF;

  -- Deterministic rotation: (days since 2026-01-01) % catalog_count
  v_day_offset := (v_today - DATE '2026-01-01');
  IF v_day_offset < 0 THEN
    v_day_offset := ABS(v_day_offset);
  END IF;

  SELECT c.tag, c.prompt, c.icon
  INTO v_catalog_row
  FROM public.thought_prompt_catalog c
  ORDER BY c.id
  OFFSET (v_day_offset % v_catalog_count)
  LIMIT 1;

  -- Insert today's active prompt
  INSERT INTO public.daily_thought_prompts (tag, prompt, icon, active_date, is_active)
  VALUES (v_catalog_row.tag, v_catalog_row.prompt, v_catalog_row.icon, v_today, TRUE)
  RETURNING public.daily_thought_prompts.id INTO v_inserted_id;

  RETURN QUERY 
  SELECT v_inserted_id, v_catalog_row.tag, v_catalog_row.prompt, v_catalog_row.icon, v_today, TRUE;
END;
$$;

-- Grant execution to public & authenticated users
GRANT EXECUTE ON FUNCTION public.get_or_create_daily_thought() TO anon, authenticated, service_role;
