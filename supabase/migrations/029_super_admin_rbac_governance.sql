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
