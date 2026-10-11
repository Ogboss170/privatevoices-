'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { UserPlus, UserCheck, Users, X, Sparkles } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export interface SuggestedUser {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  bio?: string | null
  mutualCount?: number
  isFollowing?: boolean
}

interface PeopleYouMayKnowProps {
  currentUserId?: string | null
  variant?: 'carousel' | 'sidebar' | 'list'
  title?: string
  className?: string
  onFollowChange?: (targetUserId: string, isNowFollowing: boolean) => void
}

export default function PeopleYouMayKnow({
  currentUserId,
  variant = 'carousel',
  title = 'People you may know',
  className = '',
  onFollowChange,
}: PeopleYouMayKnowProps): React.JSX.Element | null {
  const supabase = createSupabaseBrowserClient()
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({})
  const [dismissedMap, setDismissedMap] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function loadSuggestions() {
      setLoading(true)
      try {
        let userId = currentUserId
        if (!userId) {
          const { data: authData } = await supabase.auth.getUser()
          userId = authData.user?.id || null
        }

        // 1. Try calling our optimized recommendation engine RPC
        const { data: rpcData, error: rpcErr } = await supabase.rpc('get_people_you_may_know', {
          p_limit: 10,
        })

        if (!rpcErr && rpcData && rpcData.length > 0) {
          const formatted = rpcData.map((u: any) => ({
            id: u.id,
            username: u.username,
            displayName: u.display_name || u.username,
            avatarUrl: u.avatar_url,
            bio: u.bio,
            mutualCount: Number(u.mutual_count || 0),
            isFollowing: false,
          }))
          setSuggestions(formatted)
          setLoading(false)
          return
        }

        // 2. Fallback: query profiles directly (excluding current user and already followed users)
        let excludeIds: string[] = []
        if (userId) {
          excludeIds.push(userId)
          const { data: followRows } = await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', userId)

          if (followRows) {
            excludeIds.push(...followRows.map((f: any) => f.following_id))
          }
        }

        let query = supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, bio')
          .order('created_at', { ascending: false })
          .limit(10)

        if (excludeIds.length > 0) {
          query = query.not('id', 'in', `(${excludeIds.join(',')})`)
        }

        const { data: fallbackProfiles } = await query

        if (fallbackProfiles) {
          const formatted = fallbackProfiles.map((p: any) => ({
            id: p.id,
            username: p.username,
            displayName: p.display_name || p.username,
            avatarUrl: p.avatar_url,
            bio: p.bio,
            mutualCount: 0,
            isFollowing: false,
          }))
          setSuggestions(formatted)
        }
      } catch (err) {
        console.warn('Error loading suggestions:', err)
      } finally {
        setLoading(false)
      }
    }

    loadSuggestions()
  }, [supabase, currentUserId])

  async function handleToggleFollow(user: SuggestedUser) {
    let activeUserId = currentUserId
    if (!activeUserId) {
      const { data: authData } = await supabase.auth.getUser()
      activeUserId = authData.user?.id || null
    }

    if (!activeUserId) {
      window.location.href = '/login'
      return
    }

    const isCurrentlyFollowing = !!followingMap[user.id]
    const nextFollowing = !isCurrentlyFollowing

    // Optimistic state update
    setFollowingMap((prev) => ({ ...prev, [user.id]: nextFollowing }))
    if (onFollowChange) onFollowChange(user.id, nextFollowing)

    try {
      if (nextFollowing) {
        await supabase.from('follows').insert({
          follower_id: activeUserId,
          following_id: user.id,
        })
      } else {
        await supabase
          .from('follows')
          .delete()
          .match({ follower_id: activeUserId, following_id: user.id })
      }
    } catch (err) {
      // Revert on error
      setFollowingMap((prev) => ({ ...prev, [user.id]: isCurrentlyFollowing }))
      if (onFollowChange) onFollowChange(user.id, isCurrentlyFollowing)
    }
  }

  function handleDismiss(userId: string) {
    setDismissedMap((prev) => ({ ...prev, [userId]: true }))
  }

  const visibleSuggestions = suggestions.filter((s) => !dismissedMap[s.id])

  if (loading && visibleSuggestions.length === 0) {
    return null
  }

  if (!loading && visibleSuggestions.length === 0) {
    return null
  }

  // Variant: Horizontal Swipeable Carousel (Fits in Feed & Explore)
  if (variant === 'carousel') {
    return (
      <div className={`my-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-4 shadow-2xs ${className}`}>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-brand-50 dark:bg-brand-950/60 flex items-center justify-center text-brand-600 dark:text-brand-400">
              <Users size={14} />
            </div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h3>
          </div>
          <Link
            href="/explore?tab=people"
            className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
          >
            See all
          </Link>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none pt-1">
          {visibleSuggestions.map((user) => {
            const isFollowing = !!followingMap[user.id]
            return (
              <div
                key={user.id}
                className="w-38 sm:w-44 flex-shrink-0 bg-gray-50/70 dark:bg-slate-800/60 border border-gray-200/60 dark:border-slate-750 rounded-2xl p-3 flex flex-col items-center text-center relative group hover:border-brand-300 dark:hover:border-brand-700 transition-all"
              >
                {/* Dismiss button */}
                <button
                  type="button"
                  onClick={() => handleDismiss(user.id)}
                  aria-label="Dismiss suggestion"
                  className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-200/50 dark:hover:bg-slate-700/50 transition-colors opacity-70 group-hover:opacity-100"
                >
                  <X size={13} />
                </button>

                {/* Avatar */}
                <Link href={`/@${user.username}`} className="mt-1 mb-2 relative">
                  <div className="w-14 h-14 rounded-full bg-brand-100 dark:bg-slate-700 flex items-center justify-center font-bold text-brand-600 dark:text-brand-300 overflow-hidden border-2 border-white dark:border-slate-800 shadow-2xs">
                    {user.avatarUrl ? (
                      <Image
                        src={user.avatarUrl}
                        alt={user.displayName}
                        width={56}
                        height={56}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      user.displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                </Link>

                {/* Name & Handle */}
                <Link href={`/@${user.username}`} className="w-full truncate px-1">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate hover:underline">
                    {user.displayName}
                  </h4>
                  <p className="text-[11px] text-gray-400 truncate">@{user.username}</p>
                </Link>

                {/* Mutual connection hint */}
                <div className="h-4 my-1.5 flex items-center justify-center">
                  {user.mutualCount && user.mutualCount > 0 ? (
                    <span className="text-[10px] text-brand-600 dark:text-brand-400 font-medium truncate">
                      {user.mutualCount} mutual connection{user.mutualCount > 1 ? 's' : ''}
                    </span>
                  ) : user.bio ? (
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-full">
                      {user.bio}
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">Suggested for you</span>
                  )}
                </div>

                {/* Follow Button */}
                <button
                  type="button"
                  onClick={() => handleToggleFollow(user)}
                  className={`w-full py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all mt-auto cursor-pointer ${
                    isFollowing
                      ? 'bg-gray-200/80 dark:bg-slate-700 text-gray-800 dark:text-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                      : 'bg-brand-600 hover:bg-brand-700 text-white shadow-2xs shadow-brand-600/20 active:scale-95'
                  }`}
                >
                  {isFollowing ? (
                    <>
                      <UserCheck size={13} />
                      <span>Following</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={13} />
                      <span>Follow</span>
                    </>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Variant: Sidebar Widget (Fits in RightSidebar)
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl p-4 border border-gray-200/70 dark:border-slate-800 shadow-sm space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-900 dark:text-white font-bold text-xs">
          <Users size={16} className="text-brand-600" />
          <span>{title}</span>
        </div>
        <Link
          href="/explore?tab=people"
          className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:underline"
        >
          View all
        </Link>
      </div>

      <div className="space-y-3">
        {visibleSuggestions.slice(0, 4).map((user) => {
          const isFollowing = !!followingMap[user.id]
          return (
            <div key={user.id} className="flex items-center justify-between gap-2.5 group">
              <Link href={`/@${user.username}`} className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-slate-700 flex items-center justify-center font-bold text-brand-600 dark:text-brand-300 flex-shrink-0 overflow-hidden border border-gray-100 dark:border-slate-700">
                  {user.avatarUrl ? (
                    <Image
                      src={user.avatarUrl}
                      alt={user.displayName}
                      width={36}
                      height={36}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    user.displayName.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate group-hover:text-brand-600 transition-colors">
                    {user.displayName}
                  </h4>
                  <p className="text-[11px] text-gray-400 truncate">@{user.username}</p>
                </div>
              </Link>

              <button
                type="button"
                onClick={() => handleToggleFollow(user)}
                className={`py-1 px-3 rounded-full text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                  isFollowing
                    ? 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-red-50 hover:text-red-600'
                    : 'bg-brand-600 hover:bg-brand-700 text-white shadow-2xs'
                }`}
              >
                {isFollowing ? (
                  <span>Following</span>
                ) : (
                  <>
                    <UserPlus size={11} />
                    <span>Follow</span>
                  </>
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
