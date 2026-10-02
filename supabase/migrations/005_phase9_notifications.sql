-- ============================================================
-- Private Voices — Phase 9 Central Notification System Database Schema
-- ============================================================

CREATE TYPE notification_type AS ENUM (
  'like',
  'comment',
  'follow',
  'mention',
  'message',
  'whisper',
  'community_activity',
  'system'
);

CREATE TABLE public.notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type          notification_type NOT NULL,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  target_url    TEXT,
  is_read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX notifications_user_id_idx ON public.notifications(user_id);
CREATE INDEX notifications_created_at_idx ON public.notifications(created_at DESC);

-- ─── PUSH TOKENS (For Expo Push Notifications) ───────────────────────────
CREATE TABLE public.user_push_tokens (
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  device_type   TEXT, -- 'ios', 'android', 'web'
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, expo_push_token)
);

CREATE INDEX user_push_tokens_user_id_idx ON public.user_push_tokens(user_id);

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

-- Notifications RLS: Users can view and manage their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE USING (auth.uid() = user_id);

-- User Push Tokens RLS: Users can manage their push tokens
CREATE POLICY "Users can view own push tokens" ON public.user_push_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own push tokens" ON public.user_push_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own push tokens" ON public.user_push_tokens FOR DELETE USING (auth.uid() = user_id);
