-- ============================================================
-- Migration: 023_messages_audio_whispers.sql
-- Description: Add audio_url and duration_seconds to messages for Voice Notes & Audio Whispers in Direct Messages
-- ============================================================

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS audio_url TEXT,
  ADD COLUMN IF NOT EXISTS audio_duration INTEGER;

COMMENT ON COLUMN public.messages.audio_url IS 'Public or signed URL to the voice note / audio whisper recorded by the sender.';
COMMENT ON COLUMN public.messages.audio_duration IS 'Audio duration in seconds.';
