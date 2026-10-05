'use client'

import React, { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import {
  Search,
  TrendingUp,
  Users,
  Hash,
  User,
  MessageSquare,
  X,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Flame,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import PostCard from '@/components/feed/PostCard'
import type { Post } from '@private-voices/shared'

type SearchTab = 'all' | 'people' | 'voices' | 'communities'

function ExploreContent(): React.JSX.Element {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createSupabaseBrowserClient()

  const initialQuery = searchParams.get('q') || ''
  const initialTab = (searchParams.get('tab') as SearchTab) || 'all'

  const [searchTerm, setSearchTerm] = useState(initialQuery)
  const [activeTab, setActiveTab] = useState<SearchTab>(initialTab)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Data states
  const [trendingHashtags, setTrendingHashtags] = useState<any[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [voices, setVoices] = useState<Post[]>([])
  const [communities, setCommunities] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Sync state if URL query params change (e.g. from clicking a #hashtag link)
  useEffect(() => {
    const urlQuery = searchParams.get('q') || ''
    const urlTab = (searchParams.get('tab') as SearchTab) || 'all'
    setSearchTerm(urlQuery)
    setActiveTab(urlTab)
  }, [searchParams])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
  }, [supabase])

  // Helper to format posts into Post interface
  const formatPosts = useCallback(
    async (postsData: any[]): Promise<Post[]> => {
      if (!postsData || postsData.length === 0) return []

      const authorIds = Array.from(new Set(postsData.map((p) => p.author_id)))
      const { data: profList } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', authorIds)

      const profileMap = new Map((profList ?? []).map((prof) => [prof.id, prof]))

      return Promise.all(
        postsData.map(async (p) => {
          let likeCount = 0
          let commentCount = 0
          let isLikedByMe = false
          let isSavedByMe = false

          try {
            const [{ count: lCount }, { count: cCount }] = await Promise.all([
              supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
              supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
            ])
            likeCount = lCount ?? 0
            commentCount = cCount ?? 0
          } catch {
            // ignore
          }

          if (currentUserId) {
            try {
              const [{ data: like }, { data: save }] = await Promise.all([
                supabase.from('likes').select('user_id').match({ user_id: currentUserId, post_id: p.id }).maybeSingle(),
                supabase.from('saved_posts').select('user_id').match({ user_id: currentUserId, post_id: p.id }).maybeSingle(),
              ])
              isLikedByMe = !!like
              isSavedByMe = !!save
            } catch {
              // ignore
            }
          }

          const authorData = p.author || profileMap.get(p.author_id)

          return {
            id: p.id,
            authorId: p.author_id,
            author: {
              id: authorData?.id || p.author_id,
              username: authorData?.username || 'user',
              displayName: authorData?.display_name || 'User',
              avatarUrl: authorData?.avatar_url || null,
            },
            content: p.content,
            imageUrls: p.image_urls ?? [],
            hashtags: [],
            likeCount,
            commentCount,
            repostCount: 0,
            isLikedByMe,
            isSavedByMe,
            isRepostedByMe: false,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
          }
        })
      )
    },
    [supabase, currentUserId]
  )

  // Primary data loader based on search query and active tab
  const executeSearch = useCallback(
    async (term: string, tab: SearchTab) => {
      setLoading(true)
      const cleanTerm = term.trim()

      try {
        // Always ensure trending hashtags are available
        const { data: tagData } = await supabase.from('hashtags').select('*').limit(12)
        setTrendingHashtags(tagData ?? [])

        if (!cleanTerm) {
          // Default / Explore Mode: fetch recommended & top items
          const [{ data: profs }, { data: comms }, { data: topPosts }] = await Promise.all([
            supabase.from('profiles').select('*').limit(6),
            supabase.from('communities').select('*').limit(6),
            supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(6),
          ])

          setProfiles(profs ?? [])
          setCommunities(comms ?? [])
          const formattedPosts = await formatPosts(topPosts ?? [])
          setVoices(formattedPosts)
        } else {
          // Active Search Mode
          const isHashtagSearch = cleanTerm.startsWith('#')
          const keyword = isHashtagSearch ? cleanTerm.slice(1).trim() : cleanTerm

          // Fetch Profiles (People)
          if (tab === 'all' || tab === 'people') {
            const { data: matchedProfiles } = await supabase
              .from('profiles')
              .select('*')
              .or(`username.ilike.%${keyword}%,display_name.ilike.%${keyword}%,bio.ilike.%${keyword}%`)
              .limit(tab === 'people' ? 20 : 4)
            setProfiles(matchedProfiles ?? [])
          } else {
            setProfiles([])
          }

          // Fetch Communities
          if (tab === 'all' || tab === 'communities') {
            const { data: matchedCommunities } = await supabase
              .from('communities')
              .select('*')
              .or(`name.ilike.%${keyword}%,slug.ilike.%${keyword}%,description.ilike.%${keyword}%`)
              .limit(tab === 'communities' ? 20 : 4)
            setCommunities(matchedCommunities ?? [])
          } else {
            setCommunities([])
          }

          // Fetch Voices (Posts)
          if (tab === 'all' || tab === 'voices') {
            let postsQuery = supabase.from('posts').select('*')
            if (isHashtagSearch) {
              // Search either exact #tag or content containing the tag
              postsQuery = postsQuery.or(`content.ilike.%#${keyword}%,content.ilike.%${keyword}%`)
            } else {
              postsQuery = postsQuery.ilike('content', `%${keyword}%`)
            }

            const { data: matchedPosts } = await postsQuery
              .order('created_at', { ascending: false })
              .limit(tab === 'voices' ? 25 : 5)

            const formatted = await formatPosts(matchedPosts ?? [])
            setVoices(formatted)
          } else {
            setVoices([])
          }
        }
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setLoading(false)
      }
    },
    [supabase, formatPosts]
  )

  useEffect(() => {
    executeSearch(searchTerm, activeTab)
  }, [searchTerm, activeTab, executeSearch])

  // Update URL params smoothly
  function updateUrl(query: string, tab: SearchTab) {
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (tab !== 'all') params.set('tab', tab)
    const newUrl = params.toString() ? `/explore?${params.toString()}` : '/explore'
    router.replace(newUrl, { scroll: false })
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newQuery = e.target.value
    setSearchTerm(newQuery)
    updateUrl(newQuery, activeTab)
  }

  function handleTabChange(newTab: SearchTab) {
    setActiveTab(newTab)
    updateUrl(searchTerm, newTab)
  }

  function handleTagClick(tagName: string) {
    const query = `#${tagName}`
    setSearchTerm(query)
    setActiveTab('voices')
    updateUrl(query, 'voices')
  }

  function handleClearSearch() {
    setSearchTerm('')
    updateUrl('', activeTab)
  }

  const isSearching = searchTerm.trim().length > 0
  const normalizedSearch = searchTerm.trim().toLowerCase()

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-16">
      {/* ── Search Bar ── */}
      <div className="relative">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search people, voices, #hashtags, communities..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="input-field pl-10 pr-10 text-sm py-3 rounded-2xl shadow-sm border-gray-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 w-full"
        />
        {searchTerm.length > 0 && (
          <button
            onClick={handleClearSearch}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
            title="Clear search"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* ── Trending Hashtags Bar ── */}
      <div className="card p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-brand-600 font-bold text-xs uppercase tracking-wider">
            <Flame size={15} />
            <span>Trending Hashtags</span>
          </div>
          {isSearching && normalizedSearch.startsWith('#') && (
            <button
              onClick={handleClearSearch}
              className="text-xs text-brand-600 hover:underline font-medium"
            >
              Reset filter
            </button>
          )}
        </div>

        {trendingHashtags.length === 0 ? (
          <p className="text-xs text-gray-400">Discovering trending privacy topics...</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {trendingHashtags.map((tag) => {
              const isSelected = normalizedSearch === `#${tag.name.toLowerCase()}`
              return (
                <button
                  key={tag.id || tag.name}
                  onClick={() => handleTagClick(tag.name)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-brand-600 text-white shadow-sm ring-2 ring-brand-300'
                      : 'bg-gray-100 text-gray-700 hover:bg-brand-50 hover:text-brand-700'
                  }`}
                >
                  #{tag.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Multi-Tab Switcher ── */}
      <div className="flex border-b border-gray-200 gap-1 overflow-x-auto no-scrollbar">
        {[
          { id: 'all', label: 'All', icon: Sparkles },
          { id: 'voices', label: 'Voices', icon: MessageSquare, count: voices.length },
          { id: 'people', label: 'People', icon: User, count: profiles.length },
          { id: 'communities', label: 'Communities', icon: Users, count: communities.length },
        ].map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id as SearchTab)}
              className={`flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-200'
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {isSearching && tab.count !== undefined && tab.count > 0 && (
                <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-gray-100 text-gray-600 font-normal">
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Results Container ── */}
      {loading ? (
        <div className="py-16 text-center space-y-3">
          <div className="inline-block w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-500">Searching Private Voices network...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ════════════════════ TAB: ALL ════════════════════ */}
          {activeTab === 'all' && (
            <>
              {/* People Section in All */}
              {profiles.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-gray-900 text-sm">
                      <User size={16} className="text-brand-600" />
                      <span>{isSearching ? 'Matching People' : 'People to Discover'}</span>
                    </div>
                    {isSearching && profiles.length >= 4 && (
                      <button
                        onClick={() => handleTabChange('people')}
                        className="text-xs text-brand-600 hover:underline font-semibold flex items-center gap-1"
                      >
                        <span>View all</span>
                        <ArrowRight size={13} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {profiles.slice(0, 4).map((prof) => (
                      <Link
                        key={prof.id}
                        href={`/@${prof.username}`}
                        className="card p-3.5 flex items-center justify-between hover:border-gray-300 transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-600 flex-shrink-0 overflow-hidden">
                            {prof.avatar_url ? (
                              <Image
                                src={prof.avatar_url}
                                alt={prof.display_name}
                                width={40}
                                height={40}
                                className="object-cover w-full h-full"
                              />
                            ) : (
                              prof.display_name?.charAt(0).toUpperCase() || 'U'
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm text-gray-900 truncate group-hover:text-brand-600 transition-colors">
                              {prof.display_name}
                            </h4>
                            <p className="text-xs text-gray-500 truncate">@{prof.username}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Communities Section in All */}
              {communities.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-gray-900 text-sm">
                      <Users size={16} className="text-purple-600" />
                      <span>{isSearching ? 'Matching Communities' : 'Recommended Communities'}</span>
                    </div>
                    {isSearching && communities.length >= 4 && (
                      <button
                        onClick={() => handleTabChange('communities')}
                        className="text-xs text-brand-600 hover:underline font-semibold flex items-center gap-1"
                      >
                        <span>View all</span>
                        <ArrowRight size={13} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {communities.slice(0, 4).map((comm) => (
                      <Link
                        key={comm.id}
                        href={`/community/${comm.slug}`}
                        className="card p-3.5 flex items-center justify-between hover:border-gray-300 transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold flex-shrink-0 overflow-hidden">
                            {comm.avatar_url ? (
                              <Image src={comm.avatar_url} alt={comm.name} width={40} height={40} className="object-cover w-full h-full" />
                            ) : (
                              comm.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-bold text-sm text-gray-900 truncate group-hover:text-purple-600 transition-colors">
                                {comm.name}
                              </h4>
                              {comm.privacy === 'private' ? (
                                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                  Private
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                  Public
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate">
                              c/{comm.slug} • {comm.category || 'General'}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-purple-600 group-hover:underline flex-shrink-0">
                          View
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Voices Section in All */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-gray-900 text-sm">
                    <MessageSquare size={16} className="text-brand-600" />
                    <span>{isSearching ? 'Matching Voices' : 'Popular Voices'}</span>
                  </div>
                  {voices.length > 5 && (
                    <button
                      onClick={() => handleTabChange('voices')}
                      className="text-xs text-brand-600 hover:underline font-semibold flex items-center gap-1"
                    >
                      <span>See all {voices.length} voices</span>
                      <ArrowRight size={13} />
                    </button>
                  )}
                </div>

                {voices.length === 0 ? (
                  <div className="card p-8 text-center text-gray-500 text-sm space-y-2">
                    <p className="font-semibold text-gray-700">No matching Voices found</p>
                    <p className="text-xs text-gray-400">
                      Try searching for broader terms or click a trending #hashtag above.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {voices.map((post) => (
                      <PostCard key={post.id} post={post} currentUserId={currentUserId ?? undefined} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ════════════════════ TAB: VOICES ════════════════════ */}
          {activeTab === 'voices' && (
            <div className="space-y-4">
              {isSearching && (
                <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                  <span>
                    Showing voices matching <strong className="text-gray-900">"{searchTerm}"</strong>
                  </span>
                  <span>{voices.length} result{voices.length === 1 ? '' : 's'}</span>
                </div>
              )}

              {voices.length === 0 ? (
                <div className="card p-12 text-center text-gray-500 text-sm space-y-3">
                  <div className="w-12 h-12 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center mx-auto">
                    <MessageSquare size={24} />
                  </div>
                  <h3 className="font-bold text-gray-800">No Voices found</h3>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto">
                    We couldn't find any Voices matching "{searchTerm}". Try a different keyword or explore trending hashtags.
                  </p>
                </div>
              ) : (
                voices.map((post) => (
                  <PostCard key={post.id} post={post} currentUserId={currentUserId ?? undefined} />
                ))
              )}
            </div>
          )}

          {/* ════════════════════ TAB: PEOPLE ════════════════════ */}
          {activeTab === 'people' && (
            <div className="space-y-3">
              {isSearching && (
                <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                  <span>
                    People matching <strong className="text-gray-900">"{searchTerm}"</strong>
                  </span>
                  <span>{profiles.length} result{profiles.length === 1 ? '' : 's'}</span>
                </div>
              )}

              {profiles.length === 0 ? (
                <div className="card p-12 text-center text-gray-500 text-sm space-y-3">
                  <div className="w-12 h-12 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center mx-auto">
                    <User size={24} />
                  </div>
                  <h3 className="font-bold text-gray-800">No users found</h3>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto">
                    No users matching "{searchTerm}". Check the spelling of username or display name.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {profiles.map((prof) => (
                    <Link
                      key={prof.id}
                      href={`/@${prof.username}`}
                      className="card p-4 flex items-center justify-between hover:border-gray-300 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-600 flex-shrink-0 overflow-hidden">
                          {prof.avatar_url ? (
                            <Image
                              src={prof.avatar_url}
                              alt={prof.display_name}
                              width={44}
                              height={44}
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            prof.display_name?.charAt(0).toUpperCase() || 'U'
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-gray-900 truncate group-hover:text-brand-600 transition-colors">
                            {prof.display_name}
                          </h4>
                          <p className="text-xs text-gray-500 truncate">@{prof.username}</p>
                          {prof.bio && (
                            <p className="text-xs text-gray-400 truncate mt-0.5">{prof.bio}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-brand-600 group-hover:underline flex-shrink-0">
                        View
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ════════════════════ TAB: COMMUNITIES ════════════════════ */}
          {activeTab === 'communities' && (
            <div className="space-y-3">
              {isSearching && (
                <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                  <span>
                    Communities matching <strong className="text-gray-900">"{searchTerm}"</strong>
                  </span>
                  <span>{communities.length} result{communities.length === 1 ? '' : 's'}</span>
                </div>
              )}

              {communities.length === 0 ? (
                <div className="card p-12 text-center text-gray-500 text-sm space-y-3">
                  <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
                    <Users size={24} />
                  </div>
                  <h3 className="font-bold text-gray-800">No communities found</h3>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto">
                    No communities matching "{searchTerm}". Try a different topic or create your own community.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {communities.map((comm) => (
                    <Link
                      key={comm.id}
                      href={`/community/${comm.slug}`}
                      className="card p-4 flex items-center justify-between hover:border-gray-300 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold flex-shrink-0 text-lg overflow-hidden">
                          {comm.avatar_url ? (
                            <Image src={comm.avatar_url} alt={comm.name} width={48} height={48} className="object-cover w-full h-full" />
                          ) : (
                            comm.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-bold text-sm text-gray-900 truncate group-hover:text-purple-600 transition-colors">
                              {comm.name}
                            </h4>
                            {comm.privacy === 'private' ? (
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                Private
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                Public
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 font-mono">c/{comm.slug}</p>
                          <p className="text-xs text-gray-600 truncate mt-0.5">
                            {comm.description || 'Private Voices Community'}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-purple-600 group-hover:underline flex-shrink-0">
                        View
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ExplorePage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto py-16 text-center space-y-2">
          <div className="inline-block w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-400">Loading Explore & Search...</p>
        </div>
      }
    >
      <ExploreContent />
    </Suspense>
  )
}
