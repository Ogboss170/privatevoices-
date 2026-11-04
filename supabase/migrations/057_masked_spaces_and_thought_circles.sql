-- ==============================================================================
-- Migration 057: Masked Spaces & Pinned Thought Topics
-- Enhances public.spaces with:
-- 1. is_masked_allowed: Allows participants to speak under masked personas with DSP pitch shifting
-- 2. pinned_prompt: A central prompt / thought starter pinned to the stage
-- Enhances public.space_participants with:
-- 1. is_masked: Whether the participant is speaking pseudonymously
-- 2. masked_persona: Pseudonym chosen by the speaker (e.g., 'Thoughtful Owl', 'Quiet Thinker')
-- 3. voice_filter: The audio DSP filter selected ('none', 'deep', 'helium', 'robot', 'whisper')
-- ==============================================================================

ALTER TABLE public.spaces
  ADD COLUMN IF NOT EXISTS is_masked_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS pinned_prompt TEXT DEFAULT NULL;

ALTER TABLE public.space_participants
  ADD COLUMN IF NOT EXISTS is_masked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS masked_persona TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS voice_filter TEXT NOT NULL DEFAULT 'none';

CREATE INDEX IF NOT EXISTS idx_spaces_is_masked_allowed ON public.spaces(is_masked_allowed);
CREATE INDEX IF NOT EXISTS idx_space_participants_is_masked ON public.space_participants(is_masked);

COMMENT ON COLUMN public.spaces.is_masked_allowed IS 'Allows participants in this Space to speak using pseudonymous Masked Voices.';
COMMENT ON COLUMN public.spaces.pinned_prompt IS 'Central question or thought prompt pinned at the top of the Space.';
COMMENT ON COLUMN public.space_participants.is_masked IS 'Whether this participant joined or is speaking pseudonymously.';
COMMENT ON COLUMN public.space_participants.masked_persona IS 'The pseudonym for this participant if is_masked is true.';
COMMENT ON COLUMN public.space_participants.voice_filter IS 'Client WebAudio DSP filter preset (none, deep, helium, robot, whisper).';
