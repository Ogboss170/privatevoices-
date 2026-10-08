-- ============================================================
-- Migration 025: Email Change Verification & Permanent Registry Sync
-- ============================================================

-- ─── 1. FUNCTION TO CHECK EMAIL AVAILABILITY FOR EMAIL CHANGE ────────────────
CREATE OR REPLACE FUNCTION public.check_email_change_availability(
  p_user_id   UUID,
  p_new_email TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_norm_email TEXT;
  v_existing_owner UUID;
BEGIN
  v_norm_email := LOWER(TRIM(p_new_email));

  -- Basic syntax validation
  IF NOT (v_norm_email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') THEN
    RETURN jsonb_build_object(
      'available', FALSE,
      'code', 'INVALID_FORMAT',
      'message', 'Please enter a valid email address.'
    );
  END IF;

  -- Check if already registered by another user in the permanent registry
  SELECT original_user_id INTO v_existing_owner
  FROM public.email_registry
  WHERE normalized_email = v_norm_email;

  IF FOUND AND v_existing_owner <> p_user_id THEN
    RETURN jsonb_build_object(
      'available', FALSE,
      'code', 'EMAIL_TAKEN',
      'message', 'This email address is already registered or permanently reserved. Please use another email.'
    );
  END IF;

  -- Check auth.users directly as well
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE LOWER(TRIM(email)) = v_norm_email AND id <> p_user_id
  ) THEN
    RETURN jsonb_build_object(
      'available', FALSE,
      'code', 'EMAIL_TAKEN',
      'message', 'This email address is already in use by another account.'
    );
  END IF;

  RETURN jsonb_build_object('available', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 2. TRIGGER ON auth.users TO SYNC CONFIRMED EMAIL CHANGES ────────────────
-- When an email is confirmed or updated in auth.users, automatically
-- upsert into public.email_registry to permanently reserve the new email address.
CREATE OR REPLACE FUNCTION public.handle_user_email_updated()
RETURNS TRIGGER AS $$
DECLARE
  v_new_norm_email TEXT;
BEGIN
  IF NEW.email IS NOT NULL AND TRIM(NEW.email) <> '' THEN
    v_new_norm_email := LOWER(TRIM(NEW.email));

    -- Upsert the new email address into email_registry
    INSERT INTO public.email_registry (
      normalized_email,
      original_user_id,
      registered_at,
      status
    )
    VALUES (
      v_new_norm_email,
      NEW.id,
      NOW(),
      'active'
    )
    ON CONFLICT (normalized_email) DO UPDATE
      SET status = 'active'
      WHERE email_registry.original_user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists and recreate trigger on auth.users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
    CREATE TRIGGER on_auth_user_email_updated
      AFTER UPDATE OF email ON auth.users
      FOR EACH ROW
      WHEN (OLD.email IS DISTINCT FROM NEW.email)
      EXECUTE FUNCTION public.handle_user_email_updated();
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Fallback in case of restricted superuser privileges on auth.users in standard migrations
    RAISE NOTICE 'Trigger on auth.users could not be created directly: %', SQLERRM;
END $$;
