-- ============================================================
-- Migration 027: Admin Role & RBAC Security Verification
-- ============================================================

-- ─── 1. ADD is_admin COLUMN TO public.profiles ──────────────────────────────
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_is_admin 
  ON public.profiles(is_admin);

-- ─── 2. FUNCTION: CHECK CURRENT USER ADMIN PRIVILEGES ────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ─── 3. FUNCTION: ADMIN VERIFY / LOGIN GATEWAY ───────────────────────────────
CREATE OR REPLACE FUNCTION public.verify_admin_access()
RETURNS JSONB AS $$
DECLARE
  v_user_id   UUID;
  v_is_admin  BOOLEAN;
  v_username  TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('authorized', FALSE, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT is_admin, username INTO v_is_admin, v_username
  FROM public.profiles
  WHERE id = v_user_id;

  IF NOT FOUND OR v_is_admin IS NOT TRUE THEN
    RETURN jsonb_build_object('authorized', FALSE, 'error', 'UNAUTHORIZED_NOT_ADMIN');
  END IF;

  RETURN jsonb_build_object(
    'authorized', TRUE,
    'user_id', v_user_id,
    'username', v_username
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
