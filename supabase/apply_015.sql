-- ============================================================
-- Migration 015: User Terms & Privacy Policy Consent Tracking
-- ============================================================

-- 1. Add terms consent tracking columns to public.profiles if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'accepted_terms'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN accepted_terms BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'accepted_terms_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN accepted_terms_at TIMESTAMPTZ;
  END IF;
END $$;

-- 2. Update create_profile stored procedure to optionally accept terms consent parameters
CREATE OR REPLACE FUNCTION public.create_profile(
  p_user_id           UUID,
  p_username          TEXT,
  p_display_name       TEXT,
  p_accepted_terms    BOOLEAN DEFAULT TRUE,
  p_accepted_terms_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS public.profiles AS $$
DECLARE
  new_profile public.profiles;
BEGIN
  INSERT INTO public.profiles (id, username, display_name, accepted_terms, accepted_terms_at)
  VALUES (p_user_id, p_username, p_display_name, COALESCE(p_accepted_terms, TRUE), COALESCE(p_accepted_terms_at, NOW()))
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    display_name = EXCLUDED.display_name,
    accepted_terms = EXCLUDED.accepted_terms,
    accepted_terms_at = EXCLUDED.accepted_terms_at,
    updated_at = NOW()
  RETURNING * INTO new_profile;

  RETURN new_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
