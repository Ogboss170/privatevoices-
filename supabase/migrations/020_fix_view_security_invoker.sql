-- ============================================================
-- Private Voices — Migration 020: Fix View Security Definer Warning
-- Enable security_invoker = true on public.whispers_safe
-- so it respects the querying user's RLS policies
-- ============================================================

ALTER VIEW public.whispers_safe SET (security_invoker = true);
