-- ============================================================
-- Migration 024: Strict Account Identity Rules
-- Email Uniqueness, Permanent Registry, Username History & 60-Day Cooldown
-- ============================================================

-- ─── 1. PERMANENT EMAIL REGISTRY ─────────────────────────────────────────────
-- Email addresses can only ever be used to create ONE Private Voices account.
-- Once an email is registered, it is permanently reserved and cannot be reused,
-- even if the user deletes their account.
CREATE TABLE IF NOT EXISTS public.email_registry (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_email  TEXT NOT NULL,
  original_user_id  UUID NOT NULL,
  registered_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status            TEXT NOT NULL DEFAULT 'registered', -- 'registered', 'active', 'deleted', 'banned'

  CONSTRAINT email_registry_normalized_unique UNIQUE (normalized_email)
);

CREATE INDEX IF NOT EXISTS email_registry_normalized_idx 
  ON public.email_registry (normalized_email);

CREATE INDEX IF NOT EXISTS email_registry_original_user_idx 
  ON public.email_registry (original_user_id);

-- Enable RLS on email_registry (Security Definer functions only)
ALTER TABLE public.email_registry ENABLE ROW LEVEL SECURITY;

-- No direct client access to email_registry
DROP POLICY IF EXISTS "No client select on email_registry" ON public.email_registry;
CREATE POLICY "No client select on email_registry"
  ON public.email_registry FOR SELECT
  USING (FALSE);

-- Backfill email_registry from existing auth.users safely
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    INSERT INTO public.email_registry (normalized_email, original_user_id, registered_at, status)
    SELECT 
      LOWER(TRIM(email)),
      id,
      COALESCE(created_at, NOW()),
      'active'
    FROM auth.users
    WHERE email IS NOT NULL AND TRIM(email) <> ''
    ON CONFLICT (normalized_email) DO NOTHING;
  END IF;
END $$;


-- ─── 2. USERNAME HISTORY & TRACKING ──────────────────────────────────────────
-- Stores every username ever claimed and tracks 60-day change cooldown.
CREATE TABLE IF NOT EXISTS public.username_history (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL,
  normalized_username TEXT NOT NULL,
  claimed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at         TIMESTAMPTZ -- NULL if currently active
);

CREATE INDEX IF NOT EXISTS username_history_user_idx 
  ON public.username_history (user_id);

CREATE INDEX IF NOT EXISTS username_history_username_idx 
  ON public.username_history (normalized_username);

-- Enable RLS
ALTER TABLE public.username_history ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own username history
DROP POLICY IF EXISTS "Users can view own username history" ON public.username_history;
CREATE POLICY "Users can view own username history"
  ON public.username_history FOR SELECT
  USING (auth.uid() = user_id);

-- Add username_changed_at column to public.profiles if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'username_changed_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN username_changed_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Backfill username_history from existing profiles
INSERT INTO public.username_history (user_id, normalized_username, claimed_at)
SELECT id, LOWER(TRIM(username)), COALESCE(created_at, NOW())
FROM public.profiles
WHERE username IS NOT NULL
ON CONFLICT DO NOTHING;


-- ─── 3. STORED PROCEDURE: CHECK REGISTRATION AVAILABILITY ────────────────────
-- Atomically checks if an email or username can be registered.
-- Returns specific rejection reason without leaking account status details.
CREATE OR REPLACE FUNCTION public.check_registration_availability(
  p_email    TEXT,
  p_username TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_norm_email    TEXT;
  v_norm_username TEXT;
  v_email_taken   BOOLEAN;
  v_uname_taken   BOOLEAN;
BEGIN
  v_norm_email := LOWER(TRIM(p_email));
  v_norm_username := LOWER(TRIM(p_username));

  -- Check email in permanent registry
  SELECT EXISTS(
    SELECT 1 FROM public.email_registry 
    WHERE normalized_email = v_norm_email
  ) INTO v_email_taken;

  IF v_email_taken THEN
    RETURN jsonb_build_object(
      'available', FALSE,
      'field', 'email',
      'message', 'This email address is already registered or permanently reserved. Please use another email or sign in.'
    );
  END IF;

  -- Check username format
  IF NOT (v_norm_username ~ '^[a-z0-9_]{3,30}$') THEN
    RETURN jsonb_build_object(
      'available', FALSE,
      'field', 'username',
      'message', 'Username must be between 3 and 30 characters and contain only lowercase letters, numbers, and underscores.'
    );
  END IF;

  -- Check active profiles
  SELECT EXISTS(
    SELECT 1 FROM public.profiles 
    WHERE LOWER(username) = v_norm_username
  ) INTO v_uname_taken;

  IF v_uname_taken THEN
    RETURN jsonb_build_object(
      'available', FALSE,
      'field', 'username',
      'message', 'Username @' || v_norm_username || ' is already taken.'
    );
  END IF;

  -- Check username history reservation (reserved permanently to prevent squatting/impersonation)
  SELECT EXISTS(
    SELECT 1 FROM public.username_history 
    WHERE normalized_username = v_norm_username AND released_at IS NULL
  ) INTO v_uname_taken;

  IF v_uname_taken THEN
    RETURN jsonb_build_object(
      'available', FALSE,
      'field', 'username',
      'message', 'Username @' || v_norm_username || ' is reserved and unavailable.'
    );
  END IF;

  RETURN jsonb_build_object('available', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 4. UPDATED FUNCTION: CREATE PROFILE WITH IDENTITY REGISTRY ─────────────
-- Called right after auth sign-up to register the permanent email record,
-- claim the username in history, and insert the profile row atomically.
CREATE OR REPLACE FUNCTION public.create_profile(
  p_user_id           UUID,
  p_username          TEXT,
  p_display_name       TEXT,
  p_accepted_terms    BOOLEAN DEFAULT TRUE,
  p_accepted_terms_at TIMESTAMPTZ DEFAULT NOW(),
  p_email             TEXT DEFAULT NULL
)
RETURNS public.profiles AS $$
DECLARE
  new_profile        public.profiles;
  v_norm_email       TEXT;
  v_norm_username    TEXT;
  v_user_email       TEXT;
BEGIN
  v_norm_username := LOWER(TRIM(p_username));

  -- Retrieve email from auth.users if not passed explicitly
  IF p_email IS NOT NULL AND TRIM(p_email) <> '' THEN
    v_norm_email := LOWER(TRIM(p_email));
  ELSE
    SELECT LOWER(TRIM(email)) INTO v_user_email FROM auth.users WHERE id = p_user_id;
    v_norm_email := v_user_email;
  END IF;

  -- Verify and permanently reserve email in registry
  IF v_norm_email IS NOT NULL AND v_norm_email <> '' THEN
    -- Check if reserved by someone else
    IF EXISTS (
      SELECT 1 FROM public.email_registry 
      WHERE normalized_email = v_norm_email AND original_user_id <> p_user_id
    ) THEN
      RAISE EXCEPTION 'This email address is already registered and cannot be reused.';
    END IF;

    -- Upsert permanent reservation
    INSERT INTO public.email_registry (normalized_email, original_user_id, registered_at, status)
    VALUES (v_norm_email, p_user_id, NOW(), 'active')
    ON CONFLICT (normalized_email) DO UPDATE 
      SET status = 'active'
      WHERE email_registry.original_user_id = p_user_id;
  END IF;

  -- Check if username is already claimed by another user in active profiles
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE LOWER(username) = v_norm_username AND id <> p_user_id
  ) THEN
    RAISE EXCEPTION 'Username @% is already taken.', v_norm_username;
  END IF;

  -- Create or update profile
  INSERT INTO public.profiles (
    id, 
    username, 
    display_name, 
    accepted_terms, 
    accepted_terms_at,
    username_changed_at
  )
  VALUES (
    p_user_id, 
    v_norm_username, 
    p_display_name, 
    COALESCE(p_accepted_terms, TRUE), 
    COALESCE(p_accepted_terms_at, NOW()),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    display_name = EXCLUDED.display_name,
    accepted_terms = EXCLUDED.accepted_terms,
    accepted_terms_at = EXCLUDED.accepted_terms_at,
    updated_at = NOW()
  RETURNING * INTO new_profile;

  -- Record in username history
  INSERT INTO public.username_history (user_id, normalized_username, claimed_at)
  VALUES (p_user_id, v_norm_username, NOW());

  RETURN new_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 5. STORED PROCEDURE: CHANGE USERNAME (60-DAY COOLDOWN ENFORCED) ────────
-- Validates:
-- 1. Format
-- 2. 60-day cooldown elapsed since last change
-- 3. Availability across profiles and history
-- 4. Updates profile and username history atomically
CREATE OR REPLACE FUNCTION public.change_username(
  p_user_id      UUID,
  p_new_username TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_norm_new          TEXT;
  v_current_username  TEXT;
  v_last_changed_at   TIMESTAMPTZ;
  v_days_passed       NUMERIC;
  v_eligible_date     TIMESTAMPTZ;
BEGIN
  v_norm_new := LOWER(TRIM(p_new_username));

  -- Validate format
  IF NOT (v_norm_new ~ '^[a-z0-9_]{3,30}$') THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'INVALID_FORMAT',
      'message', 'Username must be 3-30 characters long and contain only lowercase letters, numbers, and underscores.'
    );
  END IF;

  -- Get current profile info
  SELECT username, username_changed_at 
  INTO v_current_username, v_last_changed_at
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'USER_NOT_FOUND',
      'message', 'User profile not found.'
    );
  END IF;

  -- If identical, no change needed
  IF LOWER(v_current_username) = v_norm_new THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'username', v_norm_new,
      'message', 'Username is already ' || v_norm_new
    );
  END IF;

  -- Check 60-day cooldown
  IF v_last_changed_at IS NOT NULL THEN
    v_eligible_date := v_last_changed_at + INTERVAL '60 days';
    IF NOW() < v_eligible_date THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'code', 'COOLDOWN_ACTIVE',
        'message', 'You can only change your username once every 60 days.',
        'last_changed_at', v_last_changed_at,
        'eligible_at', v_eligible_date,
        'days_remaining', CEIL(EXTRACT(EPOCH FROM (v_eligible_date - NOW())) / 86400)
      );
    END IF;
  END IF;

  -- Check if username currently belongs to another active account
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE LOWER(username) = v_norm_new AND id <> p_user_id
  ) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'ALREADY_TAKEN',
      'message', 'Username @' || v_norm_new || ' is already taken by another account.'
    );
  END IF;

  -- Check if reserved in username history by another user
  IF EXISTS (
    SELECT 1 FROM public.username_history 
    WHERE normalized_username = v_norm_new AND user_id <> p_user_id AND released_at IS NULL
  ) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'RESERVED',
      'message', 'Username @' || v_norm_new || ' was previously used and is reserved.'
    );
  END IF;

  -- Release the old username in history
  UPDATE public.username_history
  SET released_at = NOW()
  WHERE user_id = p_user_id AND normalized_username = LOWER(v_current_username) AND released_at IS NULL;

  -- Update profiles with new username and reset cooldown timestamp
  UPDATE public.profiles
  SET 
    username = v_norm_new,
    username_changed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Insert new active username in history
  INSERT INTO public.username_history (user_id, normalized_username, claimed_at)
  VALUES (p_user_id, v_norm_new, NOW());

  RETURN jsonb_build_object(
    'success', TRUE,
    'username', v_norm_new,
    'changed_at', NOW(),
    'next_eligible_at', NOW() + INTERVAL '60 days',
    'message', 'Username successfully changed to @' || v_norm_new
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 6. STORED PROCEDURE: GET USERNAME COOLDOWN STATUS ───────────────────────
CREATE OR REPLACE FUNCTION public.get_username_cooldown_status(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_username        TEXT;
  v_last_changed_at TIMESTAMPTZ;
  v_eligible_date   TIMESTAMPTZ;
  v_can_change      BOOLEAN;
BEGIN
  SELECT username, username_changed_at
  INTO v_username, v_last_changed_at
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Profile not found');
  END IF;

  IF v_last_changed_at IS NULL THEN
    v_can_change := TRUE;
    v_eligible_date := NOW();
  ELSE
    v_eligible_date := v_last_changed_at + INTERVAL '60 days';
    v_can_change := NOW() >= v_eligible_date;
  END IF;

  RETURN jsonb_build_object(
    'username', v_username,
    'can_change', v_can_change,
    'last_changed_at', v_last_changed_at,
    'eligible_at', v_eligible_date,
    'days_remaining', CASE WHEN v_can_change THEN 0 ELSE CEIL(EXTRACT(EPOCH FROM (v_eligible_date - NOW())) / 86400) END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 7. TRIGGER: PREVENT EMAIL REUSE ON ACCOUNT DELETION ─────────────────────
-- When a profile is deleted, mark status in email_registry as 'deleted',
-- but NEVER delete the email_registry record!
CREATE OR REPLACE FUNCTION public.handle_account_deletion_identity()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark email registry status as deleted while keeping the record permanent
  UPDATE public.email_registry
  SET status = 'deleted'
  WHERE original_user_id = OLD.id;

  -- Archive active username history record
  UPDATE public.username_history
  SET released_at = NOW()
  WHERE user_id = OLD.id AND released_at IS NULL;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_deleted_identity ON public.profiles;
CREATE TRIGGER on_profile_deleted_identity
  BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_account_deletion_identity();
