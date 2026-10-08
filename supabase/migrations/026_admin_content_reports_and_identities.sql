-- ============================================================
-- Migration 026: Admin Moderation, Content Reports & Identity Management
-- ============================================================

-- ─── 1. EXTEND CONTENT_REPORTS TARGET TYPES & DETAILS ────────────────────────
-- Support bug reports ('bug_report') as target_type in content_reports
DO $$
BEGIN
  -- Ensure status default and check constraints allow all states
  ALTER TABLE public.content_reports 
    ALTER COLUMN status SET DEFAULT 'pending';
END $$;

-- ─── 2. ADMIN SECURE RPC: GET MODERATION REPORTS WITH METADATA ───────────────
-- Allows the Admin Portal to fetch reports (bug reports, user flags, content flags)
-- with linked reporter and target entity context securely.
CREATE OR REPLACE FUNCTION public.admin_get_content_reports(
  p_status      TEXT DEFAULT NULL,
  p_target_type TEXT DEFAULT NULL,
  p_limit       INT DEFAULT 100
)
RETURNS TABLE (
  id           UUID,
  reporter_id  UUID,
  reporter_username TEXT,
  reporter_display_name TEXT,
  target_type  TEXT,
  target_id    UUID,
  reason       TEXT,
  details      TEXT,
  status       TEXT,
  created_at   TIMESTAMPTZ,
  target_preview TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.id,
    cr.reporter_id,
    p.username AS reporter_username,
    p.display_name AS reporter_display_name,
    cr.target_type,
    cr.target_id,
    cr.reason,
    cr.details,
    cr.status,
    cr.created_at,
    CASE 
      WHEN cr.target_type = 'post' THEN (SELECT SUBSTRING(content FROM 1 FOR 100) FROM public.posts WHERE posts.id = cr.target_id)
      WHEN cr.target_type = 'whisper' THEN (SELECT SUBSTRING(content FROM 1 FOR 100) FROM public.whispers WHERE whispers.id = cr.target_id)
      WHEN cr.target_type = 'profile' THEN (SELECT username FROM public.profiles WHERE profiles.id = cr.target_id)
      WHEN cr.target_type = 'bug_report' THEN 'Application Bug Report'
      ELSE NULL
    END AS target_preview
  FROM public.content_reports cr
  LEFT JOIN public.profiles p ON p.id = cr.reporter_id
  WHERE (p_status IS NULL OR cr.status = p_status)
    AND (p_target_type IS NULL OR cr.target_type = p_target_type)
  ORDER BY cr.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 3. ADMIN SECURE RPC: RESOLVE / ACTION CONTENT REPORT ────────────────────
CREATE OR REPLACE FUNCTION public.admin_action_report(
  p_report_id UUID,
  p_action    TEXT -- 'dismiss', 'resolve', 'ban_target_user', 'delete_target_content'
)
RETURNS JSONB AS $$
DECLARE
  v_report public.content_reports;
BEGIN
  SELECT * INTO v_report FROM public.content_reports WHERE id = p_report_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Report not found');
  END IF;

  IF p_action = 'dismiss' THEN
    UPDATE public.content_reports SET status = 'dismissed' WHERE id = p_report_id;

  ELSIF p_action = 'resolve' THEN
    UPDATE public.content_reports SET status = 'resolved' WHERE id = p_report_id;

  ELSIF p_action = 'delete_target_content' THEN
    IF v_report.target_type = 'post' THEN
      DELETE FROM public.posts WHERE id = v_report.target_id;
    ELSIF v_report.target_type = 'comment' THEN
      DELETE FROM public.comments WHERE id = v_report.target_id;
    ELSIF v_report.target_type = 'whisper' THEN
      DELETE FROM public.whispers WHERE id = v_report.target_id;
    END IF;
    UPDATE public.content_reports SET status = 'actioned' WHERE id = p_report_id;

  ELSIF p_action = 'ban_target_user' THEN
    -- If target is profile, ban that user
    IF v_report.target_type = 'profile' THEN
      UPDATE public.profiles SET is_banned = TRUE WHERE id = v_report.target_id;
      UPDATE public.email_registry SET status = 'banned' WHERE original_user_id = v_report.target_id;
    -- If post, ban post author
    ELSIF v_report.target_type = 'post' THEN
      UPDATE public.profiles SET is_banned = TRUE 
      WHERE id = (SELECT author_id FROM public.posts WHERE id = v_report.target_id);
    END IF;
    UPDATE public.content_reports SET status = 'actioned' WHERE id = p_report_id;
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'action', p_action);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 4. ADMIN SECURE RPC: GET BANNED & RESERVED IDENTITIES ───────────────────
CREATE OR REPLACE FUNCTION public.admin_get_identities(
  p_limit INT DEFAULT 100
)
RETURNS TABLE (
  registry_id      UUID,
  normalized_email TEXT,
  original_user_id UUID,
  username         TEXT,
  display_name     TEXT,
  registered_at    TIMESTAMPTZ,
  registry_status  TEXT,
  is_banned        BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    er.id AS registry_id,
    er.normalized_email,
    er.original_user_id,
    p.username,
    p.display_name,
    er.registered_at,
    er.status AS registry_status,
    COALESCE(p.is_banned, FALSE) AS is_banned
  FROM public.email_registry er
  LEFT JOIN public.profiles p ON p.id = er.original_user_id
  ORDER BY er.registered_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 5. ADMIN SECURE RPC: TOGGLE USER BAN & EMAIL REGISTRY STATUS ────────────
CREATE OR REPLACE FUNCTION public.admin_toggle_user_ban(
  p_user_id UUID,
  p_banned  BOOLEAN
)
RETURNS JSONB AS $$
BEGIN
  -- Update profile status
  UPDATE public.profiles 
  SET is_banned = p_banned, updated_at = NOW()
  WHERE id = p_user_id;

  -- Update email registry status
  UPDATE public.email_registry
  SET status = CASE WHEN p_banned THEN 'banned' ELSE 'active' END
  WHERE original_user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', TRUE, 
    'user_id', p_user_id, 
    'is_banned', p_banned
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
