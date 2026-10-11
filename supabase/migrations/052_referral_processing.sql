-- ==============================================================================
-- Migration 052: Referral Processing Engine
-- Supports counting invited friends and automatically establishing mutual follows
-- ==============================================================================

-- 1. Ensure referred_by column exists on profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by);

-- 2. Stored procedure to process referral links on account registration
CREATE OR REPLACE FUNCTION public.process_referral(
  p_new_user_id UUID,
  p_inviter_username TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inviter_id UUID;
  v_cleaned_username TEXT;
BEGIN
  IF p_inviter_username IS NULL OR TRIM(p_inviter_username) = '' THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'No inviter provided');
  END IF;

  v_cleaned_username := LOWER(TRIM(REPLACE(p_inviter_username, '@', '')));

  -- Look up the inviter
  SELECT id INTO v_inviter_id
  FROM public.profiles
  WHERE LOWER(username) = v_cleaned_username
  LIMIT 1;

  -- Ensure valid user and not self-referral
  IF v_inviter_id IS NOT NULL AND v_inviter_id <> p_new_user_id THEN
    -- Attribute referral
    UPDATE public.profiles
    SET referred_by = v_inviter_id
    WHERE id = p_new_user_id;

    -- Automatically follow the inviter
    INSERT INTO public.follows (follower_id, following_id)
    VALUES (p_new_user_id, v_inviter_id)
    ON CONFLICT DO NOTHING;

    RETURN jsonb_build_object(
      'success', TRUE,
      'inviter_id', v_inviter_id,
      'inviter_username', v_cleaned_username
    );
  END IF;

  RETURN jsonb_build_object('success', FALSE, 'message', 'Inviter not found or invalid');
END;
$$;

-- Grant execution to all roles
GRANT EXECUTE ON FUNCTION public.process_referral(UUID, TEXT) TO anon, authenticated, service_role;
