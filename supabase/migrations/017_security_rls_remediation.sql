-- ============================================================
-- Private Voices — Migration 017: Security RLS Remediation
-- Apply in Supabase SQL Editor to fix all critical policy gaps
-- ============================================================

-- ─── 1. HASHTAGS ─────────────────────────────────────────────────────────────
-- RLS was enabled but no policies existed — all reads/writes were silently blocked.
CREATE POLICY "Hashtags viewable by everyone"
  ON public.hashtags FOR SELECT USING (TRUE);

CREATE POLICY "Authenticated users can create hashtags"
  ON public.hashtags FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Post hashtags viewable by everyone"
  ON public.post_hashtags FOR SELECT USING (TRUE);

CREATE POLICY "Authenticated users can tag posts"
  ON public.post_hashtags FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ─── 2. CONVERSATIONS — Missing UPDATE ───────────────────────────────────────
-- Needed so last_message / last_message_at updates when messages are sent.
CREATE POLICY "Participants can update conversations"
  ON public.conversations FOR UPDATE
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- ─── 3. MESSAGES — Missing DELETE ────────────────────────────────────────────
CREATE POLICY "Senders can delete own messages"
  ON public.messages FOR DELETE
  USING (auth.uid() = sender_id);

-- ─── 4. COMMUNITIES — Missing UPDATE / DELETE ─────────────────────────────────
CREATE POLICY "Creators can update community"
  ON public.communities FOR UPDATE
  USING (auth.uid() = creator_id);

CREATE POLICY "Creators can delete community"
  ON public.communities FOR DELETE
  USING (auth.uid() = creator_id);

-- ─── 5. STORIES — Missing UPDATE ─────────────────────────────────────────────
CREATE POLICY "Authors can update own stories"
  ON public.stories FOR UPDATE
  USING (auth.uid() = author_id);

-- ─── 6. CONTENT REPORTS — Missing SELECT ─────────────────────────────────────
-- Reporters can view their own submitted reports.
CREATE POLICY "Reporters can view own reports"
  ON public.content_reports FOR SELECT
  USING (auth.uid() = reporter_id);

-- ─── 7. USER_SUSPENSIONS — Missing all policies ───────────────────────────────
-- Only service role (admin) can insert; no client-level SELECT.
-- Suspended users are checked server-side via service key.
-- We expose nothing to regular users for security.
-- (Admin console uses service_role key, not anon/authenticated)

-- ─── 8. AUDIT_LOGS — Missing all policies ────────────────────────────────────
-- Audit logs are write-only for the service role.
-- Regular authenticated users should never read audit logs.
-- No client-side policies needed — admin uses service key.

-- ─── 9. PROFILES — Explicit INSERT policy ────────────────────────────────────
-- The create_profile() function is SECURITY DEFINER so it bypasses RLS.
-- Adding explicit INSERT policy for safety in case of direct inserts.
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ─── 10. WHISPER SAFETY — Mask sender metadata from recipients ────────────────
-- Recipients should never see raw sender_session_hash or sender_ip_hash.
-- This column-level masking is enforced via a security-definer view.
CREATE OR REPLACE VIEW public.whispers_safe AS
  SELECT
    id,
    recipient_id,
    content,
    reply_content,
    replied_at,
    is_read,
    created_at,
    updated_at
    -- Intentionally omitting: sender_session_hash, sender_ip_hash
  FROM public.whispers;

-- ─── 11. IS_BANNED ADMIN UPDATE ──────────────────────────────────────────────
-- The admin console uses the service_role key directly (bypasses RLS).
-- No additional policy needed, but we document this explicitly:
-- IMPORTANT: The apps/admin dashboard MUST use SUPABASE_SERVICE_ROLE_KEY
-- and NOT the anon key. Never expose service_role key to the browser.

-- ─── DONE ─────────────────────────────────────────────────────────────────────
-- Run this migration in Supabase SQL Editor to apply all security patches.
