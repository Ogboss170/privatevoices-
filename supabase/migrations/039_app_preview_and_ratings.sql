-- Migration 039: App Preview Features, Task Tracking, Ratings & Feedback
-- Safe, idempotent migration for:
-- 1. preview_features: Real upcoming features with statuses ('coming_soon', 'available_for_preview', 'testing', 'released')
-- 2. preview_task_completions: Server-side task completion tracking per user
-- 3. app_ratings: 5-star ratings with optional reviews and review editing
-- 4. Server-side validation RPCs: preview enrollment, task completion, badge auto-qualification, and rating submissions

-- ─── 1. PREVIEW FEATURES TABLE ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.preview_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'coming_soon' CHECK (status IN ('coming_soon', 'available_for_preview', 'testing', 'released')),
  category TEXT NOT NULL DEFAULT 'core' CHECK (category IN ('core', 'audio', 'whispers', 'community', 'security', 'reels', 'premium', 'livestream', 'media')),
  demo_url TEXT,
  badge_highlight TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_preview_features_status ON public.preview_features(status);
CREATE INDEX IF NOT EXISTS idx_preview_features_order ON public.preview_features(sort_order);

ALTER TABLE public.preview_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Preview features are viewable by all users" ON public.preview_features;
CREATE POLICY "Preview features are viewable by all users"
  ON public.preview_features FOR SELECT
  TO public
  USING (is_active = TRUE OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE));

DROP POLICY IF EXISTS "Admins can manage preview features" ON public.preview_features;
CREATE POLICY "Admins can manage preview features"
  ON public.preview_features FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- Seed real Private Voices feature roadmap
INSERT INTO public.preview_features (title, slug, description, status, category, badge_highlight, sort_order)
VALUES
  (
    'Encrypted Audio Whispers & Waveform Scrubbing',
    'audio-whispers',
    'Real-time voice notes with scrubbable waveforms, background playback handling, and cryptographic disassociation.',
    'available_for_preview',
    'audio',
    'Beta Tester',
    1
  ),
  (
    'Live Presence & Typing Indicators',
    'realtime-presence',
    'Supabase Realtime broadcast channels showing live typing bubbles and active online status badges in 1-on-1 chats.',
    'available_for_preview',
    'whispers',
    'Early Supporter',
    2
  ),
  (
    'Creator Post Analytics & Growth Insights',
    'creator-analytics',
    'Real-time impression counters, unique listener metrics, and community engagement trends calculated with security invoker.',
    'testing',
    'community',
    'Early Supporter',
    3
  ),
  (
    'Native Background Push Notifications (APNs & FCM)',
    'push-notifications',
    'Instant device delivery for whispers, direct chats, mentions, and community announcements via Expo Notification infrastructure.',
    'coming_soon',
    'core',
    'Beta Tester',
    4
  ),
  (
    'Private Voices Reels & Short-Form Video',
    'voice-reels',
    'Vertical, full-screen immersive video reels paired with encrypted audio tracks, audio filters, and creator tagging.',
    'coming_soon',
    'reels',
    'Beta Tester',
    5
  ),
  (
    'Premium Subscriptions & Exclusive Creator Circles',
    'premium-memberships',
    'Private supporter tiers, subscriber-only voice drops, verified creator badges, and high-fidelity lossless audio streaming.',
    'coming_soon',
    'premium',
    'Early Supporter',
    6
  ),
  (
    'Interactive Audio & Video Live Streaming',
    'live-stream',
    'Low-latency interactive live broadcasts with real-time audience voice call-ins, live chat bubbles, and creator host rooms.',
    'coming_soon',
    'livestream',
    'Beta Tester',
    7
  )
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  category = EXCLUDED.category,
  badge_highlight = EXCLUDED.badge_highlight,
  sort_order = EXCLUDED.sort_order;

-- ─── 2. PREVIEW TASK COMPLETIONS TABLE ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.preview_task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.preview_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.preview_programs(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  proof_notes TEXT,
  CONSTRAINT uq_user_task_completion UNIQUE (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_preview_task_comp_user ON public.preview_task_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_preview_task_comp_prog ON public.preview_task_completions(program_id);

ALTER TABLE public.preview_task_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own task completions or admins view all" ON public.preview_task_completions;
CREATE POLICY "Users can view own task completions or admins view all"
  ON public.preview_task_completions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- Seed default testing tasks for Genesis Preview if empty
DO $$
DECLARE
  v_prog_id UUID;
BEGIN
  SELECT id INTO v_prog_id FROM public.preview_programs WHERE slug = 'genesis-preview' LIMIT 1;
  IF v_prog_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.preview_tasks WHERE program_id = v_prog_id) THEN
      INSERT INTO public.preview_tasks (program_id, title, description, task_type, sort_order)
      VALUES
        (
          v_prog_id,
          'Test Encrypted Voice Note & Waveform Scrubbing',
          'Send a voice note in direct chat, toggle speed between 1x, 1.5x, and 2x, and scrub along the waveform.',
          'feature_testing',
          1
        ),
        (
          v_prog_id,
          'Verify Realtime Typing Indicator',
          'Exchange messages with a partner in chat and confirm the typing bubble appears within 1.5 seconds.',
          'ux_feedback',
          2
        ),
        (
          v_prog_id,
          'Test Community Discussion & Comment Likes',
          'Post a comment inside any community and like a nested reply without refreshing the feed.',
          'feature_testing',
          3
        );
    END IF;
  END IF;
END $$;

-- ─── 3. APP RATINGS & REVIEWS TABLE ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  platform TEXT NOT NULL DEFAULT 'web' CHECK (platform IN ('web', 'ios', 'android')),
  app_version TEXT NOT NULL DEFAULT '1.0.4',
  device_info JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'reviewed', 'flagged', 'hidden')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_user_app_rating UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_app_ratings_user ON public.app_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_app_ratings_rating ON public.app_ratings(rating);
CREATE INDEX IF NOT EXISTS idx_app_ratings_created_at ON public.app_ratings(created_at);

ALTER TABLE public.app_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view non-hidden ratings" ON public.app_ratings;
CREATE POLICY "Public can view non-hidden ratings"
  ON public.app_ratings FOR SELECT
  TO public
  USING (status IN ('published', 'reviewed') OR user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE));

DROP POLICY IF EXISTS "Users can insert own rating" ON public.app_ratings;
CREATE POLICY "Users can insert own rating"
  ON public.app_ratings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own rating" ON public.app_ratings;
CREATE POLICY "Users can update own rating"
  ON public.app_ratings FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all ratings" ON public.app_ratings;
CREATE POLICY "Admins can manage all ratings"
  ON public.app_ratings FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- ─── 4. SECURE STORED PROCEDURES & RPCs ────────────────────────────────────────

-- RPC: Join or Leave Preview Program
CREATE OR REPLACE FUNCTION public.toggle_preview_program_membership(p_program_id UUID, p_join BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_is_banned BOOLEAN;
  v_prog_status TEXT;
  v_participant RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'UNAUTHENTICATED');
  END IF;

  -- Verify user is not banned or suspended
  SELECT is_banned INTO v_is_banned FROM public.profiles WHERE id = v_user_id;
  IF v_is_banned IS TRUE THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'ACCOUNT_RESTRICTED');
  END IF;

  SELECT status INTO v_prog_status FROM public.preview_programs WHERE id = p_program_id;
  IF v_prog_status IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'PROGRAM_NOT_FOUND');
  END IF;

  IF v_prog_status NOT IN ('open', 'active') AND p_join IS TRUE THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'PROGRAM_NOT_OPEN');
  END IF;

  IF p_join IS TRUE THEN
    INSERT INTO public.preview_participants (
      program_id, user_id, status, tasks_completed, valid_feedback_count
    ) VALUES (
      p_program_id, v_user_id, 'registered', 0, 0
    )
    ON CONFLICT (program_id, user_id) DO UPDATE SET
      status = CASE 
        WHEN preview_participants.status = 'disqualified' THEN 'disqualified'
        ELSE 'active'
      END,
      updated_at = timezone('utc'::text, now())
    RETURNING * INTO v_participant;

    RETURN jsonb_build_object('success', TRUE, 'action', 'joined', 'participant', row_to_json(v_participant));
  ELSE
    DELETE FROM public.preview_participants
    WHERE program_id = p_program_id AND user_id = v_user_id;

    RETURN jsonb_build_object('success', TRUE, 'action', 'left');
  END IF;
END;
$$;

-- RPC: Complete a Preview Task Server-Side
CREATE OR REPLACE FUNCTION public.complete_preview_task(p_task_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_task RECORD;
  v_participant RECORD;
  v_completed_count INT;
  v_min_tasks INT;
  v_min_feedback INT;
  v_should_qualify BOOLEAN := FALSE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_task FROM public.preview_tasks WHERE id = p_task_id AND is_active = TRUE;
  IF v_task.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'TASK_NOT_FOUND');
  END IF;

  SELECT * INTO v_participant FROM public.preview_participants
  WHERE program_id = v_task.program_id AND user_id = v_user_id;

  IF v_participant.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'NOT_ENROLLED_IN_PROGRAM');
  END IF;

  IF v_participant.status = 'disqualified' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'PARTICIPANT_DISQUALIFIED');
  END IF;

  -- Insert task completion (prevents duplicates via unique constraint)
  INSERT INTO public.preview_task_completions (
    task_id, user_id, program_id, proof_notes
  ) VALUES (
    p_task_id, v_user_id, v_task.program_id, p_notes
  )
  ON CONFLICT (task_id, user_id) DO NOTHING;

  -- Count total completed tasks for user in this program
  SELECT COUNT(*) INTO v_completed_count
  FROM public.preview_task_completions
  WHERE program_id = v_task.program_id AND user_id = v_user_id;

  -- Update participant counter
  UPDATE public.preview_participants
  SET tasks_completed = v_completed_count,
      status = 'active',
      updated_at = timezone('utc'::text, now())
  WHERE program_id = v_task.program_id AND user_id = v_user_id;

  -- Check if user now meets Early Supporter qualification
  SELECT min_tasks_required, min_valid_feedback_required
  INTO v_min_tasks, v_min_feedback
  FROM public.preview_programs
  WHERE id = v_task.program_id;

  IF v_completed_count >= COALESCE(v_min_tasks, 1) AND v_participant.valid_feedback_count >= COALESCE(v_min_feedback, 1) THEN
    v_should_qualify := TRUE;
    UPDATE public.preview_participants
    SET status = 'eligible'
    WHERE program_id = v_task.program_id AND user_id = v_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'tasksCompleted', v_completed_count,
    'isEligible', v_should_qualify
  );
END;
$$;

-- RPC: Submit or Update App Rating
CREATE OR REPLACE FUNCTION public.submit_app_rating(
  p_rating INT,
  p_review TEXT DEFAULT NULL,
  p_is_anonymous BOOLEAN DEFAULT FALSE,
  p_platform TEXT DEFAULT 'web',
  p_device_info JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_is_banned BOOLEAN;
  v_result RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'UNAUTHENTICATED');
  END IF;

  IF p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'INVALID_RATING_VALUE');
  END IF;

  SELECT is_banned INTO v_is_banned FROM public.profiles WHERE id = v_user_id;
  IF v_is_banned IS TRUE THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'ACCOUNT_RESTRICTED');
  END IF;

  INSERT INTO public.app_ratings (
    user_id, rating, review, is_anonymous, platform, device_info, status, updated_at
  ) VALUES (
    v_user_id, p_rating, p_review, p_is_anonymous, p_platform, p_device_info, 'published', timezone('utc'::text, now())
  )
  ON CONFLICT (user_id) DO UPDATE SET
    rating = EXCLUDED.rating,
    review = EXCLUDED.review,
    is_anonymous = EXCLUDED.is_anonymous,
    platform = EXCLUDED.platform,
    device_info = EXCLUDED.device_info,
    updated_at = timezone('utc'::text, now())
  RETURNING * INTO v_result;

  RETURN jsonb_build_object(
    'success', TRUE,
    'rating', row_to_json(v_result)
  );
END;
$$;

-- RPC: Get Aggregate Rating Summary (Genuine metrics calculated directly from records)
CREATE OR REPLACE FUNCTION public.get_app_rating_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_count INT := 0;
  v_avg_score NUMERIC := 0;
  v_count_5 INT := 0;
  v_count_4 INT := 0;
  v_count_3 INT := 0;
  v_count_2 INT := 0;
  v_count_1 INT := 0;
BEGIN
  SELECT
    COUNT(*),
    COALESCE(ROUND(AVG(rating)::numeric, 1), 0),
    COUNT(*) FILTER (WHERE rating = 5),
    COUNT(*) FILTER (WHERE rating = 4),
    COUNT(*) FILTER (WHERE rating = 3),
    COUNT(*) FILTER (WHERE rating = 2),
    COUNT(*) FILTER (WHERE rating = 1)
  INTO
    v_total_count,
    v_avg_score,
    v_count_5,
    v_count_4,
    v_count_3,
    v_count_2,
    v_count_1
  FROM public.app_ratings
  WHERE status IN ('published', 'reviewed');

  RETURN jsonb_build_object(
    'totalReviews', v_total_count,
    'averageRating', v_avg_score,
    'distribution', jsonb_build_object(
      '5', v_count_5,
      '4', v_count_4,
      '3', v_count_3,
      '2', v_count_2,
      '1', v_count_1
    )
  );
END;
$$;
