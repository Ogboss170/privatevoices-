import type { FeedInteractionType, FeedMode } from '@private-voices/shared'

export interface RankingWeights {
  engagement: number
  recency: number
  relationship: number
  interestMatch: number
  communityRelevance: number
  quality: number
  trending: number
}

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  engagement: 0.20,
  recency: 0.20,
  relationship: 0.15,
  interestMatch: 0.15,
  communityRelevance: 0.15,
  quality: 0.10,
  trending: 0.05,
}

export class FeedAlgorithmEngine {
  /**
   * Complete Feed Pipeline:
   * Visibility & Permission -> Moderation Filter -> Candidate Generation -> Personalization Signals -> Ranking -> Diversity Control -> Cursor Output
   */
  static processAndRankFeed(params: {
    rawPosts: any[]
    userId: string
    mode: FeedMode
    userBlocks: string[]
    userMutes: string[]
    hiddenPostIds: string[]
    userInteractions: { target_id: string; event_type: FeedInteractionType; weight?: number }[]
    userJoinedCommunityIds?: string[]
    weights?: Partial<RankingWeights>
    limit?: number
    cursor?: string | null
  }): { items: any[]; nextCursor: string | null; hasMore: boolean } {
    const {
      rawPosts,
      userId,
      mode,
      userBlocks = [],
      userMutes = [],
      hiddenPostIds = [],
      userInteractions = [],
      userJoinedCommunityIds = [],
      weights: customWeights,
      limit = 20,
      cursor,
    } = params

    const weights = { ...DEFAULT_RANKING_WEIGHTS, ...customWeights }
    const blockMuteSet = new Set([...userBlocks, ...userMutes])
    const hiddenSet = new Set(hiddenPostIds)
    const joinedCommunitiesSet = new Set(userJoinedCommunityIds)

    // 1. STEP 1: Authorization, Privacy & Moderation Filter
    const safePosts = rawPosts.filter((post) => {
      if (!post || !post.id || !post.author_id) return false

      // Author anti-abuse check
      if (blockMuteSet.has(post.author_id)) return false
      if (hiddenSet.has(post.id)) return false

      // Moderation Gate
      const modStatus = post.moderation_status
      if (modStatus === 'BLOCK' || modStatus === 'HOLD_FOR_REVIEW') {
        return false
      }

      // MANDATORY SERVER-SIDE AUTHORIZATION FOR PRIVATE COMMUNITIES
      // Private Community content must NEVER appear to unauthorized users
      if (post.community && post.community.privacy === 'private') {
        const isMember = joinedCommunitiesSet.has(post.community.id || post.community_id)
        if (!isMember) {
          return false
        }
      }

      return true
    })

    // 2. STEP 2: Personalization & Signal Weighting
    const userAffinityScores = new Map<string, number>()
    const communityAffinityScores = new Map<string, number>()

    for (const inter of userInteractions) {
      let delta = 0

      switch (inter.event_type) {
        case 'LIKE_POST':
          delta = 2.0
          break
        case 'COMMENT_POST':
          delta = 3.0
          break
        case 'REPOST_POST':
          delta = 4.0
          break
        case 'SAVE_POST':
          delta = 3.5
          break
        case 'SHARE_POST':
          delta = 4.0
          break
        case 'OPEN_COMMUNITY':
          delta = 3.0
          break
        case 'JOIN_COMMUNITY':
          delta = 5.0
          break
        case 'FOLLOW_COMMUNITY':
          delta = 4.0
          break
        case 'HIDE_POST':
        case 'NOT_INTERESTED':
          delta = -5.0
          break
        case 'REPORT_POST':
          delta = -10.0
          break
      }

      const currentAuthor = userAffinityScores.get(inter.target_id) || 0
      userAffinityScores.set(inter.target_id, currentAuthor + delta)

      const currentComm = communityAffinityScores.get(inter.target_id) || 0
      communityAffinityScores.set(inter.target_id, currentComm + delta)
    }

    // 3. STEP 3: Multi-Signal Ranking Algorithm Score
    const scoredPosts = safePosts.map((post) => {
      const nowMs = Date.now()
      const createdMs = new Date(post.created_at).getTime()
      const ageHours = Math.max(0.1, (nowMs - createdMs) / (1000 * 60 * 60))

      // Signal 1: Recency
      const recencyScore = 1 / Math.pow(ageHours + 2, 1.5)

      // Signal 2: Engagement
      const likes = post.like_count || post.likes?.[0]?.count || 0
      const comments = post.comment_count || post.comments?.[0]?.count || 0
      const reposts = post.repost_count || post.reposts?.[0]?.count || 0
      const rawEngagement = likes * 1.0 + comments * 2.0 + reposts * 3.0
      const engagementScore = rawEngagement / Math.pow(ageHours + 2, 1.2)

      // Signal 3: Relationship / Author Affinity
      const authorAffinity = userAffinityScores.get(post.author_id) || 0

      // Signal 4: Community Relevance
      let commScore = 0
      if (post.community_id) {
        const isJoined = joinedCommunitiesSet.has(post.community_id)
        const commAffinity = communityAffinityScores.get(post.community_id) || 0
        commScore = (isJoined ? 5.0 : 1.0) + commAffinity
      }

      let finalScore = 0

      if (mode === 'for-you') {
        finalScore =
          engagementScore * (weights.engagement * 100) +
          recencyScore * (weights.recency * 100) +
          authorAffinity * (weights.relationship * 10) +
          commScore * (weights.communityRelevance * 10)
      } else if (mode === 'community') {
        // Community tab prioritizes joined communities & active discussions
        const isJoined = post.community_id && joinedCommunitiesSet.has(post.community_id)
        finalScore = (isJoined ? 50 : 10) + commScore * 10 + recencyScore * 40 + engagementScore * 20
      } else if (mode === 'trending') {
        finalScore = engagementScore * 70 + recencyScore * 30
      } else if (mode === 'following') {
        finalScore = recencyScore * 80 + authorAffinity * 20
      } else {
        // Latest / Chronological
        finalScore = createdMs
      }

      return { ...post, _rankScore: finalScore }
    })

    // Sort candidates by final score descending
    scoredPosts.sort((a, b) => b._rankScore - a._rankScore)

    // 4. STEP 4: Diversity & Repetition Control (Max 2 consecutive posts from same Community or Author)
    const diverseFeed: any[] = []
    const authorPostCounts = new Map<string, number>()
    const communityPostCounts = new Map<string, number>()
    let lastCommunityId: string | null = null
    let consecutiveCommCount = 0

    for (const post of scoredPosts) {
      const authorCount = authorPostCounts.get(post.author_id) || 0
      const commId = post.community_id || null
      const commCount = commId ? communityPostCounts.get(commId) || 0 : 0

      // Rule: Max 2 consecutive posts from the same Community in For-You
      if (mode === 'for-you' && commId && commId === lastCommunityId && consecutiveCommCount >= 2) {
        continue
      }

      // Max 3 posts per author in For-You
      const MAX_PER_AUTHOR = mode === 'for-you' ? 3 : 10
      if (authorCount >= MAX_PER_AUTHOR) {
        continue
      }

      diverseFeed.push(post)
      authorPostCounts.set(post.author_id, authorCount + 1)
      if (commId) {
        communityPostCounts.set(commId, commCount + 1)
        if (commId === lastCommunityId) {
          consecutiveCommCount++
        } else {
          lastCommunityId = commId
          consecutiveCommCount = 1
        }
      } else {
        lastCommunityId = null
        consecutiveCommCount = 0
      }
    }

    // 5. STEP 5: Cursor Pagination
    let filteredItems = diverseFeed

    if (cursor) {
      const cursorIndex = filteredItems.findIndex((p) => p.id === cursor)
      if (cursorIndex !== -1) {
        filteredItems = filteredItems.slice(cursorIndex + 1)
      }
    }

    const pageItems = filteredItems.slice(0, limit)
    const hasMore = filteredItems.length > limit
    const nextCursor = hasMore && pageItems.length > 0 ? pageItems[pageItems.length - 1].id : null

    return {
      items: pageItems,
      nextCursor,
      hasMore,
    }
  }
}
