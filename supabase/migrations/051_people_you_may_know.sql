-- ==============================================================================
-- Migration 051: People You May Know Recommendation Engine
-- ==============================================================================

DROP FUNCTION IF EXISTS public.get_people_you_may_know(INT);

CREATE OR REPLACE FUNCTION public.get_people_you_may_know(
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  mutual_count BIGINT,
  is_following BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH current_user_ctx AS (
    SELECT auth.uid() AS uid
  ),
  my_followings AS (
    SELECT f.following_id
    FROM public.follows f, current_user_ctx ctx
    WHERE ctx.uid IS NOT NULL AND f.follower_id = ctx.uid
  ),
  candidates_with_mutuals AS (
    -- Candidates who are followed by people I follow (Friends of Friends)
    SELECT 
      f2.following_id AS candidate_id,
      COUNT(f2.follower_id)::BIGINT AS mutuals
    FROM public.follows f2
    JOIN my_followings mf ON f2.follower_id = mf.following_id
    JOIN current_user_ctx ctx ON TRUE
    WHERE (ctx.uid IS NULL OR f2.following_id <> ctx.uid)
      AND f2.following_id NOT IN (SELECT mf2.following_id FROM my_followings mf2)
    GROUP BY f2.following_id
  ),
  all_candidates AS (
    SELECT 
      c.candidate_id,
      c.mutuals
    FROM candidates_with_mutuals c

    UNION ALL

    SELECT 
      p.id AS candidate_id,
      0::BIGINT AS mutuals
    FROM public.profiles p
    LEFT JOIN current_user_ctx ctx ON TRUE
    WHERE (ctx.uid IS NULL OR p.id <> ctx.uid)
      AND p.id NOT IN (SELECT mf.following_id FROM my_followings mf)
      AND p.id NOT IN (SELECT c.candidate_id FROM candidates_with_mutuals c)
  )
  SELECT 
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.bio,
    ac.mutuals AS mutual_count,
    FALSE AS is_following
  FROM all_candidates ac
  JOIN public.profiles p ON p.id = ac.candidate_id
  LEFT JOIN public.privacy_settings ps ON ps.user_id = p.id
  WHERE (ps.show_in_recommendations IS NULL OR ps.show_in_recommendations = TRUE)
  GROUP BY p.id, p.username, p.display_name, p.avatar_url, p.bio, p.created_at, ac.mutuals
  ORDER BY ac.mutuals DESC, p.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_people_you_may_know(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_people_you_may_know(INT) TO anon;

NOTIFY pgrst, 'reload schema';
