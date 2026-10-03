-- ============================================================
-- Migration 016: In-Built Multi-Layer Moderation & Safety System
-- ============================================================

-- 1. Create Enums for Moderation Levels, Action Types, and Case Status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'moderation_action_enum') THEN
    CREATE TYPE moderation_action_enum AS ENUM (
      'ALLOW',
      'ALLOW_AND_FLAG',
      'BLUR_RESTRICT',
      'HOLD_FOR_REVIEW',
      'REMOVE',
      'RESTRICT_ACCOUNT',
      'SUSPEND_TEMPORARY',
      'BAN_PERMANENT'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'moderation_risk_level') THEN
    CREATE TYPE moderation_risk_level AS ENUM (
      'LOW',
      'MEDIUM',
      'HIGH',
      'CRITICAL'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'moderation_case_status') THEN
    CREATE TYPE moderation_case_status AS ENUM (
      'PENDING',
      'UNDER_REVIEW',
      'RESOLVED',
      'DISMISSED',
      'APPEALED'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appeal_status_enum') THEN
    CREATE TYPE appeal_status_enum AS ENUM (
      'PENDING',
      'UNDER_REVIEW',
      'APPROVED',
      'REJECTED'
    );
  END IF;
END $$;

-- 2. Moderation Cases Table
CREATE TABLE IF NOT EXISTS public.moderation_cases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type     TEXT NOT NULL, -- 'post' | 'comment' | 'reply' | 'whisper' | 'message' | 'story' | 'profile' | 'community'
  target_id       UUID NOT NULL,
  author_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reported_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason          TEXT NOT NULL,
  details         TEXT,
  risk_level      moderation_risk_level NOT NULL DEFAULT 'LOW',
  status          moderation_case_status NOT NULL DEFAULT 'PENDING',
  action_taken    moderation_action_enum NOT NULL DEFAULT 'ALLOW',
  category_scores JSONB DEFAULT '{}'::jsonb,
  assigned_to     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS moderation_cases_target_idx ON public.moderation_cases(target_type, target_id);
CREATE INDEX IF NOT EXISTS moderation_cases_author_idx ON public.moderation_cases(author_id);
CREATE INDEX IF NOT EXISTS moderation_cases_status_risk_idx ON public.moderation_cases(status, risk_level DESC);

-- 3. Moderation Actions Log Table
CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID REFERENCES public.moderation_cases(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  moderator_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action          moderation_action_enum NOT NULL,
  reason          TEXT NOT NULL,
  category        TEXT,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS moderation_actions_user_idx ON public.moderation_actions(user_id);
CREATE INDEX IF NOT EXISTS moderation_actions_case_idx ON public.moderation_actions(case_id);

-- 4. User Safety & Abuse Scores Table
CREATE TABLE IF NOT EXISTS public.user_safety_scores (
  user_id                  UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  safety_score             INTEGER NOT NULL DEFAULT 100, -- 0 to 100
  strike_count             INTEGER NOT NULL DEFAULT 0,
  reports_received_count   INTEGER NOT NULL DEFAULT 0,
  spam_violations_count    INTEGER NOT NULL DEFAULT 0,
  rate_limit_hits_count    INTEGER NOT NULL DEFAULT 0,
  is_restricted            BOOLEAN NOT NULL DEFAULT FALSE,
  restricted_until         TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Content Appeals Table
CREATE TABLE IF NOT EXISTS public.moderation_appeals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID NOT NULL REFERENCES public.moderation_cases(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  explanation     TEXT NOT NULL,
  status          appeal_status_enum NOT NULL DEFAULT 'PENDING',
  reviewer_notes  TEXT,
  reviewed_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS moderation_appeals_user_idx ON public.moderation_appeals(user_id);
CREATE INDEX IF NOT EXISTS moderation_appeals_case_idx ON public.moderation_appeals(case_id);

-- 6. Rate Limit & Spam Tracking (Server-side tracking helper table)
CREATE TABLE IF NOT EXISTS public.rate_limit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ip_hash       TEXT,
  endpoint      TEXT NOT NULL,
  content_hash  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rate_limit_logs_user_endpoint_idx ON public.rate_limit_logs(user_id, endpoint, created_at DESC);
CREATE INDEX IF NOT EXISTS rate_limit_logs_ip_endpoint_idx ON public.rate_limit_logs(ip_hash, endpoint, created_at DESC);

-- 7. Add moderation fields to content tables if not present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'moderation_status'
  ) THEN
    ALTER TABLE public.posts ADD COLUMN moderation_status moderation_action_enum NOT NULL DEFAULT 'ALLOW';
    ALTER TABLE public.posts ADD COLUMN is_sensitive BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'comments' AND column_name = 'moderation_status'
  ) THEN
    ALTER TABLE public.comments ADD COLUMN moderation_status moderation_action_enum NOT NULL DEFAULT 'ALLOW';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'whispers' AND column_name = 'moderation_status'
  ) THEN
    ALTER TABLE public.whispers ADD COLUMN moderation_status moderation_action_enum NOT NULL DEFAULT 'ALLOW';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'moderation_status'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN moderation_status moderation_action_enum NOT NULL DEFAULT 'ALLOW';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'stories' AND column_name = 'moderation_status'
  ) THEN
    ALTER TABLE public.stories ADD COLUMN moderation_status moderation_action_enum NOT NULL DEFAULT 'ALLOW';
  END IF;
END $$;

-- 8. Enable Row-Level Security
ALTER TABLE public.moderation_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_safety_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_logs ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins and owners can view moderation cases" ON public.moderation_cases;
  CREATE POLICY "Admins and owners can view moderation cases" ON public.moderation_cases
    FOR SELECT USING (auth.role() = 'service_role' OR auth.uid() = author_id);

  DROP POLICY IF EXISTS "Users can view their own safety score" ON public.user_safety_scores;
  CREATE POLICY "Users can view their own safety score" ON public.user_safety_scores
    FOR SELECT USING (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Users can insert and view their own appeals" ON public.moderation_appeals;
  CREATE POLICY "Users can insert and view their own appeals" ON public.moderation_appeals
    FOR ALL USING (auth.uid() = user_id);
END $$;
