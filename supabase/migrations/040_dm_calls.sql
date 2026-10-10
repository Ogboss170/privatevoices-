-- ==============================================================================
-- Migration 040: Direct Message Voice & Video Calling Logs
-- Safe, idempotent tracking for 1-on-1 audio/video calls in Direct Messages
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.dm_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  caller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  call_type TEXT NOT NULL CHECK (call_type IN ('audio', 'video')),
  status TEXT NOT NULL DEFAULT 'ended' CHECK (status IN ('connected', 'missed', 'declined', 'cancelled', 'ended')),
  duration_seconds INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_dm_call_logs_conv ON public.dm_call_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_dm_call_logs_caller ON public.dm_call_logs(caller_id);
CREATE INDEX IF NOT EXISTS idx_dm_call_logs_receiver ON public.dm_call_logs(receiver_id);
CREATE INDEX IF NOT EXISTS idx_dm_call_logs_created_at ON public.dm_call_logs(created_at);

ALTER TABLE public.dm_call_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view call logs for their conversations" ON public.dm_call_logs;
CREATE POLICY "Users can view call logs for their conversations"
  ON public.dm_call_logs FOR SELECT
  TO authenticated
  USING (caller_id = auth.uid() OR receiver_id = auth.uid());

DROP POLICY IF EXISTS "Participants can log DM calls" ON public.dm_call_logs;
CREATE POLICY "Participants can log DM calls"
  ON public.dm_call_logs FOR INSERT
  TO authenticated
  WITH CHECK (caller_id = auth.uid() OR receiver_id = auth.uid());
