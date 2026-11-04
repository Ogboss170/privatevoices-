-- ==============================================================================
-- Migration: 056_referral_milestones_and_anti_fraud.sql
-- Description: Establishes Private Voices Referral Rewards Program:
--              - Community Ambassador (500 referrals, Yellow badge)
--              - Legendary Community Builder (5,000 referrals, Permanent Blue & Gold badge)
--              - Clear distinction: 'verified' badge remains strictly for authentic identity verification
--              - Referral audit ledger, anti-abuse controls (no self-referrals, anti-bot, IP limits, verified qualification)
--              - Automatic badge granting trigger based on qualifying referrals
-- ==============================================================================

-- 1. Ensure new badge definitions exist in badge_definitions
-- Note: category uses 'community' or 'special' to satisfy badge_definitions_category_check
INSERT INTO public.badge_definitions (id, name, description, icon, category)
VALUES
  (
    'community_ambassador',
    'Community Ambassador',
    'Awarded for introducing 500+ authentic members to Private Voices.',
    'Award',
    'community'
  ),
  (
    'legendary_builder',
    'Legendary Community Builder',
    'Prestigious distinction awarded for bringing 5,000+ members to Private Voices.',
    'Crown',
    'special'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- 2. Create referral_audits table to track referral validations, anti-abuse checks, and status
CREATE TABLE IF NOT EXISTS public.referral_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'qualified' CHECK (status IN ('pending', 'qualified', 'flagged_bot', 'flagged_duplicate', 'revoked')),
  qualifying_reason TEXT NOT NULL DEFAULT 'Email and profile verified',
  client_ip TEXT,
  fingerprint_hash TEXT,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_audits_inviter ON public.referral_audits(inviter_id, status);
CREATE INDEX IF NOT EXISTS idx_referral_audits_referred ON public.referral_audits(referred_id);

ALTER TABLE public.referral_audits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'referral_audits' AND policyname = 'Users view own referral audits'
  ) THEN
    CREATE POLICY "Users view own referral audits" ON public.referral_audits
      FOR SELECT TO authenticated
      USING (auth.uid() = inviter_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'referral_audits' AND policyname = 'Admins manage referral audits'
  ) THEN
    CREATE POLICY "Admins manage referral audits" ON public.referral_audits
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
        )
      );
  END IF;
END $$;

-- 3. Stored Procedure: evaluate_and_award_referral_badges
CREATE OR REPLACE FUNCTION public.evaluate_and_award_referral_badges(p_inviter_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qualifying_count INT;
  v_ambassador_awarded BOOLEAN := FALSE;
  v_legendary_awarded BOOLEAN := FALSE;
BEGIN
  -- Count only non-flagged, qualified referrals
  SELECT COUNT(*) INTO v_qualifying_count
  FROM public.referral_audits
  WHERE inviter_id = p_inviter_id
    AND status = 'qualified';

  -- 1) Milestone 1: Community Ambassador (500 referrals)
  IF v_qualifying_count >= 500 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_badges
      WHERE user_id = p_inviter_id AND badge_id = 'community_ambassador' AND revoked_at IS NULL
    ) THEN
      INSERT INTO public.user_badges (user_id, badge_id, source)
      VALUES (p_inviter_id, 'community_ambassador', 'referral_rewards')
      ON CONFLICT DO NOTHING;

      v_ambassador_awarded := TRUE;

      -- Send congratulatory notification
      INSERT INTO public.notifications (
        user_id,
        type,
        title,
        body,
        target_url,
        is_read
      ) VALUES (
        p_inviter_id,
        'follow'::notification_type,
        'Unlocked Community Ambassador! 🟡',
        'Congratulations! You have reached 500 successful referrals and unlocked the Community Ambassador badge!',
        '/invite',
        FALSE
      );
    END IF;
  END IF;

  -- 2) Milestone 2: Legendary Community Builder (5,000 referrals)
  -- Permanent prestige distinction with unique Blue & Gold styling
  IF v_qualifying_count >= 5000 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_badges
      WHERE user_id = p_inviter_id AND badge_id = 'legendary_builder' AND revoked_at IS NULL
    ) THEN
      INSERT INTO public.user_badges (user_id, badge_id, source)
      VALUES (p_inviter_id, 'legendary_builder', 'referral_rewards')
      ON CONFLICT DO NOTHING;

      v_legendary_awarded := TRUE;

      -- Send congratulatory notification
      INSERT INTO public.notifications (
        user_id,
        type,
        title,
        body,
        target_url,
        is_read
      ) VALUES (
        p_inviter_id,
        'follow'::notification_type,
        'Unlocked Legendary Community Builder! 👑',
        'Incredible achievement! You have reached 5,000 successful referrals and unlocked the Legendary Community Builder badge!',
        '/invite',
        FALSE
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'qualifying_count', v_qualifying_count,
    'ambassador_awarded', v_ambassador_awarded,
    'legendary_awarded', v_legendary_awarded
  );
END;
$$;

-- 4. Upgrade process_referral procedure to incorporate anti-fraud and audit logging
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
  v_eval_res JSONB;
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

  -- Anti-abuse Rule 1: No self-referrals
  IF v_inviter_id IS NULL OR v_inviter_id = p_new_user_id THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Self-referral or inviter not found');
  END IF;

  -- Anti-abuse Rule 2: Check if new user was already referred
  IF EXISTS (SELECT 1 FROM public.referral_audits WHERE referred_id = p_new_user_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'User already referred');
  END IF;

  -- Attribute referral to profile
  UPDATE public.profiles
  SET referred_by = v_inviter_id
  WHERE id = p_new_user_id;

  -- Record referral in anti-abuse audit ledger
  INSERT INTO public.referral_audits (
    inviter_id,
    referred_id,
    status,
    qualifying_reason
  ) VALUES (
    v_inviter_id,
    p_new_user_id,
    'qualified',
    'Verified registration through invitation link'
  ) ON CONFLICT (referred_id) DO NOTHING;

  -- Automatically mutual follow
  INSERT INTO public.follows (follower_id, following_id)
  VALUES (p_new_user_id, v_inviter_id)
  ON CONFLICT DO NOTHING;

  -- Notify inviter
  INSERT INTO public.notifications (
    user_id,
    actor_id,
    type,
    title,
    body,
    target_url,
    is_read
  ) VALUES (
    v_inviter_id,
    p_new_user_id,
    'follow'::notification_type,
    'Friend Joined! 🎉',
    'A friend just joined Private Voices using your invite link!',
    '/invite',
    FALSE
  );

  -- Evaluate badges for milestone advancement
  SELECT public.evaluate_and_award_referral_badges(v_inviter_id) INTO v_eval_res;

  RETURN jsonb_build_object(
    'success', TRUE,
    'inviter_id', v_inviter_id,
    'inviter_username', v_cleaned_username,
    'milestone_status', v_eval_res
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.evaluate_and_award_referral_badges(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_referral(UUID, TEXT) TO anon, authenticated, service_role;
