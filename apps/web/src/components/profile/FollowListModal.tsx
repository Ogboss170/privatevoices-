'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { X, Lock, UserPlus, UserCheck, Loader2 } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

interface FollowUser {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  bio?: string | null
  isFollowingByMe?: boolean
}

interface FollowListModalProps {
  isOpen: boolean
  onClose: () => void
  targetUserId: string
  targetUsername: string
  initialTab?: 'followers' | 'following'
  canView: boolean
  currentUserId?: string | null
}

export default function FollowListModal({
  isOpen,
  onClose,
  targetUserId,
  targetUsername,
  initialTab = 'followers',
  canView,
  currentUserId,
}: FollowListModalProps) {
  const supabase = createSupabaseBrowserClient()
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>(initialTab)
  const [users, setUsers] = useState<FollowUser[]>([])
  const [loading, setLoading] = useState(false)
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab, isOpen])

  useEffect(() => {
    if (!isOpen || !canView || !targetUserId) return

    async function loadList() {
      setLoading(true)
      try {
        let userList: FollowUser[] = []

        if (activeTab === 'followers') {
          const { data, error } = await supabase
            .from('follows')
            .select('follower:profiles!follows_follower_id_fkey(id, username, display_name, avatar_url, bio)')
            .eq('following_id', targetUserId)

          if (!error && data) {
            userList = data
              .map((row: any) => row.follower)
              .filter(Boolean)
              .map((u: any) => ({
                id: u.id,
                username: u.username,
                displayName: u.display_name,
                avatarUrl: u.avatar_url,
                bio: u.bio,
              }))
          }
        } else {
          const { data, error } = await supabase
            .from('follows')
            .select('following:profiles!follows_following_id_fkey(id, username, display_name, avatar_url, bio)')
            .eq('follower_id', targetUserId)

          if (!error && data) {
            userList = data
              .map((row: any) => row.following)
              .filter(Boolean)
              .map((u: any) => ({
                id: u.id,
                username: u.username,
                displayName: u.display_name,
                avatarUrl: u.avatar_url,
                bio: u.bio,
              }))
          }
        }

        // Check which users the current user follows
        if (currentUserId && userList.length > 0) {
          const otherIds = userList.map((u) => u.id).filter((id) => id !== currentUserId)
          if (otherIds.length > 0) {
            const { data: myFollows } = await supabase
              .from('follows')
              .select('following_id')
              .eq('follower_id', currentUserId)
              .in('following_id', otherIds)

            const map: Record<string, boolean> = {}
            for (const f of myFollows || []) {
              map[f.following_id] = true
            }
            setFollowingMap(map)
          }
        }

        setUsers(userList)
      } catch (err) {
        console.error('Error fetching follow list:', err)
      } finally {
        setLoading(false)
      }
    }

    loadList()
  }, [isOpen, canView, activeTab, targetUserId, currentUserId, supabase])

  if (!isOpen) return null

  async function handleToggleFollow(userId: string) {
    if (!currentUserId) {
      alert('Please log in to follow users.')
      return
    }

    const isCurrentlyFollowing = !!followingMap[userId]

    // Optimistic update
    setFollowingMap((prev) => ({
      ...prev,
      [userId]: !isCurrentlyFollowing,
    }))

    try {
      if (isCurrentlyFollowing) {
        await supabase
          .from('follows')
          .delete()
          .match({ follower_id: currentUserId, following_id: userId })
      } else {
        await supabase
          .from('follows')
          .insert({ follower_id: currentUserId, following_id: userId })
      }
    } catch (err) {
      // Revert on error
      setFollowingMap((prev) => ({
        ...prev,
        [userId]: isCurrentlyFollowing,
      }))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">@{targetUsername}</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 bg-gray-50/50">
          <button
            onClick={() => setActiveTab('followers')}
            className={`flex-1 py-3 text-sm font-semibold text-center border-b-2 transition-all ${
              activeTab === 'followers'
                ? 'border-brand-600 text-brand-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            Followers
          </button>
          <button
            onClick={() => setActiveTab('following')}
            className={`flex-1 py-3 text-sm font-semibold text-center border-b-2 transition-all ${
              activeTab === 'following'
                ? 'border-brand-600 text-brand-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            Following
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 min-h-[260px]">
          {!canView ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                <Lock size={26} />
              </div>
              <h3 className="text-base font-bold text-gray-900">This Account is Private</h3>
              <p className="text-xs text-gray-500 max-w-xs leading-relaxed">
                Follow @{targetUsername} to see who they follow and who follows them.
              </p>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
              <Loader2 className="animate-spin text-brand-600" size={28} />
              <p className="text-xs">Loading {activeTab}...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400 space-y-1">
              <div className="text-3xl mb-1">👥</div>
              <p className="text-sm font-semibold text-gray-700">
                No {activeTab} yet
              </p>
              <p className="text-xs text-gray-400">
                {activeTab === 'followers'
                  ? `@${targetUsername} does not have any followers yet.`
                  : `@${targetUsername} is not following anyone yet.`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((u) => {
                const isMe = currentUserId === u.id
                const isFollowing = !!followingMap[u.id]

                return (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 transition-colors gap-3"
                  >
                    <Link
                      href={`/@${u.username}`}
                      onClick={onClose}
                      className="flex items-center gap-3 flex-1 min-w-0 group"
                    >
                      <div className="w-11 h-11 rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-600 flex-shrink-0 text-sm overflow-hidden border border-gray-100">
                        {u.avatarUrl ? (
                          <Image
                            src={u.avatarUrl}
                            alt={u.displayName}
                            width={44}
                            height={44}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          u.displayName.charAt(0).toUpperCase()
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-gray-900 truncate group-hover:text-brand-600 transition-colors">
                          {u.displayName}
                        </div>
                        <div className="text-xs text-gray-500 truncate">@{u.username}</div>
                        {u.bio && (
                          <p className="text-[11px] text-gray-600 truncate mt-0.5">{u.bio}</p>
                        )}
                      </div>
                    </Link>

                    {currentUserId && !isMe && (
                      <button
                        onClick={() => handleToggleFollow(u.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all flex-shrink-0 ${
                          isFollowing
                            ? 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 border border-gray-200'
                            : 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/20'
                        }`}
                      >
                        {isFollowing ? (
                          <>
                            <UserCheck size={14} />
                            <span>Following</span>
                          </>
                        ) : (
                          <>
                            <UserPlus size={14} />
                            <span>Follow</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
