-- Migration 038: Creator Insights & Community Growth Analytics
-- 1. Helper function: Get post creator insights (impressions, listeners/viewers, bookmark rate)
-- 2. Helper function: Get community growth & engagement metrics (member acquisition, active contributors, total interactions)

-- ─── 1. POST CREATOR METRICS (STRICTLY AUTHOR-ONLY) ──────────────────────────
CREATE OR REPLACE FUNCTION public.get_post_creator_metrics(p_post_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_author_id UUID;
  v_caller_id UUID;
  v_unique_views INT := 0;
  v_total_impressions INT := 0;
  v_likes INT := 0;
  v_comments INT := 0;
  v_reposts INT := 0;
  v_bookmarks INT := 0;
  v_unique_listeners INT := 0;
  v_bookmark_rate NUMERIC := 0;
  v_engagement_rate NUMERIC := 0;
BEGIN
  v_caller_id := auth.uid();

  -- Get post author
  SELECT author_id INTO v_author_id
  FROM public.posts
  WHERE id = p_post_id;

  IF v_author_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Enforce author-only restriction
  IF v_caller_id IS NULL OR v_caller_id <> v_author_id THEN
    RAISE EXCEPTION 'Access denied: Creator metrics are author-only.';
  END IF;

  -- 1. Unique 24h listeners/viewers (excluding author)
  SELECT COUNT(DISTINCT viewer_id), COUNT(*) INTO v_unique_views, v_total_impressions
  FROM public.post_views
  WHERE post_id = p_post_id
    AND viewer_id <> v_author_id;

  v_unique_listeners := COALESCE(v_unique_views, 0);
  v_total_impressions := COALESCE(v_total_impressions, 0);

  -- 2. Interactions count
  SELECT COUNT(*) INTO v_likes FROM public.likes WHERE post_id = p_post_id;
  SELECT COUNT(*) INTO v_comments FROM public.comments WHERE post_id = p_post_id;
  SELECT COUNT(*) INTO v_reposts FROM public.reposts WHERE post_id = p_post_id;
  SELECT COUNT(*) INTO v_bookmarks FROM public.saved_posts WHERE post_id = p_post_id;

  -- 3. Calculate rates
  IF v_unique_listeners > 0 THEN
    v_bookmark_rate := ROUND((v_bookmarks::NUMERIC / v_unique_listeners::NUMERIC) * 100, 1);
    v_engagement_rate := ROUND(((v_likes + v_comments + v_reposts + v_bookmarks)::NUMERIC / v_unique_listeners::NUMERIC) * 100, 1);
  ELSE
    v_bookmark_rate := 0;
    v_engagement_rate := 0;
  END IF;

  RETURN jsonb_build_object(
    'postId', p_post_id,
    'impressions', GREATEST(v_total_impressions, v_unique_listeners),
    'uniqueListeners', v_unique_listeners,
    'uniqueViews', v_unique_listeners,
    'likes', v_likes,
    'comments', v_comments,
    'reposts', v_reposts,
    'bookmarks', v_bookmarks,
    'bookmarkRate', v_bookmark_rate,
    'engagementRate', v_engagement_rate
  );
END;
$$;

-- ─── 2. COMMUNITY GROWTH & ENGAGEMENT METRICS ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_community_growth_metrics(p_community_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_members INT := 0;
  v_new_members_7d INT := 0;
  v_new_members_30d INT := 0;
  v_total_posts INT := 0;
  v_posts_7d INT := 0;
  v_active_contributors_30d INT := 0;
  v_total_likes INT := 0;
  v_total_comments INT := 0;
  v_growth_rate_7d NUMERIC := 0;
BEGIN
  -- Total members
  SELECT COUNT(*) INTO v_total_members
  FROM public.community_members
  WHERE community_id = p_community_id;

  -- Member acquisition trends (7d and 30d)
  SELECT COUNT(*) INTO v_new_members_7d
  FROM public.community_members
  WHERE community_id = p_community_id
    AND created_at >= (NOW() - INTERVAL '7 days');

  SELECT COUNT(*) INTO v_new_members_30d
  FROM public.community_members
  WHERE community_id = p_community_id
    AND created_at >= (NOW() - INTERVAL '30 days');

  -- Posts & discussion activity
  SELECT COUNT(*) INTO v_total_posts
  FROM public.posts
  WHERE community_id = p_community_id;

  SELECT COUNT(*) INTO v_posts_7d
  FROM public.posts
  WHERE community_id = p_community_id
    AND created_at >= (NOW() - INTERVAL '7 days');

  -- Active unique contributors in last 30d
  SELECT COUNT(DISTINCT author_id) INTO v_active_contributors_30d
  FROM public.posts
  WHERE community_id = p_community_id
    AND created_at >= (NOW() - INTERVAL '30 days');

  -- Aggregated community engagements (likes and comments across all posts)
  SELECT COUNT(*) INTO v_total_likes
  FROM public.likes l
  JOIN public.posts p ON p.id = l.post_id
  WHERE p.community_id = p_community_id;

  SELECT COUNT(*) INTO v_total_comments
  FROM public.comments c
  JOIN public.posts p ON p.id = c.post_id
  WHERE p.community_id = p_community_id;

  -- 7-day growth percentage
  IF (v_total_members - v_new_members_7d) > 0 THEN
    v_growth_rate_7d := ROUND((v_new_members_7d::NUMERIC / (v_total_members - v_new_members_7d)::NUMERIC) * 100, 1);
  ELSE
    v_growth_rate_7d := CASE WHEN v_total_members > 0 THEN 100 ELSE 0 END;
  END IF;

  RETURN jsonb_build_object(
    'communityId', p_community_id,
    'totalMembers', v_total_members,
    'newMembers7d', v_new_members_7d,
    'newMembers30d', v_new_members_30d,
    'growthRate7d', v_growth_rate_7d,
    'totalPosts', v_total_posts,
    'posts7d', v_posts_7d,
    'activeContributors30d', v_active_contributors_30d,
    'totalLikes', v_total_likes,
    'totalComments', v_total_comments,
    'totalInteractions', (v_total_likes + v_total_comments)
  );
END;
$$;
