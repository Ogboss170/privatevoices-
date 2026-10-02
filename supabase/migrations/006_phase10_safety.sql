-- ============================================================
-- Private Voices — Phase 10 Safety & Security Primitives Schema
-- ============================================================

-- ─── BLOCKS & MUTES ────────────────────────────────────────────────────────
CREATE TABLE public.user_blocks (
  blocker_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT no_self_block CHECK (blocker_id != blocked_id)
);

CREATE INDEX user_blocks_blocker_idx ON public.user_blocks(blocker_id);

CREATE TABLE public.user_mutes (
  muter_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  muted_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (muter_id, muted_id),
  CONSTRAINT no_self_mute CHECK (muter_id != muted_id)
);

-- ─── USER SUSPENSIONS ──────────────────────────────────────────────────────
CREATE TABLE public.user_suspensions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason        TEXT NOT NULL,
  suspended_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at    TIMESTAMPTZ, -- NULL means permanent suspension
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── AUDIT LOGS ────────────────────────────────────────────────────────────
CREATE TABLE public.audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  target_type   TEXT,
  target_id     UUID,
  details       JSONB,
  ip_address    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX audit_logs_created_at_idx ON public.audit_logs(created_at DESC);

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_mutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_suspensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Blocks RLS
CREATE POLICY "Users view own blocks" ON public.user_blocks FOR SELECT USING (auth.uid() = blocker_id);
CREATE POLICY "Users insert own blocks" ON public.user_blocks FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "Users delete own blocks" ON public.user_blocks FOR DELETE USING (auth.uid() = blocker_id);

-- Mutes RLS
CREATE POLICY "Users view own mutes" ON public.user_mutes FOR SELECT USING (auth.uid() = muter_id);
CREATE POLICY "Users insert own mutes" ON public.user_mutes FOR INSERT WITH CHECK (auth.uid() = muter_id);
CREATE POLICY "Users delete own mutes" ON public.user_mutes FOR DELETE USING (auth.uid() = muter_id);
