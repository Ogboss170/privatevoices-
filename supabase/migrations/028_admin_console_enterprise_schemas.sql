-- ==============================================================================
-- Migration 028: Enterprise Admin Console Schema & Governance Engine
-- Supports:
--  1. Granular Admin RBAC (SUPER_ADMIN, ADMIN, MODERATOR, SUPPORT, PREVIEW_REVIEWER)
--  2. Preview Program Management (Programs, Tasks, Participants, Feedback)
--  3. Badges Governance (Verified, Early Supporter, Beta Tester)
--  4. Appeals Queue (Appeals for Moderation & Banned accounts)
--  5. Append-Only Admin Audit Logging with Tamper-Resistant RLS & Triggers
-- ==============================================================================

-- ─── 1. ADMIN ROLES & STAFF DIRECTORY ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'SUPPORT', 'PREVIEW_REVIEWER')),
  assigned_by UUID REFERENCES public.profiles(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  notes TEXT,
  CONSTRAINT uq_admin_user_role UNIQUE(user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_admin_roles_user ON public.admin_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_roles_role ON public.admin_roles(role);

ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin roles readable by admins"
  ON public.admin_roles FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- ─── 2. APPEND-ONLY ADMIN AUDIT LOGS ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON public.admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target ON public.admin_audit_logs(target_type, target_id);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Audit logs readable by admins"
  ON public.admin_audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Audit logs insertable by admins"
  ON public.admin_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Prevent update or deletion of audit logs (Tamper-proof)
CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit log records are immutable and append-only.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_mutation ON public.admin_audit_logs;
CREATE TRIGGER trg_prevent_audit_log_mutation
  BEFORE UPDATE OR DELETE ON public.admin_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_mutation();

-- ─── 3. BADGE DEFINITIONS & USER BADGES ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.badge_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('verification', 'preview', 'testing', 'community', 'special')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Seed core badges
INSERT INTO public.badge_definitions (id, name, description, icon, category)
VALUES
  ('verified', 'Verified Account', 'Official identity verified by Private Voices Trust & Safety.', 'ShieldCheck', 'verification'),
  ('early_supporter', 'Early Supporter', 'Permanent distinction awarded to pioneering participants of the Private Voices Preview Program.', 'Sparkles', 'preview'),
  ('beta_tester', 'Beta Tester', 'Distinction awarded for rigorous testing and valid feedback during preview cycles.', 'Bug', 'testing')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon;

CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL REFERENCES public.badge_definitions(id) ON DELETE RESTRICT,
  awarded_by UUID REFERENCES public.profiles(id),
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'preview_program', 'system_automated', 'verification_workflow')),
  program_id UUID,
  revocation_reason TEXT,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES public.profiles(id),
  CONSTRAINT uq_user_active_badge UNIQUE (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON public.user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge ON public.user_badges(badge_id);

ALTER TABLE public.badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Badge definitions are publicly readable"
  ON public.badge_definitions FOR SELECT
  TO authenticated, anon
  USING (TRUE);

CREATE POLICY "User badges are publicly readable"
  ON public.user_badges FOR SELECT
  TO authenticated, anon
  USING (revoked_at IS NULL);

-- ─── 4. PREVIEW PROGRAM MANAGEMENT TABLES ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.preview_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  rules TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'paused', 'closed', 'finalized')),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  registration_deadline TIMESTAMPTZ,
  min_tasks_required INT NOT NULL DEFAULT 1,
  min_valid_feedback_required INT NOT NULL DEFAULT 1,
  early_supporter_badge_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  beta_tester_badge_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.preview_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.preview_programs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL DEFAULT 'feature_testing' CHECK (task_type IN ('feature_testing', 'bug_hunt', 'ux_feedback', 'stress_test', 'custom')),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.preview_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.preview_programs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'active', 'eligible', 'completed', 'disqualified')),
  tasks_completed INT NOT NULL DEFAULT 0,
  valid_feedback_count INT NOT NULL DEFAULT 0,
  early_supporter_awarded BOOLEAN NOT NULL DEFAULT FALSE,
  beta_tester_awarded BOOLEAN NOT NULL DEFAULT FALSE,
  internal_notes TEXT,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_preview_participant UNIQUE (program_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.preview_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.preview_programs(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.preview_tasks(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('bug', 'ux', 'performance', 'suggestion', 'security')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  device_info JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'valid', 'duplicate', 'invalid', 'need_info', 'escalated')),
  internal_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_preview_participants_prog ON public.preview_participants(program_id);
CREATE INDEX IF NOT EXISTS idx_preview_participants_user ON public.preview_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_preview_feedback_prog ON public.preview_feedback(program_id);
CREATE INDEX IF NOT EXISTS idx_preview_feedback_status ON public.preview_feedback(status);

ALTER TABLE public.preview_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preview_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preview_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preview_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Preview programs viewable by authenticated users"
  ON public.preview_programs FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Preview tasks viewable by authenticated users"
  ON public.preview_tasks FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Preview participants view own or admins view all"
  ON public.preview_participants FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE));

CREATE POLICY "Preview feedback view own or admins view all"
  ON public.preview_feedback FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- Seed default Beta Preview Program if none exists
INSERT INTO public.preview_programs (title, slug, description, rules, status, min_tasks_required, min_valid_feedback_required)
VALUES (
  'Private Voices Genesis Preview',
  'genesis-preview',
  'Exclusive pioneer preview group testing encrypted whispers, voice reels, and community channels.',
  'Complete at least 1 testing task and submit valid feedback to earn the permanent Early Supporter badge.',
  'open',
  1,
  1
) ON CONFLICT (slug) DO NOTHING;

-- ─── 5. MODERATION APPEALS QUEUE ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.moderation_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('account_ban', 'post_removal', 'strike', 'restriction')),
  target_id TEXT,
  original_decision_summary TEXT,
  appeal_reason TEXT NOT NULL,
  evidence_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_appeals_status ON public.moderation_appeals(status);
CREATE INDEX IF NOT EXISTS idx_appeals_user ON public.moderation_appeals(user_id);

ALTER TABLE public.moderation_appeals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Appeals view own or admins view all"
  ON public.moderation_appeals FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- ─── 6. STORED PROCEDURES & SECURE ADMIN RPCs ────────────────────────────────

-- Award Badge Secure RPC
CREATE OR REPLACE FUNCTION public.admin_award_badge(
  p_user_id UUID,
  p_badge_id TEXT,
  p_reason TEXT,
  p_source TEXT DEFAULT 'manual',
  p_program_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_admin_id UUID;
  v_is_admin BOOLEAN;
  v_badge_exists BOOLEAN;
  v_record_id UUID;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = v_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'UNAUTHORIZED');
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.badge_definitions WHERE id = p_badge_id) INTO v_badge_exists;
  IF NOT v_badge_exists THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'BADGE_DOES_NOT_EXIST');
  END IF;

  -- Insert or reactivate badge
  INSERT INTO public.user_badges (
    user_id, badge_id, awarded_by, source, program_id, revoked_at, revocation_reason, revoked_by
  )
  VALUES (
    p_user_id, p_badge_id, v_admin_id, p_source, p_program_id, NULL, NULL, NULL
  )
  ON CONFLICT (user_id, badge_id) DO UPDATE SET
    revoked_at = NULL,
    revocation_reason = NULL,
    revoked_by = NULL,
    awarded_at = timezone('utc'::text, now()),
    awarded_by = v_admin_id
  RETURNING id INTO v_record_id;

  -- Append audit log
  INSERT INTO public.admin_audit_logs (
    admin_id, action, target_type, target_id, reason, metadata
  ) VALUES (
    v_admin_id, 'BADGE_AWARDED', 'user_badge', p_user_id::text, p_reason,
    jsonb_build_object('badge_id', p_badge_id, 'source', p_source, 'program_id', p_program_id)
  );

  RETURN jsonb_build_object('success', TRUE, 'badge_record_id', v_record_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke Badge Secure RPC
CREATE OR REPLACE FUNCTION public.admin_revoke_badge(
  p_user_id UUID,
  p_badge_id TEXT,
  p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_admin_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = v_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'UNAUTHORIZED');
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'MANDATORY_REASON_REQUIRED');
  END IF;

  UPDATE public.user_badges
  SET revoked_at = timezone('utc'::text, now()),
      revoked_by = v_admin_id,
      revocation_reason = p_reason
  WHERE user_id = p_user_id AND badge_id = p_badge_id AND revoked_at IS NULL;

  -- Append audit log
  INSERT INTO public.admin_audit_logs (
    admin_id, action, target_type, target_id, reason, metadata
  ) VALUES (
    v_admin_id, 'BADGE_REVOKED', 'user_badge', p_user_id::text, p_reason,
    jsonb_build_object('badge_id', p_badge_id)
  );

  RETURN jsonb_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Review Feedback Secure RPC
CREATE OR REPLACE FUNCTION public.admin_review_feedback(
  p_feedback_id UUID,
  p_status TEXT,
  p_internal_notes TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_admin_id UUID;
  v_is_admin BOOLEAN;
  v_user_id UUID;
  v_prog_id UUID;
  v_cat TEXT;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = v_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'UNAUTHORIZED');
  END IF;

  SELECT user_id, program_id, category INTO v_user_id, v_prog_id, v_cat
  FROM public.preview_feedback
  WHERE id = p_feedback_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'NOT_FOUND');
  END IF;

  UPDATE public.preview_feedback
  SET status = p_status,
      internal_notes = p_internal_notes,
      reviewed_by = v_admin_id,
      reviewed_at = timezone('utc'::text, now())
  WHERE id = p_feedback_id;

  -- Recalculate valid feedback for participant
  IF p_status = 'valid' THEN
    UPDATE public.preview_participants
    SET valid_feedback_count = (
      SELECT COUNT(*) FROM public.preview_feedback 
      WHERE program_id = v_prog_id AND user_id = v_user_id AND status = 'valid'
    ),
    updated_at = timezone('utc'::text, now())
    WHERE program_id = v_prog_id AND user_id = v_user_id;
  END IF;

  INSERT INTO public.admin_audit_logs (
    admin_id, action, target_type, target_id, reason, metadata
  ) VALUES (
    v_admin_id, 'FEEDBACK_REVIEWED', 'preview_feedback', p_feedback_id::text, p_internal_notes,
    jsonb_build_object('status', p_status, 'category', v_cat)
  );

  RETURN jsonb_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Review Appeal Secure RPC
CREATE OR REPLACE FUNCTION public.admin_review_appeal(
  p_appeal_id UUID,
  p_status TEXT,
  p_notes TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_admin_id UUID;
  v_is_admin BOOLEAN;
  v_appeal RECORD;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = v_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'UNAUTHORIZED');
  END IF;

  SELECT * INTO v_appeal FROM public.moderation_appeals WHERE id = p_appeal_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'NOT_FOUND');
  END IF;

  UPDATE public.moderation_appeals
  SET status = p_status,
      reviewer_notes = p_notes,
      reviewed_by = v_admin_id,
      reviewed_at = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now())
  WHERE id = p_appeal_id;

  -- If approved and action was account ban, restore user
  IF p_status = 'approved' AND v_appeal.action_type = 'account_ban' THEN
    UPDATE public.profiles SET is_banned = FALSE WHERE id = v_appeal.user_id;
    UPDATE public.email_registry SET status = 'active' WHERE original_user_id = v_appeal.user_id;
  END IF;

  INSERT INTO public.admin_audit_logs (
    admin_id, action, target_type, target_id, reason, metadata
  ) VALUES (
    v_admin_id, 'APPEAL_REVIEWED', 'moderation_appeal', p_appeal_id::text, p_notes,
    jsonb_build_object('status', p_status, 'action_type', v_appeal.action_type)
  );

  RETURN jsonb_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
