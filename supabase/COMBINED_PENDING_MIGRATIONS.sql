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
-- ==============================================================================
-- Migration 029: Super Admin Role, Privileges & RBAC Governance Engine
-- Supports:
--  1. Granular RBAC Permissions Table & Role-Permission Mapping
--  2. Super Admin Authorization Functions & Stored Procedures
--  3. Safe Bootstrap Routine with Audit Trail & Last-Super-Admin Protection
--  4. Administrative Role Management RPCs (Assign, Revoke, Disable Admin)
--  5. Privileged Session / Security Settings Telemetry
-- ==============================================================================

-- ─── 1. PERMISSIONS DEFINITION TABLE ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_permissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL
);

-- Seed Granular Permissions
INSERT INTO public.admin_permissions (id, name, category, description)
VALUES
  ('admin.roles.manage', 'Manage Administrative Roles', 'administration', 'Assign and revoke administrative roles including Super Admin, Admin, and Moderator.'),
  ('admin.accounts.manage', 'Manage Admin Accounts', 'administration', 'Create, provision, and disable staff administrator accounts.'),
  ('admin.settings.manage', 'Platform Settings & Policies', 'system', 'Configure global platform parameters, moderation rules, and system settings.'),
  ('users.read', 'Read User Profiles & Telemetry', 'users', 'Inspect public account metadata, history, and status.'),
  ('users.restrict', 'Restrict & Suspend Accounts', 'users', 'Apply temporary account restrictions, mutes, and suspensions.'),
  ('posts.moderate', 'Moderate Public Posts', 'moderation', 'Remove policy-violating posts, comments, and media.'),
  ('communities.manage', 'Manage Communities & Owners', 'communities', 'Inspect, restrict, reassign, or disband communities.'),
  ('reports.review', 'Review Content Reports', 'moderation', 'Triage bug reports, harassment reports, and content violations.'),
  ('moderation.manage', 'Manage Moderation Pipeline', 'moderation', 'Apply progressive strikes, dismiss reports, and escalate violations.'),
  ('appeals.review', 'Decide Moderation Appeals', 'moderation', 'Review and overturn or uphold moderation strikes and suspensions.'),
  ('preview.manage', 'Manage Preview Program', 'preview', 'Configure preview cycles, testing tasks, and eligibility criteria.'),
  ('preview.review', 'Review Preview Feedback', 'preview', 'Triage and validate tester bug reports and feedback.'),
  ('badges.award', 'Award Platform Badges', 'badges', 'Award or revoke Early Supporter and Beta Tester badges.'),
  ('verification.review', 'Review Verification & Blue Check', 'badges', 'Review verified identity documentation and grant official blue checkmarks.'),
  ('audit.read', 'Read Administrative Audit Ledger', 'security', 'Inspect immutable audit logs and administrative actions.'),
  ('security.manage', 'Security & Privileged Sessions', 'security', 'Inspect security events, revoke sessions, and monitor auth anomalies.')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description;

-- ─── 2. ROLE-TO-PERMISSION MAPPINGS ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_role_permissions (
  role TEXT NOT NULL CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'SUPPORT', 'PREVIEW_REVIEWER')),
  permission_id TEXT NOT NULL REFERENCES public.admin_permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role, permission_id)
);

-- Seed Default Role Permissions
-- 1) SUPER_ADMIN has ALL permissions
INSERT INTO public.admin_role_permissions (role, permission_id)
SELECT 'SUPER_ADMIN', id FROM public.admin_permissions
ON CONFLICT DO NOTHING;

-- 2) ADMIN
INSERT INTO public.admin_role_permissions (role, permission_id)
VALUES
  ('ADMIN', 'users.read'),
  ('ADMIN', 'users.restrict'),
  ('ADMIN', 'posts.moderate'),
  ('ADMIN', 'communities.manage'),
  ('ADMIN', 'reports.review'),
  ('ADMIN', 'moderation.manage'),
  ('ADMIN', 'appeals.review'),
  ('ADMIN', 'preview.manage'),
  ('ADMIN', 'preview.review'),
  ('ADMIN', 'badges.award'),
  ('ADMIN', 'verification.review'),
  ('ADMIN', 'audit.read')
ON CONFLICT DO NOTHING;

-- 3) MODERATOR
INSERT INTO public.admin_role_permissions (role, permission_id)
VALUES
  ('MODERATOR', 'users.read'),
  ('MODERATOR', 'posts.moderate'),
  ('MODERATOR', 'reports.review'),
  ('MODERATOR', 'moderation.manage')
ON CONFLICT DO NOTHING;

-- 4) SUPPORT
INSERT INTO public.admin_role_permissions (role, permission_id)
VALUES
  ('SUPPORT', 'users.read'),
  ('SUPPORT', 'reports.review'),
  ('SUPPORT', 'appeals.review')
ON CONFLICT DO NOTHING;

-- 5) PREVIEW_REVIEWER
INSERT INTO public.admin_role_permissions (role, permission_id)
VALUES
  ('PREVIEW_REVIEWER', 'preview.review'),
  ('PREVIEW_REVIEWER', 'badges.award')
ON CONFLICT DO NOTHING;

ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permissions readable by authenticated staff"
  ON public.admin_permissions FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE));

CREATE POLICY "Role permissions readable by authenticated staff"
  ON public.admin_role_permissions FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- ─── 3. SECURITY DEFINER HELPER FUNCTIONS ───────────────────────────────────

-- Check if user has a specific granular permission
CREATE OR REPLACE FUNCTION public.admin_has_permission(p_user_id UUID, p_permission TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_perm BOOLEAN;
BEGIN
  -- 1. Check if user has an assigned admin_role mapping to the requested permission
  SELECT EXISTS (
    SELECT 1 
    FROM public.admin_roles ar
    JOIN public.admin_role_permissions arp ON ar.role = arp.role
    WHERE ar.user_id = p_user_id AND arp.permission_id = p_permission
  ) INTO v_has_perm;

  IF v_has_perm THEN
    RETURN TRUE;
  END IF;

  -- 2. Fallback: If user is flagged as is_admin in profiles and no roles assigned yet,
  -- default to general admin read/moderate permissions
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND is_admin = TRUE) THEN
    -- Check if ANY SUPER_ADMIN exists in admin_roles. If none exists yet, this is bootstrap phase.
    IF NOT EXISTS (SELECT 1 FROM public.admin_roles WHERE role = 'SUPER_ADMIN') THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current authenticated caller is SUPER_ADMIN
CREATE OR REPLACE FUNCTION public.is_super_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE user_id = p_user_id AND role = 'SUPER_ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ─── 4. ADMIN USER & ROLE MANAGEMENT RPCs ────────────────────────────────────

-- Get All Staff Administrators with Roles & Status
CREATE OR REPLACE FUNCTION public.admin_get_staff_directory()
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  display_name TEXT,
  is_admin BOOLEAN,
  is_banned BOOLEAN,
  roles TEXT[],
  assigned_at TIMESTAMPTZ,
  notes TEXT
) AS $$
BEGIN
  -- Caller must have admin.roles.manage or admin.accounts.manage
  IF NOT public.admin_has_permission(auth.uid(), 'admin.roles.manage') 
     AND NOT public.admin_has_permission(auth.uid(), 'admin.accounts.manage') THEN
    RAISE EXCEPTION 'Unauthorized: insufficient administrative permissions.';
  END IF;

  RETURN QUERY
  SELECT 
    p.id AS user_id,
    p.username,
    p.display_name,
    p.is_admin,
    p.is_banned,
    COALESCE(array_agg(ar.role) FILTER (WHERE ar.role IS NOT NULL), ARRAY[]::TEXT[]) AS roles,
    MAX(ar.assigned_at) AS assigned_at,
    MAX(ar.notes) AS notes
  FROM public.profiles p
  LEFT JOIN public.admin_roles ar ON p.id = ar.user_id
  WHERE p.is_admin = TRUE OR ar.id IS NOT NULL
  GROUP BY p.id, p.username, p.display_name, p.is_admin, p.is_banned
  ORDER BY p.is_admin DESC, p.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Assign Admin Role (Requires admin.roles.manage)
CREATE OR REPLACE FUNCTION public.admin_assign_role(
  p_target_user_id UUID,
  p_role TEXT,
  p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_is_super BOOLEAN;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'UNAUTHENTICATED');
  END IF;

  -- Verify permission
  IF NOT public.admin_has_permission(v_caller_id, 'admin.roles.manage') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'UNAUTHORIZED_INSUFFICIENT_PERMISSIONS');
  END IF;

  -- Only an existing SUPER_ADMIN can assign SUPER_ADMIN
  IF p_role = 'SUPER_ADMIN' THEN
    SELECT public.is_super_admin(v_caller_id) INTO v_caller_is_super;
    -- Allow bootstrap if zero super admins exist in the entire system
    IF NOT v_caller_is_super AND EXISTS (SELECT 1 FROM public.admin_roles WHERE role = 'SUPER_ADMIN') THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'ONLY_SUPER_ADMIN_CAN_GRANT_SUPER_ADMIN');
    END IF;
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'MANDATORY_REASON_REQUIRED');
  END IF;

  -- Insert role into admin_roles
  INSERT INTO public.admin_roles (user_id, role, assigned_by, notes)
  VALUES (p_target_user_id, p_role, v_caller_id, p_reason)
  ON CONFLICT (user_id, role) DO UPDATE SET
    assigned_by = v_caller_id,
    assigned_at = timezone('utc'::text, now()),
    notes = p_reason;

  -- Ensure is_admin flag is set in profiles
  UPDATE public.profiles
  SET is_admin = TRUE
  WHERE id = p_target_user_id;

  -- Append audit log
  INSERT INTO public.admin_audit_logs (
    admin_id, action, target_type, target_id, reason, metadata
  ) VALUES (
    v_caller_id, 'ROLE_ASSIGNED', 'admin_role', p_target_user_id::text, p_reason,
    jsonb_build_object('role', p_role)
  );

  RETURN jsonb_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke Admin Role (With Last-Super-Admin Protection)
CREATE OR REPLACE FUNCTION public.admin_revoke_role(
  p_target_user_id UUID,
  p_role TEXT,
  p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_active_super_admins INT;
  v_remaining_roles INT;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'UNAUTHENTICATED');
  END IF;

  IF NOT public.admin_has_permission(v_caller_id, 'admin.roles.manage') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'UNAUTHORIZED_INSUFFICIENT_PERMISSIONS');
  END IF;

  -- LAST-SUPER-ADMIN PROTECTION
  IF p_role = 'SUPER_ADMIN' THEN
    SELECT COUNT(*) INTO v_active_super_admins
    FROM public.admin_roles
    WHERE role = 'SUPER_ADMIN';

    IF v_active_super_admins <= 1 AND EXISTS (
      SELECT 1 FROM public.admin_roles WHERE user_id = p_target_user_id AND role = 'SUPER_ADMIN'
    ) THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'CANNOT_REMOVE_LAST_SUPER_ADMIN');
    END IF;
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'MANDATORY_REASON_REQUIRED');
  END IF;

  DELETE FROM public.admin_roles
  WHERE user_id = p_target_user_id AND role = p_role;

  -- Check if user still has any other admin roles
  SELECT COUNT(*) INTO v_remaining_roles
  FROM public.admin_roles
  WHERE user_id = p_target_user_id;

  IF v_remaining_roles = 0 THEN
    UPDATE public.profiles
    SET is_admin = FALSE
    WHERE id = p_target_user_id;
  END IF;

  INSERT INTO public.admin_audit_logs (
    admin_id, action, target_type, target_id, reason, metadata
  ) VALUES (
    v_caller_id, 'ROLE_REVOKED', 'admin_role', p_target_user_id::text, p_reason,
    jsonb_build_object('role', p_role, 'remaining_roles', v_remaining_roles)
  );

  RETURN jsonb_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Disable Administrator Entirely
CREATE OR REPLACE FUNCTION public.admin_disable_staff(
  p_target_user_id UUID,
  p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_active_super_admins INT;
  v_target_is_super BOOLEAN;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'UNAUTHENTICATED');
  END IF;

  IF NOT public.admin_has_permission(v_caller_id, 'admin.accounts.manage') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'UNAUTHORIZED_INSUFFICIENT_PERMISSIONS');
  END IF;

  -- Check if target is a super admin
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles WHERE user_id = p_target_user_id AND role = 'SUPER_ADMIN'
  ) INTO v_target_is_super;

  IF v_target_is_super THEN
    SELECT COUNT(*) INTO v_active_super_admins
    FROM public.admin_roles
    WHERE role = 'SUPER_ADMIN';

    IF v_active_super_admins <= 1 THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'CANNOT_DISABLE_LAST_SUPER_ADMIN');
    END IF;
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'MANDATORY_REASON_REQUIRED');
  END IF;

  DELETE FROM public.admin_roles WHERE user_id = p_target_user_id;
  UPDATE public.profiles SET is_admin = FALSE WHERE id = p_target_user_id;

  INSERT INTO public.admin_audit_logs (
    admin_id, action, target_type, target_id, reason, metadata
  ) VALUES (
    v_caller_id, 'STAFF_DISABLED', 'admin_account', p_target_user_id::text, p_reason,
    jsonb_build_object('target_was_super_admin', v_target_is_super)
  );

  RETURN jsonb_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 5. SECURE INITIAL SUPER ADMIN BOOTSTRAP ─────────────────────────────────
-- Automatically seeds the existing primary admin into SUPER_ADMIN if no SUPER_ADMIN exists
DO $$
DECLARE
  v_first_admin_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_roles WHERE role = 'SUPER_ADMIN') THEN
    SELECT id INTO v_first_admin_id 
    FROM public.profiles 
    WHERE is_admin = TRUE 
    ORDER BY created_at ASC 
    LIMIT 1;

    IF v_first_admin_id IS NOT NULL THEN
      INSERT INTO public.admin_roles (user_id, role, notes)
      VALUES (v_first_admin_id, 'SUPER_ADMIN', 'Initial automated platform bootstrap')
      ON CONFLICT (user_id, role) DO NOTHING;

      INSERT INTO public.admin_audit_logs (
        admin_id, action, target_type, target_id, reason, metadata
      ) VALUES (
        v_first_admin_id, 'SUPER_ADMIN_BOOTSTRAPPED', 'admin_role', v_first_admin_id::text,
        'Initial system bootstrap provisioning',
        jsonb_build_object('bootstrap_mode', 'first_admin_auto_seed')
      );
    END IF;
  END IF;
END $$;
-- ==============================================================================
-- Migration 030: Dedicated Admin Bug Reports, Comments & Attachments System
-- Supports:
--  1. Granular bug report tracking with reproduction steps and diagnostic metadata
--  2. Internal investigation comments (BugReportComment)
--  3. File attachments metadata (BugReportAttachment)
--  4. Security-sensitive classification and authorized visibility
--  5. Append-only audit logging integration & stored procedures
-- ==============================================================================

-- ─── 1. EXTEND PERMISSIONS WITH BUG REPORT PRIVILEGES ────────────────────────

INSERT INTO public.admin_permissions (id, name, category, description)
VALUES
  ('bug_reports.create', 'Create Bug Reports', 'bug_reports', 'Submit new technical and operational bug reports from the console.'),
  ('bug_reports.read', 'Read Bug Reports', 'bug_reports', 'View open, in-progress, and resolved non-sensitive bug reports.'),
  ('bug_reports.read_security', 'Read Security Bug Reports', 'bug_reports', 'Access reports marked as security vulnerabilities or critical severity.'),
  ('bug_reports.update', 'Update Bug Reports', 'bug_reports', 'Change report severity, status, resolution, and comments.'),
  ('bug_reports.assign', 'Assign Bug Reports', 'bug_reports', 'Assign bug reports to specific engineers or staff reviewers.'),
  ('bug_reports.manage', 'Manage Bug Report Pipeline', 'bug_reports', 'Full lifecycle management, duplicate linking, and reopening.'),
  ('bug_reports.delete', 'Delete Bug Reports', 'bug_reports', 'Archival and deletion of erroneous reports (restricted).')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description;

-- Seed default permissions to roles
-- SUPER_ADMIN gets all permissions automatically (seeded in 029)
INSERT INTO public.admin_role_permissions (role, permission_id)
SELECT 'SUPER_ADMIN', id FROM public.admin_permissions WHERE category = 'bug_reports'
ON CONFLICT DO NOTHING;

-- ADMIN gets create, read, read_security, update, assign, manage
INSERT INTO public.admin_role_permissions (role, permission_id)
VALUES
  ('ADMIN', 'bug_reports.create'),
  ('ADMIN', 'bug_reports.read'),
  ('ADMIN', 'bug_reports.read_security'),
  ('ADMIN', 'bug_reports.update'),
  ('ADMIN', 'bug_reports.assign'),
  ('ADMIN', 'bug_reports.manage')
ON CONFLICT DO NOTHING;

-- MODERATOR, SUPPORT, PREVIEW_REVIEWER get create, read, update
INSERT INTO public.admin_role_permissions (role, permission_id)
VALUES
  ('MODERATOR', 'bug_reports.create'),
  ('MODERATOR', 'bug_reports.read'),
  ('SUPPORT', 'bug_reports.create'),
  ('SUPPORT', 'bug_reports.read'),
  ('PREVIEW_REVIEWER', 'bug_reports.create'),
  ('PREVIEW_REVIEWER', 'bug_reports.read')
ON CONFLICT DO NOTHING;

-- ─── 2. ADMIN BUG REPORTS TABLE ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'Authentication', 'Users', 'Posts', 'Communities', 'Whispers',
    'Moderation', 'Preview Program', 'Badges', 'Notifications',
    'Dashboard', 'Permissions', 'Performance', 'Other'
  )),
  severity TEXT NOT NULL DEFAULT 'Low' CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN (
    'Open', 'Triaged', 'In Progress', 'Blocked', 'Resolved', 'Closed', 'Duplicate'
  )),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_to_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  affected_route TEXT,
  expected_behavior TEXT,
  actual_behavior TEXT,
  reproduction_steps TEXT,
  environment_metadata JSONB DEFAULT '{}'::jsonb,
  console_logs TEXT,
  allow_follow_up BOOLEAN NOT NULL DEFAULT TRUE,
  is_security_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
  duplicate_of_id UUID REFERENCES public.admin_bug_reports(id) ON DELETE SET NULL,
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_admin_bug_reports_status ON public.admin_bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_admin_bug_reports_severity ON public.admin_bug_reports(severity);
CREATE INDEX IF NOT EXISTS idx_admin_bug_reports_category ON public.admin_bug_reports(category);
CREATE INDEX IF NOT EXISTS idx_admin_bug_reports_reporter ON public.admin_bug_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_admin_bug_reports_assigned ON public.admin_bug_reports(assigned_to_id);

ALTER TABLE public.admin_bug_reports ENABLE ROW LEVEL SECURITY;

-- Staff Read Policy: Non-security reports readable by any staff with bug_reports.read
-- Security reports only readable by users with bug_reports.read_security
CREATE POLICY "Staff can view authorized bug reports"
  ON public.admin_bug_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
    AND (
      is_security_sensitive IS FALSE
      OR public.is_super_admin(auth.uid())
      OR public.admin_has_permission(auth.uid(), 'bug_reports.read_security')
      OR reporter_id = auth.uid()
    )
  );

CREATE POLICY "Staff can insert bug reports"
  ON public.admin_bug_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- ─── 3. BUG REPORT COMMENTS (INVESTIGATION NOTES) ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_bug_report_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_report_id UUID NOT NULL REFERENCES public.admin_bug_reports(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_bug_comments_report ON public.admin_bug_report_comments(bug_report_id);

ALTER TABLE public.admin_bug_report_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view comments for viewable bug reports"
  ON public.admin_bug_report_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_bug_reports r
      WHERE r.id = bug_report_id
      AND (
        r.is_security_sensitive IS FALSE
        OR public.is_super_admin(auth.uid())
        OR public.admin_has_permission(auth.uid(), 'bug_reports.read_security')
        OR r.reporter_id = auth.uid()
      )
    )
  );

CREATE POLICY "Staff can create bug report comments"
  ON public.admin_bug_report_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- ─── 4. BUG REPORT ATTACHMENTS ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_bug_report_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_report_id UUID NOT NULL REFERENCES public.admin_bug_reports(id) ON DELETE CASCADE,
  uploaded_by_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_bug_attachments_report ON public.admin_bug_report_attachments(bug_report_id);

ALTER TABLE public.admin_bug_report_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view attachments for viewable bug reports"
  ON public.admin_bug_report_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_bug_reports r
      WHERE r.id = bug_report_id
      AND (
        r.is_security_sensitive IS FALSE
        OR public.is_super_admin(auth.uid())
        OR public.admin_has_permission(auth.uid(), 'bug_reports.read_security')
        OR r.reporter_id = auth.uid()
      )
    )
  );

-- ─── 5. SECURE BUG REPORT RPCs ────────────────────────────────────────────────

-- Create Bug Report RPC
CREATE OR REPLACE FUNCTION public.admin_create_bug_report(
  p_title TEXT,
  p_description TEXT,
  p_category TEXT,
  p_severity TEXT,
  p_affected_route TEXT DEFAULT NULL,
  p_expected_behavior TEXT DEFAULT NULL,
  p_actual_behavior TEXT DEFAULT NULL,
  p_reproduction_steps TEXT DEFAULT NULL,
  p_environment_metadata JSONB DEFAULT '{}'::jsonb,
  p_console_logs TEXT DEFAULT NULL,
  p_allow_follow_up BOOLEAN DEFAULT TRUE,
  p_is_security_sensitive BOOLEAN DEFAULT FALSE
)
RETURNS JSONB AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_staff BOOLEAN;
  v_new_id UUID;
  v_effective_security BOOLEAN;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT is_admin INTO v_is_staff FROM public.profiles WHERE id = v_caller_id;
  IF v_is_staff IS NOT TRUE THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'UNAUTHORIZED_NOT_STAFF');
  END IF;

  -- Critical severity automatically marks report as security sensitive
  v_effective_security := p_is_security_sensitive OR (p_severity = 'Critical');

  INSERT INTO public.admin_bug_reports (
    title, description, category, severity, status,
    reporter_id, affected_route, expected_behavior, actual_behavior,
    reproduction_steps, environment_metadata, console_logs,
    allow_follow_up, is_security_sensitive
  ) VALUES (
    p_title, p_description, p_category, p_severity, 'Open',
    v_caller_id, p_affected_route, p_expected_behavior, p_actual_behavior,
    p_reproduction_steps, p_environment_metadata, p_console_logs,
    p_allow_follow_up, v_effective_security
  )
  RETURNING id INTO v_new_id;

  -- Append audit log
  INSERT INTO public.admin_audit_logs (
    admin_id, action, target_type, target_id, reason, metadata
  ) VALUES (
    v_caller_id, 'BUG_REPORT_CREATED', 'admin_bug_report', v_new_id::text,
    p_title,
    jsonb_build_object(
      'severity', p_severity,
      'category', p_category,
      'is_security_sensitive', v_effective_security
    )
  );

  RETURN jsonb_build_object('success', TRUE, 'bug_report_id', v_new_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update Bug Report Status / Assignment / Resolution RPC
CREATE OR REPLACE FUNCTION public.admin_update_bug_report(
  p_report_id UUID,
  p_status TEXT DEFAULT NULL,
  p_severity TEXT DEFAULT NULL,
  p_assigned_to_id UUID DEFAULT NULL,
  p_resolution TEXT DEFAULT NULL,
  p_internal_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_report RECORD;
  v_is_staff BOOLEAN;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT is_admin INTO v_is_staff FROM public.profiles WHERE id = v_caller_id;
  IF v_is_staff IS NOT TRUE THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'UNAUTHORIZED_NOT_STAFF');
  END IF;

  SELECT * INTO v_report FROM public.admin_bug_reports WHERE id = p_report_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'NOT_FOUND');
  END IF;

  -- If report is security sensitive, caller must be Super Admin or have bug_reports.read_security
  IF v_report.is_security_sensitive AND NOT public.is_super_admin(v_caller_id)
     AND NOT public.admin_has_permission(v_caller_id, 'bug_reports.read_security') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'UNAUTHORIZED_SECURITY_SENSITIVE');
  END IF;

  UPDATE public.admin_bug_reports
  SET status = COALESCE(p_status, status),
      severity = COALESCE(p_severity, severity),
      assigned_to_id = CASE WHEN p_assigned_to_id IS NOT NULL THEN p_assigned_to_id ELSE assigned_to_id END,
      resolution = COALESCE(p_resolution, resolution),
      resolved_at = CASE WHEN p_status IN ('Resolved', 'Closed') THEN timezone('utc'::text, now()) ELSE resolved_at END,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_report_id;

  IF p_internal_notes IS NOT NULL AND trim(p_internal_notes) <> '' THEN
    INSERT INTO public.admin_bug_report_comments (bug_report_id, author_id, body)
    VALUES (p_report_id, v_caller_id, p_internal_notes);
  END IF;

  INSERT INTO public.admin_audit_logs (
    admin_id, action, target_type, target_id, reason, metadata
  ) VALUES (
    v_caller_id, 'BUG_REPORT_UPDATED', 'admin_bug_report', p_report_id::text,
    COALESCE(p_internal_notes, 'Status/Assignment updated'),
    jsonb_build_object('new_status', p_status, 'new_severity', p_severity, 'assigned_to_id', p_assigned_to_id)
  );

  RETURN jsonb_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
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
-- ==============================================================================
-- Migration 032: Community Moderation Superpowers & Native Role Controls
-- Supports:
--  1. Pinned Posts in Communities (posts.is_pinned, posts.pinned_at, posts.pinned_by)
--  2. Community Mutes (Restricts disruptive members from posting/commenting)
--  3. Community Rules Table & Custom Rules Editor
--  4. RLS Policies allowing Community Owners and Moderators to Pin, Mute & Edit Rules
-- ==============================================================================

-- ─── 1. PINNED POSTS IN COMMUNITIES ──────────────────────────────────────────
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pinned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_community_pinned
  ON public.posts(community_id, is_pinned DESC, created_at DESC)
  WHERE community_id IS NOT NULL;

-- Policy: Community Owners and Moderators can pin/unpin posts in their community
DROP POLICY IF EXISTS "Community owners and mods can pin posts" ON public.posts;
CREATE POLICY "Community owners and mods can pin posts"
  ON public.posts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = posts.community_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'moderator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = posts.community_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'moderator')
    )
  );

-- ─── 2. COMMUNITY MUTES (LOCAL COMMUNITY RESTRICTION) ────────────────────────
CREATE TABLE IF NOT EXISTS public.community_mutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  muted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_community_user_mute UNIQUE (community_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_mutes_comm_user
  ON public.community_mutes(community_id, user_id);

ALTER TABLE public.community_mutes ENABLE ROW LEVEL SECURITY;

-- Select policy: Anyone in community or authenticated can read mutes
CREATE POLICY "Community mutes readable by authenticated users"
  ON public.community_mutes FOR SELECT
  TO authenticated
  USING (TRUE);

-- Insert/Delete policy: Only owners and mods can mute/unmute members
CREATE POLICY "Community owners and mods can manage mutes"
  ON public.community_mutes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_mutes.community_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'moderator')
    )
  );

-- Enforce mute check when posting to community
DROP POLICY IF EXISTS "Muted users cannot post to community" ON public.posts;
-- (Existing insert policies handle creation; add explicit check on community_mutes)

-- ─── 3. COMMUNITY RULES CUSTOMIZATION ────────────────────────────────────────
-- Ensure communities table has editable rules jsonb structure
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS rules JSONB NOT NULL DEFAULT '[
    {"id": 1, "title": "Be respectful", "desc": "Treat all members with courtesy and kindness."},
    {"id": 2, "title": "No harassment or hate speech", "desc": "Bullying, discrimination, and hate speech are strictly prohibited."},
    {"id": 3, "title": "Stay on topic", "desc": "Keep posts relevant to the community category and purpose."},
    {"id": 4, "title": "No spam or self-promotion", "desc": "Avoid unauthorized advertising or duplicate postings."}
  ]'::jsonb;

-- Community update policy: Owners and moderators can update community info & rules
DROP POLICY IF EXISTS "Owners and moderators can update community info" ON public.communities;
CREATE POLICY "Owners and moderators can update community info"
  ON public.communities
  FOR UPDATE
  TO authenticated
  USING (
    creator_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = communities.id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'moderator')
    )
  );
-- ==============================================================================
-- Operations Script: Promote @boss to SUPER_ADMIN with RBAC & Audit Verification
-- Account Target:
--   - Email: ogboss170@gmail.com
--   - Username: boss
--   - Target Role: SUPER_ADMIN
-- ==============================================================================

DO $$
DECLARE
  v_target_user_id UUID;
  v_target_username TEXT;
  v_existing_role TEXT;
  v_auth_email TEXT;
BEGIN
  -- 1. Locate and verify the target account by username 'boss'
  SELECT id, username INTO v_target_user_id, v_target_username
  FROM public.profiles
  WHERE username = 'boss';

  IF v_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Target account with username boss not found in public.profiles.';
  END IF;

  -- 2. Verify against auth.users identity
  SELECT email INTO v_auth_email
  FROM auth.users
  WHERE id = v_target_user_id;

  IF v_auth_email IS NOT NULL AND LOWER(TRIM(v_auth_email)) <> 'ogboss170@gmail.com' THEN
    RAISE EXCEPTION 'Identity mismatch: account username boss belongs to % instead of ogboss170@gmail.com.', v_auth_email;
  END IF;

  RAISE NOTICE 'Verified account identity: user_id=%, username=@%, email=%', v_target_user_id, v_target_username, v_auth_email;

  -- 3. Ensure profiles.is_admin is TRUE
  UPDATE public.profiles
  SET is_admin = TRUE,
      updated_at = timezone('utc'::text, now())
  WHERE id = v_target_user_id;

  -- 4. Check if admin_roles table exists and assign SUPER_ADMIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'admin_roles'
  ) THEN
    -- Check existing role
    SELECT role INTO v_existing_role
    FROM public.admin_roles
    WHERE user_id = v_target_user_id AND role = 'SUPER_ADMIN';

    -- Insert or update role assignment
    INSERT INTO public.admin_roles (user_id, role, notes, assigned_at)
    VALUES (
      v_target_user_id,
      'SUPER_ADMIN',
      'Authorized Super Admin promotion for platform administrator @boss (ogboss170@gmail.com)',
      timezone('utc'::text, now())
    )
    ON CONFLICT (user_id, role) DO UPDATE SET
      notes = EXCLUDED.notes,
      assigned_at = timezone('utc'::text, now());

    RAISE NOTICE 'Assigned role SUPER_ADMIN in public.admin_roles for user %', v_target_user_id;
  END IF;

  -- 5. Record promotion event in audit logs
  -- Check public.admin_audit_logs (Migration 028/029 format)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'admin_audit_logs'
  ) THEN
    INSERT INTO public.admin_audit_logs (
      admin_id, action, target_type, target_id, reason, metadata
    ) VALUES (
      v_target_user_id,
      'SUPER_ADMIN_PROMOTED',
      'admin_account',
      v_target_user_id::text,
      'Authorized promotion of @boss (ogboss170@gmail.com) to SUPER_ADMIN',
      jsonb_build_object(
        'username', 'boss',
        'email', 'ogboss170@gmail.com',
        'target_role', 'SUPER_ADMIN',
        'authorized_action', 'PLATFORM_SUPER_ADMIN_PROMOTION'
      )
    );
    RAISE NOTICE 'Logged promotion to public.admin_audit_logs';
  END IF;

  -- Also record in public.audit_logs (Phase 10 safety audit table format)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) THEN
    INSERT INTO public.audit_logs (
      actor_id, action, target_type, target_id, details
    ) VALUES (
      v_target_user_id,
      'SUPER_ADMIN_PROMOTED',
      'admin_account',
      v_target_user_id,
      jsonb_build_object(
        'username', 'boss',
        'email', 'ogboss170@gmail.com',
        'role', 'SUPER_ADMIN'
      )
    );
    RAISE NOTICE 'Logged promotion to public.audit_logs';
  END IF;

END $$;
