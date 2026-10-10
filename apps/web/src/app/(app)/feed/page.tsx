'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Bell, Sparkles, SlidersHorizontal } from 'lucide-react'
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
  const [visibleCount, setVisibleCount] = useState(25)

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
            let viewCount = 0
            let isLikedByMe = false
            let isSavedByMe = false
            let isRepostedByMe = false

            try {
              const [{ count: lCount }, { count: cCount }, { count: rCount }, { data: vCount }] = await Promise.all([
                supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
                supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
                supabase.from('reposts').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
                supabase.rpc('get_post_view_count', { p_post_id: p.id }),
              ])
              likeCount = lCount ?? 0
              commentCount = cCount ?? 0
              repostCount = rCount ?? 0
              viewCount = typeof vCount === 'number' ? vCount : 0
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
            const { content: cleanContent, imageUrls, audioUrl, videoUrl } = extractPostMediaAndCleanContent(
              p.content,
              p.image_urls,
              p.audio_url,
              p.video_url
            )

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
              audioUrl: audioUrl || p.audio_url || null,
              audioDuration: p.audio_duration || null,
              videoUrl: videoUrl || p.video_url || null,
              hashtags: [],
              likeCount,
              commentCount,
              repostCount,
              viewCount,
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
    <div className="space-y-0 max-w-xl mx-auto pb-12">
      {/* ── 1. Top Header: X Minimalist Top Bar with Logo & Actions ── */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-100 dark:border-slate-800 transition-colors">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left: Brand / X Icon */}
          <Link href="/feed" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-full bg-gray-900 dark:bg-white flex items-center justify-center text-white dark:text-gray-900 font-black text-sm tracking-tighter shadow-xs group-hover:scale-105 transition-transform">
              𝕏
            </div>
            <span className="font-bold text-base text-gray-900 dark:text-gray-100 tracking-tight hidden sm:inline">
              Private Voices
            </span>
          </Link>

          {/* Center / Right: Notifications & Quick Filter */}
          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/notifications"
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300 transition-colors relative"
              title="Notifications"
            >
              <Bell size={20} strokeWidth={2} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-600 rounded-full ring-2 ring-white dark:ring-slate-900" />
            </Link>

            <Link
              href="/settings"
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300 transition-colors"
              title="Feed Preferences"
            >
              <SlidersHorizontal size={18} strokeWidth={2} />
            </Link>
          </div>
        </div>

        {/* ── 2. X-Style 'For You' / 'Following' Sub-Header Tabs ── */}
        <div className="flex border-t border-gray-100 dark:border-slate-800/80 overflow-x-auto scrollbar-none">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as FeedMode)
                  setVisibleCount(25)
                }}
                className={`flex-1 py-3 px-3 text-sm font-semibold transition-colors relative whitespace-nowrap cursor-pointer text-center select-none ${
                  isActive
                    ? 'text-gray-900 dark:text-white font-bold'
                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50/50 dark:hover:bg-slate-800/40'
                }`}
              >
                <span>{tab.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 inset-x-4 sm:inset-x-8 h-1 rounded-full bg-brand-600 shadow-xs" />
                )}
              </button>
            )
          })}
        </div>
      </header>

      {/* ── 3. Stories Tray (Subtle separator) ── */}
      <div className="py-2.5 px-1 border-b border-gray-100 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/50">
        <StoriesTray />
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
        <div className="space-y-3.5">
          {posts.slice(0, visibleCount).map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              onDelete={handleDeletePost}
            />
          ))}

          {/* ── 'See More' Progressive Batch Loading ── */}
          {posts.length > visibleCount && (
            <div className="pt-2 pb-6 text-center">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + 25)}
                className="w-full py-3.5 px-6 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 hover:border-brand-500/50 hover:bg-gray-50/80 dark:hover:bg-slate-850 text-gray-900 dark:text-gray-100 font-bold text-sm shadow-2xs transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer group"
              >
                <span>See more posts</span>
                <span className="text-xs text-gray-400 font-normal">
                  ({posts.length - visibleCount} more available)
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

