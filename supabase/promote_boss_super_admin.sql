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
