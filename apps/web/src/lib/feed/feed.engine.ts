import { FeedInteractionType, FeedMode, Post } from '@private-voices/shared'

export interface FeedQueryParams {
  userId: string
  mode: FeedMode
  limit?: number
  cursor?: string | null
  communityId?: string
}

export interface CandidateGenerationResult {
  posts: Post[]
  blocksAndMutes: Set<string>
  hiddenPostIds: Set<string>
  interactionWeights: Map<string, number>
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
      limit = 20,
      cursor,
    } = params

    const blockMuteSet = new Set([...userBlocks, ...userMutes])
    const hiddenSet = new Set(hiddenPostIds)

    // 1. STEP 1: Moderation / Safety Filter (MODERATION BEFORE RANKING)
    // Filter out posts blocked, held for review, or originating from blocked/muted authors
    const safePosts = rawPosts.filter((post) => {
      if (!post || !post.id || !post.author_id) return false

      // Author anti-abuse check
      if (blockMuteSet.has(post.author_id)) return false
      if (hiddenSet.has(post.id)) return false

      // Strict Moderation Gate: Exclude blocked or held posts from recommendation boost
      if (post.moderation_status === 'BLOCK' || post.moderation_status === 'HOLD_FOR_REVIEW') {
        return false
      }

      return true
    })

    // 2. STEP 2: Personalization & Anti-Manipulation Signal Weighting
    const authorPostCounts = new Map<string, number>()
    const userAffinityScores = new Map<string, number>()

    // Calculate user affinity score for post authors based on recent positive/negative interactions
    for (const inter of userInteractions) {
      const current = userAffinityScores.get(inter.target_id) || 0
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
        case 'HIDE_POST':
        case 'NOT_INTERESTED':
          delta = -5.0
          break
        case 'REPORT_POST':
          delta = -10.0
          break
      }

      userAffinityScores.set(inter.target_id, current + delta)
    }

    // 3. STEP 3: Mode-Specific Ranking Algorithm Score
    const scoredPosts = safePosts.map((post) => {
      const nowMs = Date.now()
      const createdMs = new Date(post.created_at).getTime()
      const ageHours = Math.max(0.1, (nowMs - createdMs) / (1000 * 60 * 60))

      // Recency decay formula
      const recencyScore = 1 / Math.pow(ageHours + 2, 1.5)

      // Authentic engagement signals
      const likes = post.like_count || post.likes?.[0]?.count || 0
      const comments = post.comment_count || post.comments?.[0]?.count || 0
      const reposts = post.repost_count || post.reposts?.[0]?.count || 0

      const engagementVelocity = (likes * 1.0 + comments * 2.0 + reposts * 3.0) / Math.pow(ageHours + 2, 1.2)
      const userAffinity = userAffinityScores.get(post.author_id) || userAffinityScores.get(post.id) || 0

      let finalScore = 0

      if (mode === 'for-you') {
        // Personalize around genuine user interest, recency, and verified affinity
        finalScore = recencyScore * 40 + userAffinity * 25 + engagementVelocity * 15
      } else if (mode === 'trending') {
        // High engagement velocity + recency
        finalScore = engagementVelocity * 70 + recencyScore * 30
      } else if (mode === 'following') {
        // Chronological with slight boost for high affinity followed creators
        finalScore = recencyScore * 80 + userAffinity * 20
      } else {
        // Latest / Chronological
        finalScore = createdMs
      }

      return { ...post, _rankScore: finalScore }
    })

    // Sort candidates by final score descending
    scoredPosts.sort((a, b) => b._rankScore - a._rankScore)

    // 4. STEP 4: Diversity & Repetition Control (Anti-Feed Domination)
    const diverseFeed: any[] = []
    const MAX_POSTS_PER_AUTHOR = mode === 'for-you' ? 2 : 5

    for (const post of scoredPosts) {
      const count = authorPostCounts.get(post.author_id) || 0
      if (count < MAX_POSTS_PER_AUTHOR) {
        diverseFeed.push(post)
        authorPostCounts.set(post.author_id, count + 1)
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
