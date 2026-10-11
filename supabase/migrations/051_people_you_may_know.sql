-- ==============================================================================
-- Migration 051: People You May Know Recommendation Engine
-- ==============================================================================

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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    -- Return popular active profiles when not authenticated
    RETURN QUERY
    SELECT 
      p.id,
      p.username,
      p.display_name,
      p.avatar_url,
      p.bio,
      0::BIGINT AS mutual_count,
      FALSE AS is_following
    FROM public.profiles p
    ORDER BY p.created_at DESC
    LIMIT p_limit;
    RETURN;
  END IF;

  RETURN QUERY
  WITH my_followings AS (
    SELECT f.following_id
    FROM public.follows f
    WHERE f.follower_id = v_uid
  ),
  candidates_with_mutuals AS (
    -- Candidates who are followed by people I follow (Friends of Friends)
    SELECT 
      f2.following_id AS candidate_id,
      COUNT(f2.follower_id)::BIGINT AS mutuals
    FROM public.follows f2
    JOIN my_followings mf ON f2.follower_id = mf.following_id
    WHERE f2.following_id <> v_uid
      AND f2.following_id NOT IN (SELECT mf2.following_id FROM my_followings mf2)
    GROUP BY f2.following_id
  ),
  all_candidates AS (
    -- Combine with other active profiles if mutuals are few
    SELECT 
      c.candidate_id,
      c.mutuals
    FROM candidates_with_mutuals c

    UNION ALL

    SELECT 
      p.id AS candidate_id,
      0::BIGINT AS mutuals
    FROM public.profiles p
    WHERE p.id <> v_uid
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
  GROUP BY p.id, p.username, p.display_name, p.avatar_url, p.bio, ac.mutuals
  ORDER BY ac.mutuals DESC, p.created_at DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_people_you_may_know(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_people_you_may_know(INT) TO anon;

NOTIFY pgrst, 'reload schema';
