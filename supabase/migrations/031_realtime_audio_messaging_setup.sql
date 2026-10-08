-- ==============================================================================
-- Migration: Add Audio Whisper Support to Direct Messages & Realtime Publications
-- Ensures public.messages table has audio_url and audio_duration columns,
-- and that both messages and whispers are active in Supabase Realtime publication.
-- ==============================================================================

-- 1. Ensure audio columns exist on public.messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS audio_url TEXT,
  ADD COLUMN IF NOT EXISTS audio_duration INTEGER;

COMMENT ON COLUMN public.messages.audio_url IS 'Public URL to the voice note / audio whisper recorded by the sender.';
COMMENT ON COLUMN public.messages.audio_duration IS 'Audio duration in seconds.';

-- 2. Ensure chat-media storage bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media',
  'chat-media',
  true,
  20971520, -- 20MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'audio/m4a', 'audio/mp4', 'audio/webm', 'audio/ogg', 'audio/x-caf', 'audio/mpeg']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'audio/m4a', 'audio/mp4', 'audio/webm', 'audio/ogg', 'audio/x-caf', 'audio/mpeg'];

-- 3. Storage RLS policies for chat-media
DROP POLICY IF EXISTS "Authenticated users can upload chat media" ON storage.objects;
CREATE POLICY "Authenticated users can upload chat media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "Anyone can view chat media" ON storage.objects;
CREATE POLICY "Anyone can view chat media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "Users can delete own chat media" ON storage.objects;
CREATE POLICY "Users can delete own chat media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 4. Ensure Realtime Publication includes messages, conversations, and whispers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'whispers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whispers;
  END IF;
END $$;
