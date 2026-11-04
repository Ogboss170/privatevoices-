'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { MapPin, ArrowLeft, Grid, Compass, Sparkles, Navigation, Layers, ShieldCheck, Heart, MessageCircle } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import PostCard from '@/components/feed/PostCard'
import StoryViewerModal from '@/components/stories/StoryViewerModal'
import type { Post } from '@private-voices/shared'
import { extractPostMediaAndCleanContent } from '@private-voices/shared'

export default function LocationDiscoveryPage(): React.JSX.Element {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const locationId = (params?.id as string) || ''
  const locationName = searchParams.get('name') || decodeURIComponent(locationId)
  const locationCity = searchParams.get('city') || null
  const locationCountry = searchParams.get('country') || null

  const [activeTab, setActiveTab] = useState<'top' | 'recent' | 'stories'>('top')
  const [posts, setPosts] = useState<Post[]>([])
  const [stories, setStories] = useState<any[]>([])
  const [activeStoryGroup, setActiveStoryGroup] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | undefined>()
  const [showMap, setShowMap] = useState(false)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
  }, [supabase])

  const loadLocationContent = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Fetch location details / coordinates if available in database
      const { data: locRow } = await supabase
        .from('locations')
        .select('*')
        .or(`place_id.eq.${locationId},name.ilike.%${locationName}%`)
        .limit(1)
        .maybeSingle()

      if (locRow && locRow.latitude && locRow.longitude) {
        setCoords({ lat: parseFloat(locRow.latitude), lng: parseFloat(locRow.longitude) })
      }

      // 2. Query posts tagged with this location
      // Security & Authorization:
      // - Respect blocked users
      // - Filter private accounts if viewer is not following
      let userBlocks: string[] = []
      let followingIds: string[] = []

      if (currentUserId) {
        const [blocksRes, followsRes] = await Promise.all([
          supabase.from('user_blocks').select('blocked_id').eq('blocker_id', currentUserId),
          supabase.from('follows').select('following_id').eq('follower_id', currentUserId),
        ])
        userBlocks = (blocksRes.data || []).map((b) => b.blocked_id)
        followingIds = (followsRes.data || []).map((f) => f.following_id)
      }

      let postsQuery = supabase
        .from('posts')
        .select('*, author:profiles(id, username, display_name, avatar_url, is_private), community:communities(id, name, slug, avatar_url, privacy)')
        .or(`location_place_id.eq.${locationId},location_name.ilike.%${locationName}%`)

      if (activeTab === 'recent') {
        postsQuery = postsQuery.order('created_at', { ascending: false })
      } else {
        // 'top' - order by created_at desc with limit
        postsQuery = postsQuery.order('created_at', { ascending: false })
      }

      const { data: rawPosts, error: postsError } = await postsQuery.limit(40)

      if (!postsError && rawPosts) {
        // Authorize content: do not display blocked accounts or private accounts that the viewer doesn't follow
        const authorizedPosts = rawPosts.filter((p: any) => {
          if (userBlocks.includes(p.author_id)) return false
          if (p.author?.is_private && p.author_id !== currentUserId && !followingIds.includes(p.author_id)) {
            return false
          }
          return true
        })

        // Fetch social counts & user interaction states
        const formatted: Post[] = await Promise.all(
          authorizedPosts.map(async (p: any) => {
            const { content: cleanContent, imageUrls, audioUrl, videoUrl } = extractPostMediaAndCleanContent(
              p.content || '',
              p.image_urls || [],
              p.audio_url,
              p.video_url
            )

            let isLikedByMe = false
            let isSavedByMe = false
            let isRepostedByMe = false

            if (currentUserId) {
              const [likeRes, saveRes, repostRes] = await Promise.all([
                supabase.from('likes').select('user_id').match({ user_id: currentUserId, post_id: p.id }).maybeSingle(),
                supabase.from('saved_posts').select('user_id').match({ user_id: currentUserId, post_id: p.id }).maybeSingle(),
                supabase.from('reposts').select('user_id').match({ user_id: currentUserId, post_id: p.id }).maybeSingle(),
              ])
              isLikedByMe = !!likeRes.data
              isSavedByMe = !!saveRes.data
              isRepostedByMe = !!repostRes.data
            }

            return {
              id: p.id,
              authorId: p.author_id,
              author: {
                id: p.author?.id || p.author_id,
                username: p.author?.username || 'user',
                displayName: p.author?.display_name || 'User',
                avatarUrl: p.author?.avatar_url || null,
              },
              content: cleanContent,
              imageUrls: imageUrls || [],
              audioUrl: p.audio_url || audioUrl,
              audioDuration: p.audio_duration,
              videoUrl: p.video_url || videoUrl,
              hashtags: [],
              likeCount: 0,
              commentCount: 0,
              repostCount: 0,
              isLikedByMe,
              isSavedByMe,
              isRepostedByMe,
              locationName: p.location_name,
              locationCity: p.location_city,
              locationCountry: p.location_country,
              locationPlaceId: p.location_place_id,
              createdAt: p.created_at,
              updatedAt: p.updated_at,
            }
          })
        )

        setPosts(formatted)
      }

      // 3. Query active public stories tagged at this location
      const now = new Date().toISOString()
      const { data: rawStories } = await supabase
        .from('stories')
        .select('*, author:profiles(id, username, display_name, avatar_url, is_private)')
        .gt('expires_at', now)
        .order('created_at', { ascending: false })

      if (rawStories) {
        const matchingStories = rawStories.filter((s: any) => {
          if (!s.location_sticker) return false
          const sticker = s.location_sticker
          const matches =
            sticker.placeId === locationId ||
            (sticker.name && sticker.name.toLowerCase().includes(locationName.toLowerCase()))
          if (!matches) return false

          // Privacy filter
          if (userBlocks.includes(s.author_id)) return false
          if (s.author?.is_private && s.author_id !== currentUserId && !followingIds.includes(s.author_id)) {
            return false
          }
          return true
        })

        setStories(matchingStories)
      }
    } catch (err) {
      console.error('Failed to load location content:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase, locationId, locationName, activeTab, currentUserId])

  useEffect(() => {
    loadLocationContent()
  }, [loadLocationContent])

  return (
    <div className="max-w-2xl mx-auto pb-20 pt-4 px-3 sm:px-4 space-y-5">
      {/* Back Button & Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 text-gray-700 dark:text-gray-200 transition-colors shadow-xs"
          title="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-400 font-bold uppercase tracking-wider">
            <Compass size={14} />
            <span>Location Discovery</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white truncate">
            {locationName}
          </h1>
        </div>
      </div>

      {/* Hero Location Card with Instagram-Style Aesthetic */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-brand-50/70 via-white to-purple-50/50 dark:from-slate-800/80 dark:via-slate-900 dark:to-purple-950/20 border border-brand-200/50 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-500 to-purple-600 text-white flex items-center justify-center shadow-md">
              <MapPin size={24} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <span>{locationName}</span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {[locationCity, locationCountry].filter(Boolean).join(', ') || 'Global Location'}
              </p>
            </div>
          </div>

          {/* Action toggles: Map & Quick stats */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="px-3 py-1.5 rounded-xl bg-white/80 dark:bg-slate-800 border border-gray-200/60 dark:border-slate-700 text-xs font-semibold text-gray-700 dark:text-gray-300 shadow-2xs">
              <span className="font-bold text-brand-600 dark:text-brand-400">{posts.length}</span> Voices
            </div>
            {stories.length > 0 && (
              <div className="px-3 py-1.5 rounded-xl bg-pink-50 dark:bg-pink-950/30 border border-pink-200/60 dark:border-pink-800/40 text-xs font-semibold text-pink-700 dark:text-pink-300 shadow-2xs">
                <span className="font-bold">{stories.length}</span> Stories
              </div>
            )}
            <button
              onClick={() => setShowMap(!showMap)}
              className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors border ${
                showMap
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-200/60 dark:border-slate-700 hover:bg-gray-50'
              }`}
            >
              <Layers size={14} />
              <span>{showMap ? 'Hide Map' : 'Map View'}</span>
            </button>
          </div>
        </div>

        {/* Optional Embedded OpenStreetMap View */}
        {showMap && coords && (
          <div className="mt-4 rounded-2xl overflow-hidden border border-gray-200 dark:border-slate-700 shadow-inner h-60 w-full relative">
            <iframe
              title={`Map of ${locationName}`}
              width="100%"
              height="100%"
              frameBorder="0"
              scrolling="no"
              marginHeight={0}
              marginWidth={0}
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${coords.lng - 0.03}%2C${coords.lat - 0.02}%2C${coords.lng + 0.03}%2C${coords.lat + 0.02}&amp;layer=mapnik&amp;marker=${coords.lat}%2C${coords.lng}`}
              className="w-full h-full filter saturate-150 contrast-105"
            />
          </div>
        )}

        {/* Privacy Note */}
        <div className="mt-3 pt-3 border-t border-brand-100/60 dark:border-slate-800 flex items-center gap-1.5 text-[11px] text-gray-400">
          <ShieldCheck size={13} className="text-brand-500 shrink-0" />
          <span>
            Only public Voices and approved follower content tagged at this place are displayed. Exact personal addresses are never collected.
          </span>
        </div>
      </div>

      {/* Stories Carousel at this Location (if any) */}
      {stories.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 px-1 text-xs font-bold text-gray-700 dark:text-gray-300">
            <Sparkles size={14} className="text-pink-500" />
            <span>Stories from {locationName}</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {stories.map((st) => (
              <button
                key={st.id}
                onClick={() => {
                  setActiveStoryGroup({
                    author: st.author,
                    stories: [st],
                  })
                }}
                className="flex flex-col items-center gap-1.5 shrink-0 group focus:outline-none"
              >
                <div className="relative p-0.5 rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 group-hover:scale-105 transition-transform shadow-xs">
                  <div className="w-14 h-14 rounded-full bg-white dark:bg-slate-900 p-0.5 overflow-hidden">
                    <img
                      src={st.author?.avatar_url || 'https://via.placeholder.com/150'}
                      alt={st.author?.display_name || 'Story author'}
                      className="w-full h-full rounded-full object-cover"
                    />
                  </div>
                </div>
                <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300 truncate max-w-[70px]">
                  {st.author?.display_name || 'User'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tabs Filter (Top / Recent / Stories) */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('top')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
            activeTab === 'top'
              ? 'bg-brand-600 text-white shadow-xs'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'
          }`}
        >
          Top Thoughts
        </button>
        <button
          onClick={() => setActiveTab('recent')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
            activeTab === 'recent'
              ? 'bg-brand-600 text-white shadow-xs'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'
          }`}
        >
          Recent
        </button>
      </div>

      {/* Posts List */}
      {loading ? (
        <div className="py-20 text-center text-gray-400 space-y-2">
          <div className="w-8 h-8 rounded-full border-2 border-brand-600 border-t-transparent animate-spin mx-auto" />
          <p className="text-xs font-medium">Discovering voices in {locationName}...</p>
        </div>
      ) : posts.length > 0 ? (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              onDelete={(deletedId) => setPosts((prev) => prev.filter((p) => p.id !== deletedId))}
            />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center text-gray-400 space-y-2 bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-8">
          <MapPin size={36} className="mx-auto text-gray-300 dark:text-slate-700" />
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">No Voices Tagged Here Yet</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
            Be the first to share an introspective thought or voice whisper tagged at {locationName}.
          </p>
          <Link
            href="/create"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 transition-colors shadow-xs mt-2"
          >
            <span>Share a Voice</span>
          </Link>
        </div>
      )}

      {/* Story Viewer Modal */}
      {activeStoryGroup && (
        <StoryViewerModal
          storyGroup={activeStoryGroup}
          currentUserId={currentUserId}
          onClose={() => setActiveStoryGroup(null)}
        />
      )}
    </div>
  )
}
