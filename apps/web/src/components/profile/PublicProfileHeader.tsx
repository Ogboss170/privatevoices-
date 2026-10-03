'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Lock, UserPlus, UserCheck, MessageSquare, Send } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { PublicProfile } from '@private-voices/shared'
import FollowListModal from './FollowListModal'

interface PublicProfileHeaderProps {
  profile: PublicProfile
  currentUserId?: string | null
  initialIsFollowing: boolean
}

export default function PublicProfileHeader({
  profile,
  currentUserId,
  initialIsFollowing,
}: PublicProfileHeaderProps) {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [followerCount, setFollowerCount] = useState(profile.followerCount)
  const [followingCount, setFollowingCount] = useState(profile.followingCount)
  const [isPendingFollow, setIsPendingFollow] = useState(false)

  // Follow Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalTab, setModalTab] = useState<'followers' | 'following'>('followers')

  const isSelf = currentUserId === profile.id

  // Privacy Rule: Can view followers/following if NOT private OR already following OR viewing own profile
  const canViewFollows = !profile.isPrivate || isFollowing || isSelf

  async function handleToggleFollow() {
    if (!currentUserId) {
      router.push('/login')
      return
    }

    const nextState = !isFollowing
    setIsFollowing(nextState)
    setFollowerCount((prev) => (nextState ? prev + 1 : Math.max(0, prev - 1)))
    setIsPendingFollow(true)

    try {
      if (nextState) {
        await supabase.from('follows').insert({
          follower_id: currentUserId,
          following_id: profile.id,
        })
      } else {
        await supabase
          .from('follows')
          .delete()
          .match({ follower_id: currentUserId, following_id: profile.id })
      }
    } catch (err) {
      // Revert on error
      setIsFollowing(!nextState)
      setFollowerCount((prev) => (!nextState ? prev + 1 : Math.max(0, prev - 1)))
    } finally {
      setIsPendingFollow(false)
    }
  }

  function handleOpenFollowModal(tab: 'followers' | 'following') {
    setModalTab(tab)
    setIsModalOpen(true)
  }

  async function handleStartDM() {
    if (!currentUserId) {
      router.push('/login')
      return
    }

    const [userA, userB] = currentUserId < profile.id ? [currentUserId, profile.id] : [profile.id, currentUserId]
    const { data } = await supabase
      .from('conversations')
      .upsert({ user_a_id: userA, user_b_id: userB }, { onConflict: 'user_a_id,user_b_id' })
      .select('id')
      .maybeSingle()

    if (data) {
      router.push(`/inbox?c=${data.id}`)
    } else {
      router.push('/inbox')
    }
  }

  return (
    <>
      <div className="card p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-full bg-brand-100 flex items-center justify-center text-2xl font-bold text-brand-600 flex-shrink-0 overflow-hidden border border-gray-100">
            {profile.avatarUrl ? (
              <Image
                src={profile.avatarUrl}
                alt={profile.displayName}
                width={80}
                height={80}
                className="w-full h-full object-cover"
              />
            ) : (
              profile.displayName.charAt(0).toUpperCase()
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 truncate">{profile.displayName}</h1>
              {profile.isPrivate && (
                <span title="Private Account">
                  <Lock size={16} className="text-brand-600 flex-shrink-0" />
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 truncate">@{profile.username}</p>

            {profile.bio && <p className="mt-2 text-sm text-gray-700 leading-relaxed">{profile.bio}</p>}

            {/* Clickable Followers and Following stats */}
            <div className="mt-3 flex gap-5 text-sm">
              <button
                type="button"
                onClick={() => handleOpenFollowModal('followers')}
                className="hover:opacity-80 transition-opacity flex items-center gap-1.5 focus:outline-none"
              >
                <span className="font-bold text-gray-900">{followerCount}</span>
                <span className="text-gray-500">followers</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenFollowModal('following')}
                className="hover:opacity-80 transition-opacity flex items-center gap-1.5 focus:outline-none"
              >
                <span className="font-bold text-gray-900">{followingCount}</span>
                <span className="text-gray-500">following</span>
              </button>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        {!isSelf && (
          <div className="flex gap-3 pt-3 border-t border-gray-100">
            <button
              onClick={handleToggleFollow}
              disabled={isPendingFollow}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                isFollowing
                  ? 'bg-gray-100 text-gray-800 hover:bg-red-50 hover:text-red-600 hover:border-red-200 border border-gray-200'
                  : 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/20'
              }`}
            >
              {isFollowing ? (
                <>
                  <UserCheck size={16} />
                  <span>Following</span>
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  <span>Follow</span>
                </>
              )}
            </button>

            <button
              onClick={() => router.push(`/w/${profile.username}`)}
              className="btn-secondary flex-1 py-2.5 flex items-center justify-center gap-2"
            >
              <span>🤫</span>
              <span>Send Whisper</span>
            </button>

            <button
              onClick={handleStartDM}
              className="btn-secondary flex-1 py-2.5 flex items-center justify-center gap-2"
            >
              <Send size={15} />
              <span>Message</span>
            </button>
          </div>
        )}
      </div>

      {/* Follow List Modal */}
      <FollowListModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        targetUserId={profile.id}
        targetUsername={profile.username}
        initialTab={modalTab}
        canView={canViewFollows}
        currentUserId={currentUserId}
      />
    </>
  )
}
