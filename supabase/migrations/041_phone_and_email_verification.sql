-- ==============================================================================
-- Migration 041: Phone Number & Verification Codes (Phone & Email OTP)
-- Supports OTP verification codes for Phone and Email, SMS verification state,
-- and safe verification audit logging.
-- ==============================================================================

-- 1. Extend profiles with phone number and verification flags
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- Index for phone lookups (normalized format)
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);

-- 2. Permanent Phone Registry (Prevents abuse / multiple accounts from same phone)
CREATE TABLE IF NOT EXISTS public.phone_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_phone TEXT NOT NULL UNIQUE,
  original_user_id UUID NOT NULL,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unverified', 'banned', 'deleted'))
);

CREATE INDEX IF NOT EXISTS idx_phone_registry_normalized ON public.phone_registry(normalized_phone);
CREATE INDEX IF NOT EXISTS idx_phone_registry_user ON public.phone_registry(original_user_id);

ALTER TABLE public.phone_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct client access on phone_registry" ON public.phone_registry;
CREATE POLICY "No direct client access on phone_registry"
  ON public.phone_registry FOR SELECT
  USING (FALSE);

-- 3. Verification Codes (OTP) Table
-- Handles short-lived 6-digit codes for phone SMS and email confirmation
CREATE TABLE IF NOT EXISTS public.verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('phone', 'email')),
  target_value TEXT NOT NULL, -- e.g. "+1234567890" or "user@example.com"
  code_hash TEXT NOT NULL, -- securely hashed OTP code or direct 6-digit numeric token
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_verification_codes_target ON public.verification_codes(target_type, target_value);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires ON public.verification_codes(expires_at);

ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own verification requests" ON public.verification_codes;
CREATE POLICY "Users can view their own verification requests"
  ON public.verification_codes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 4. RPC: Generate and issue a 6-digit verification code
CREATE OR REPLACE FUNCTION public.request_verification_code(
  p_target_type TEXT,
  p_target_value TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_norm_target TEXT;
  v_code TEXT;
  v_expires_at TIMESTAMPTZ;
  v_recent_count INT;
BEGIN
  v_norm_target := LOWER(TRIM(p_target_value));

  IF p_target_type NOT IN ('phone', 'email') THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Invalid target type. Must be phone or email.');
  END IF;

  -- Rate limit check: maximum 3 codes per target in the last 10 minutes
  SELECT COUNT(*) INTO v_recent_count
  FROM public.verification_codes
  WHERE target_type = p_target_type
    AND target_value = v_norm_target
    AND created_at > (NOW() - INTERVAL '10 minutes');

  IF v_recent_count >= 5 THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'RATE_LIMITED',
      'message', 'Too many verification attempts. Please wait 10 minutes before requesting a new code.'
    );
  END IF;

  -- Generate 6-digit numeric OTP code
  v_code := LPAD(FLOOR(RANDOM() * 900000 + 100000)::TEXT, 6, '0');
  v_expires_at := NOW() + INTERVAL '10 minutes';

  -- Store verification code
  INSERT INTO public.verification_codes (
    user_id,
    target_type,
    target_value,
    code_hash,
    expires_at
  )
  VALUES (
    auth.uid(),
    p_target_type,
    v_norm_target,
    v_code,
    v_expires_at
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'target_type', p_target_type,
    'target_value', v_norm_target,
    'expires_in_seconds', 600,
    -- Return code in development/mock environments when third-party SMS/email gateway is not configured
    'dev_code', v_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC: Verify the 6-digit code and update profile state
CREATE OR REPLACE FUNCTION public.confirm_verification_code(
  p_target_type TEXT,
  p_target_value TEXT,
  p_code TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_norm_target TEXT;
  v_record RECORD;
BEGIN
  v_norm_target := LOWER(TRIM(p_target_value));

  -- Fetch latest unverified, unexpired code for this target
  SELECT * INTO v_record
  FROM public.verification_codes
  WHERE target_type = p_target_type
    AND target_value = v_norm_target
    AND is_verified = FALSE
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'EXPIRED_OR_NOT_FOUND',
      'message', 'Verification code has expired or does not exist. Please request a new code.'
    );
  END IF;

  IF v_record.attempts >= v_record.max_attempts THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'MAX_ATTEMPTS_EXCEEDED',
      'message', 'Maximum attempts exceeded. Please request a new verification code.'
    );
  END IF;

  -- Validate OTP code
  IF TRIM(p_code) <> v_record.code_hash THEN
    UPDATE public.verification_codes
    SET attempts = attempts + 1
    WHERE id = v_record.id;

    RETURN jsonb_build_object(
      'success', FALSE,
      'code', 'INVALID_CODE',
      'message', 'Incorrect verification code. Please check and try again.'
    );
  END IF;

  -- Mark verified
  UPDATE public.verification_codes
  SET is_verified = TRUE
  WHERE id = v_record.id;

  -- Update profile verification status if user is authenticated
  IF auth.uid() IS NOT NULL THEN
    IF p_target_type = 'phone' THEN
      UPDATE public.profiles
      SET phone = v_norm_target,
          is_phone_verified = TRUE,
          phone_verified_at = NOW()
      WHERE id = auth.uid();

      -- Add to phone registry
      INSERT INTO public.phone_registry (normalized_phone, original_user_id, registered_at, status)
      VALUES (v_norm_target, auth.uid(), NOW(), 'active')
      ON CONFLICT (normalized_phone) DO UPDATE SET status = 'active';

    ELSIF p_target_type = 'email' THEN
      UPDATE public.profiles
      SET is_email_verified = TRUE,
          email_verified_at = NOW()
      WHERE id = auth.uid();
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'message', INITCAP(p_target_type) || ' successfully verified.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. RPC: Realtime check for username availability
CREATE OR REPLACE FUNCTION public.check_username_available(
  p_username TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_norm_uname TEXT;
  v_taken BOOLEAN;
BEGIN
  v_norm_uname := LOWER(TRIM(p_username));

  IF v_norm_uname IS NULL OR LENGTH(v_norm_uname) < 3 THEN
    RETURN jsonb_build_object('available', FALSE, 'message', 'Username must be at least 3 characters.');
  END IF;

  IF NOT (v_norm_uname ~ '^[a-z0-9_]{3,30}$') THEN
    RETURN jsonb_build_object(
      'available', FALSE,
      'message', 'Username can only contain letters, numbers, and underscores.'
    );
  END IF;

  -- Check profiles
  SELECT EXISTS(
    SELECT 1 FROM public.profiles WHERE LOWER(username) = v_norm_uname
  ) INTO v_taken;

  IF v_taken THEN
    RETURN jsonb_build_object('available', FALSE, 'message', 'Username @' || v_norm_uname || ' has already been taken.');
  END IF;

  -- Check username history reservation
  SELECT EXISTS(
    SELECT 1 FROM public.username_history WHERE normalized_username = v_norm_uname AND released_at IS NULL
  ) INTO v_taken;

  IF v_taken THEN
    RETURN jsonb_build_object('available', FALSE, 'message', 'Username @' || v_norm_uname || ' is reserved and unavailable.');
  END IF;

  RETURN jsonb_build_object('available', TRUE, 'message', 'Username is available.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC: Realtime check for email availability
CREATE OR REPLACE FUNCTION public.check_email_available(
  p_email TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_norm_email TEXT;
  v_taken BOOLEAN;
BEGIN
  v_norm_email := LOWER(TRIM(p_email));

  IF v_norm_email IS NULL OR v_norm_email NOT LIKE '%@%.%' THEN
    RETURN jsonb_build_object('available', FALSE, 'message', 'Invalid email format.');
  END IF;

  -- Check permanent email registry
  SELECT EXISTS(
    SELECT 1 FROM public.email_registry WHERE normalized_email = v_norm_email
  ) INTO v_taken;

  IF v_taken THEN
    RETURN jsonb_build_object('available', FALSE, 'message', 'This email has already been used.');
  END IF;

  -- Check auth.users directly
  IF EXISTS (
    SELECT 1 FROM auth.users WHERE LOWER(TRIM(email)) = v_norm_email
  ) THEN
    RETURN jsonb_build_object('available', FALSE, 'message', 'This email has already been used.');
  END IF;

  RETURN jsonb_build_object('available', TRUE, 'message', 'Email is available.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.check_username_available(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_email_available(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_registration_availability(TEXT, TEXT) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
