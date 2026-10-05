'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import PostCard from '@/components/feed/PostCard'
import StoriesTray from '@/components/stories/StoriesTray'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { Post, FeedMode } from '@private-voices/shared'
import { extractPostMediaAndCleanContent } from '@private-voices/shared'
import { FeedAlgorithmEngine } from '@/lib/feed/feed.engine'

const TABS = [
  { id: 'for-you', label: 'For You' },
  { id: 'following', label: 'Following' },
  { id: 'trending', label: 'Trending' },
  { id: 'latest', label: 'Latest' },
  { id: 'community', label: 'Community' },
]

export default function FeedPage() {
  const supabase = createSupabaseBrowserClient()
  const [activeTab, setActiveTab] = useState<FeedMode>('for-you')
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | undefined>()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
  }, [supabase])

  const fetchPosts = useCallback(async (isInitial = false) => {
    if (isInitial && posts.length === 0) {
      setLoading(true)
    }

    try {
      // 1. Fetch raw candidate posts with author and community relations
      let query = supabase
        .from('posts')
        .select('*, author:profiles(id, username, display_name, avatar_url), community:communities(id, name, slug, avatar_url, privacy)')
        .order('created_at', { ascending: false })

      if (activeTab === 'following' && currentUserId) {
        const { data: follows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', currentUserId)

        const followingIds = (follows ?? []).map((f) => f.following_id)
        followingIds.push(currentUserId)
        query = query.in('author_id', followingIds)
      } else if (activeTab === 'community') {
        query = query.not('community_id', 'is', null)
      }

      let { data: rawPosts, error } = await query

      if (error || !rawPosts) {
        console.warn('Feed query join notice, using fallback select:', error?.message)
        let fallbackQuery = supabase
          .from('posts')
          .select('*')
          .order('created_at', { ascending: false })

        if (activeTab === 'community') {
          fallbackQuery = fallbackQuery.not('community_id', 'is', null)
        }
        const fallbackRes = await fallbackQuery
        rawPosts = fallbackRes.data
      }

      // 2. Fetch User Safety Filters & Joined Communities
      let userBlocks: string[] = []
      let userMutes: string[] = []
      let userInteractions: any[] = []
      let userJoinedCommunityIds: string[] = []

      if (currentUserId) {
        const [{ data: blocks }, { data: mutes }, { data: inters }, { data: memberships }] = await Promise.all([
          supabase.from('user_blocks').select('blocked_id').eq('blocker_id', currentUserId),
          supabase.from('user_mutes').select('muted_id').eq('muter_id', currentUserId),
          supabase.from('feed_interactions').select('*').eq('user_id', currentUserId).limit(100),
          supabase.from('community_members').select('community_id').eq('user_id', currentUserId),
        ])

        userBlocks = (blocks || []).map((b) => b.blocked_id)
        userMutes = (mutes || []).map((m) => m.muted_id)
        userInteractions = inters || []
        userJoinedCommunityIds = (memberships || []).map((m) => m.community_id)
      }

      // 3. Process candidates through Moderation-First Feed Algorithm Engine with Community Signals
      const engineResult = FeedAlgorithmEngine.processAndRankFeed({
        rawPosts: rawPosts || [],
        userId: currentUserId || '',
        mode: activeTab,
        userBlocks,
        userMutes,
        hiddenPostIds: [],
        userInteractions,
        userJoinedCommunityIds,
        limit: 20,
      })

      const data = engineResult.items

      if (data && data.length > 0) {
        // Collect all distinct author IDs to fetch profiles in ONE single query
        const authorIds = Array.from(new Set(data.map((p) => p.author_id)))
        const { data: profList } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', authorIds)

        const profileMap = new Map((profList ?? []).map((prof) => [prof.id, prof]))

        const formatted: Post[] = await Promise.all(
          data.map(async (p) => {
            let likeCount = 0
            let commentCount = 0
            let repostCount = 0
            let isLikedByMe = false
            let isSavedByMe = false
            let isRepostedByMe = false

            try {
              const [{ count: lCount }, { count: cCount }, { count: rCount }] = await Promise.all([
                supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
                supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
                supabase.from('reposts').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
              ])
              likeCount = lCount ?? 0
              commentCount = cCount ?? 0
              repostCount = rCount ?? 0
            } catch {
              // ignore count error
            }

            if (currentUserId) {
              try {
                const [{ data: like }, { data: save }, { data: repost }] = await Promise.all([
                  supabase.from('likes').select('user_id').match({ user_id: currentUserId, post_id: p.id }).maybeSingle(),
                  supabase.from('saved_posts').select('user_id').match({ user_id: currentUserId, post_id: p.id }).maybeSingle(),
                  supabase.from('reposts').select('user_id').match({ user_id: currentUserId, post_id: p.id }).maybeSingle(),
                ])
                isLikedByMe = !!like
                isSavedByMe = !!save
                isRepostedByMe = !!repost
              } catch {
                // ignore
              }
            }

            const authorData = p.author || profileMap.get(p.author_id)
            const { content: cleanContent, imageUrls } = extractPostMediaAndCleanContent(p.content, p.image_urls)

            return {
              id: p.id,
              authorId: p.author_id,
              author: {
                id: authorData?.id || p.author_id,
                username: authorData?.username || 'user',
                displayName: authorData?.display_name || 'User',
                avatarUrl: authorData?.avatar_url || null,
              },
              communityId: p.community_id || null,
              community: p.community && !Array.isArray(p.community) && p.community.id
                ? {
                    id: p.community.id,
                    name: p.community.name,
                    slug: p.community.slug,
                    avatarUrl: p.community.avatar_url,
                    privacy: p.community.privacy,
                  }
                : null,
              content: cleanContent,
              imageUrls,
              hashtags: [],
              likeCount,
              commentCount,
              repostCount,
              isLikedByMe,
              isSavedByMe,
              isRepostedByMe,
              createdAt: p.created_at,
              updatedAt: p.updated_at,
            }
          })
        )
        setPosts(formatted)
      } else {
        setPosts([])
      }
    } catch (err) {
      console.error('Fatal feed error:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase, activeTab, currentUserId])

  useEffect(() => {
    fetchPosts(true)

    // Realtime listener for instant feed updates upon new post creation
    const channel = supabase
      .channel('public:feed_posts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        () => {
          fetchPosts(false)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchPosts, supabase])

  function handleDeletePost(deletedId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== deletedId))
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* 1. Header: Left Title + Right Notification Bell */}
      <header className="flex items-center justify-between py-2 px-1">
        <h1 className="text-xl font-bold tracking-tight text-gray-900">
          Private Voices
        </h1>
        <Link
          href="/notifications"
          className="relative p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-700"
          aria-label="Notifications"
        >
          <Bell size={22} />
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white" />
        </Link>
      </header>

      {/* 2. 24-Hour Temporary Stories Tray */}
      <StoriesTray />

      {/* 3. Feed Filter Tabs */}
      <div className="flex gap-1 border-b border-gray-200 bg-white px-2 rounded-lg overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as FeedMode)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'text-brand-600 border-brand-600'
                : 'text-gray-500 border-transparent hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 4. Feed Content */}
      {loading ? (
        <div className="card p-12 text-center text-gray-400">
          <p className="text-sm">Loading feed...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-4">✨</div>
          <h2 className="font-semibold text-gray-900 mb-1">No posts yet</h2>
          <p className="text-sm text-gray-500 max-w-xs mx-auto">
            Be the first to share your thoughts, or follow more people to fill your feed.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              onDelete={handleDeletePost}
            />
          ))}
        </div>
      )}
    </div>
  )
}

