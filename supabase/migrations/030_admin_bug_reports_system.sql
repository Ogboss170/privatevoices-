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
