'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Lock, UserPlus, UserCheck, MessageSquare, Send, Loader2 } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { PublicProfile } from '@private-voices/shared'
import FollowListModal from './FollowListModal'
import { UserBadgesRow } from '../common/PlatformBadge'
import ChatDrawer from '@/components/messages/ChatDrawer'

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
  const [userBadges, setUserBadges] = useState<string[]>([])

  useEffect(() => {
    async function loadBadges() {
      try {
        const { data } = await supabase
          .from('user_badges')
          .select('badge_id')
          .eq('user_id', profile.id)
          .is('revoked_at', null)

        if (data) {
          setUserBadges(data.map((b) => b.badge_id))
        }
      } catch {
        // Safe fallback
      }
    }
    loadBadges()
  }, [supabase, profile.id])

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

  const [isStartingChat, setIsStartingChat] = useState(false)
  const [activeChatConvId, setActiveChatConvId] = useState<string | null>(null)

  async function handleStartDM() {
    if (isStartingChat) return
    setIsStartingChat(true)

    try {
      let resolvedUserId = currentUserId
      if (!resolvedUserId) {
        const { data: authData } = await supabase.auth.getUser()
        resolvedUserId = authData.user?.id || null
      }

      if (!resolvedUserId) {
        router.push('/login')
        return
      }

      const [userA, userB] = resolvedUserId < profile.id ? [resolvedUserId, profile.id] : [profile.id, resolvedUserId]

      // 1. Try finding existing conversation
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_a_id', userA)
        .eq('user_b_id', userB)
        .maybeSingle()

      if (existingConv?.id) {
        setActiveChatConvId(existingConv.id)
        return
      }

      // 2. Insert or upsert new conversation
      let convId: string | null = null
      const { data: upsertData, error: upsertErr } = await supabase
        .from('conversations')
        .upsert(
          {
            user_a_id: userA,
            user_b_id: userB,
            last_message: 'Started a new conversation',
            last_message_at: new Date().toISOString(),
          },
          { onConflict: 'user_a_id,user_b_id' }
        )
        .select('id')
        .maybeSingle()

      if (!upsertErr && upsertData?.id) {
        convId = upsertData.id
      } else {
        // Fallback plain insert
        const { data: insertData } = await supabase
          .from('conversations')
          .insert({
            user_a_id: userA,
            user_b_id: userB,
            last_message: 'Started a new conversation',
            last_message_at: new Date().toISOString(),
          })
          .select('id')
          .maybeSingle()
        convId = insertData?.id || null
      }

      if (convId) {
        setActiveChatConvId(convId)
      } else {
        // Fallback navigate to inbox
        router.push('/inbox')
      }
    } catch (err) {
      console.error('Error starting chat from profile:', err)
      router.push('/inbox')
    } finally {
      setIsStartingChat(false)
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
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 truncate">{profile.displayName}</h1>
              <UserBadgesRow badges={userBadges} size={17} />
              {profile.isPrivate && (
                <span title="Private Account">
                  <Lock size={16} className="text-brand-600 flex-shrink-0" />
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 truncate">@{profile.username}</p>

            {profile.bio && <p className="mt-2 text-sm text-gray-700 leading-relaxed">{profile.bio}</p>}

            {/* Profile Stats: Posts · Followers · Following */}
            <div className="mt-3 flex gap-5 text-sm">
              <div>
                <span className="font-bold text-gray-900">{profile.postCount}</span>{' '}
                <span className="text-gray-500">posts</span>
              </div>

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
              disabled={isStartingChat}
              className="btn-secondary flex-1 py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isStartingChat ? (
                <>
                  <Loader2 size={15} className="animate-spin text-brand-600" />
                  <span>Opening...</span>
                </>
              ) : (
                <>
                  <Send size={15} />
                  <span>Message</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Direct In-App Chat Drawer */}
      {activeChatConvId && (currentUserId || profile.id) && (
        <ChatDrawer
          conversationId={activeChatConvId}
          partner={{
            id: profile.id,
            username: profile.username,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
          }}
          currentUserId={currentUserId || ''}
          onClose={() => setActiveChatConvId(null)}
        />
      )}

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
