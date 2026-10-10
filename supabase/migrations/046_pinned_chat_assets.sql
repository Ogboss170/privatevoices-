-- ==============================================================================
-- Migration 046: Pinned Chat Messages & Assets
-- Adds is_pinned and pinned_at to messages table
-- ==============================================================================

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pinned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_pinned ON public.messages(conversation_id, is_pinned);

NOTIFY pgrst, 'reload schema';
