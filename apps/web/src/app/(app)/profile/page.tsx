'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Edit3, Lock, Shield, ExternalLink, LogOut, Settings, Bookmark } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import EditProfileModal from '@/components/profile/EditProfileModal'
import FollowListModal from '@/components/profile/FollowListModal'
import PostCard from '@/components/feed/PostCard'
import type { Post } from '@private-voices/shared'
import { extractPostMediaAndCleanContent } from '@private-voices/shared'
import { useRouter } from 'next/navigation'

export default function ProfileDashboardPage(): React.JSX.Element {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const [profile, setProfile] = useState<any>(null)
  const [privacy, setPrivacy] = useState<any>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [savedPosts, setSavedPosts] = useState<Post[]>([])
  const [stats, setStats] = useState({ followers: 0, following: 0, posts: 0 })
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showFollowModal, setShowFollowModal] = useState(false)
  const [followModalTab, setFollowModalTab] = useState<'followers' | 'following'>('followers')
  const [activeSection, setActiveSection] = useState<'posts' | 'saved' | 'privacy'>('posts')

  const fetchUserData = useCallback(async () => {
    setLoading(true)
    const { data: userRes } = await supabase.auth.getUser()
    if (!userRes.user) {
      router.push('/login')
      return
    }

    const userId = userRes.user.id

    const [{ data: prof }, { data: priv }, { count: followerCount }, { count: followingCount }, { count: postCount }] =
      await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('privacy_settings').select('*').eq('user_id', userId).single(),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
        supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', userId),
      ])

    setProfile(prof)
    setPrivacy(priv)
    setStats({
      followers: followerCount ?? 0,
      following: followingCount ?? 0,
      posts: postCount ?? 0,
    })

    // Fetch user posts
    const { data: myPosts } = await supabase
      .from('posts')
      .select('*, author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url)')
      .eq('author_id', userId)
      .order('created_at', { ascending: false })

    if (myPosts) {
      const formatted: Post[] = await Promise.all(
        myPosts.map(async (p) => {
          const [{ count: likeCount }, { count: commentCount }, { data: myLike }, { data: mySave }] = await Promise.all([
            supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
            supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
            supabase.from('likes').select('user_id').match({ user_id: userId, post_id: p.id }).maybeSingle(),
            supabase.from('saved_posts').select('user_id').match({ user_id: userId, post_id: p.id }).maybeSingle(),
          ])

          const { content: cleanContent, imageUrls } = extractPostMediaAndCleanContent(p.content, p.image_urls)
          return {
            id: p.id,
            authorId: p.author_id,
            author: {
              id: p.author?.id || p.author_id,
              username: p.author?.username || 'user',
              displayName: p.author?.display_name || p.author?.username || 'User',
              avatarUrl: p.author?.avatar_url,
            },
            content: cleanContent,
            imageUrls,
            hashtags: [],
            likeCount: likeCount ?? 0,
            commentCount: commentCount ?? 0,
            repostCount: 0,
            isLikedByMe: !!myLike,
            isSavedByMe: !!mySave,
            isRepostedByMe: false,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
          }
        })
      )
      setPosts(formatted)
    }

    // Fetch user saved posts
    const { data: savedRows } = await supabase
      .from('saved_posts')
      .select('post_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (savedRows && savedRows.length > 0) {
      const savedIds = savedRows.map((r) => r.post_id)
      const { data: rawSavedPosts } = await supabase
        .from('posts')
        .select('*, author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url)')
        .in('id', savedIds)

      if (rawSavedPosts) {
        const postMap = new Map(rawSavedPosts.map((p) => [p.id, p]))
        const orderedSaved = savedIds.map((id) => postMap.get(id)).filter(Boolean) as any[]

        const formattedSaved: Post[] = await Promise.all(
          orderedSaved.map(async (p) => {
            const [{ count: likeCount }, { count: commentCount }, { data: myLike }] = await Promise.all([
              supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
              supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
              supabase.from('likes').select('user_id').match({ user_id: userId, post_id: p.id }).maybeSingle(),
            ])

            const { content: cleanContent, imageUrls } = extractPostMediaAndCleanContent(p.content, p.image_urls)
            return {
              id: p.id,
              authorId: p.author_id,
              author: {
                id: p.author?.id || p.author_id,
                username: p.author?.username || 'user',
                displayName: p.author?.display_name || p.author?.username || 'User',
                avatarUrl: p.author?.avatar_url,
              },
              content: cleanContent,
              imageUrls,
              hashtags: [],
              likeCount: likeCount ?? 0,
              commentCount: commentCount ?? 0,
              repostCount: 0,
              isLikedByMe: !!myLike,
              isSavedByMe: true,
              isRepostedByMe: false,
              createdAt: p.created_at,
              updatedAt: p.updated_at,
            }
          })
        )
        setSavedPosts(formattedSaved)
      }
    } else {
      setSavedPosts([])
    }

    setLoading(false)
  }, [supabase, router])

  useEffect(() => {
    fetchUserData()
  }, [fetchUserData])

  async function handleUpdatePrivacy(key: string, value: any) {
    if (!profile) return
    const { error } = await supabase
      .from('privacy_settings')
      .update({ [key]: value })
      .eq('user_id', profile.id)

    if (!error) {
      setPrivacy((prev: any) => ({ ...prev, [key]: value }))
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="card p-12 text-center text-gray-400 max-w-2xl mx-auto">
        <p className="text-sm">Loading profile...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Top Header with Settings Gear Icon */}
      <div className="flex items-center justify-between px-1">
        <h1 className="text-xl font-bold text-gray-900">Profile</h1>
        <Link
          href="/settings"
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200/60 rounded-full transition-colors group relative"
          title="Settings"
          aria-label="Settings"
        >
          <Settings size={22} className="group-hover:rotate-45 transition-transform duration-200" />
        </Link>
      </div>
      {/* Profile Summary Card */}
      <div className="card p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-full bg-brand-100 flex items-center justify-center font-bold text-2xl text-brand-600 flex-shrink-0">
            {profile.avatar_url ? (
              <Image src={profile.avatar_url} alt={profile.display_name} width={80} height={80} className="rounded-full object-cover" />
            ) : (
              profile.display_name.charAt(0).toUpperCase()
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{profile.display_name}</h1>
              {profile.is_private && <Lock size={16} className="text-brand-600" />}
            </div>
            <p className="text-sm text-gray-500">@{profile.username}</p>
            {profile.bio && <p className="mt-2 text-sm text-gray-700">{profile.bio}</p>}

            <div className="mt-3 flex gap-6 text-sm">
              <div>
                <span className="font-semibold text-gray-900">{stats.posts}</span> <span className="text-gray-500">posts</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFollowModalTab('followers')
                  setShowFollowModal(true)
                }}
                className="hover:opacity-80 transition-opacity focus:outline-none"
              >
                <span className="font-semibold text-gray-900">{stats.followers}</span> <span className="text-gray-500">followers</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFollowModalTab('following')
                  setShowFollowModal(true)
                }}
                className="hover:opacity-80 transition-opacity focus:outline-none"
              >
                <span className="font-semibold text-gray-900">{stats.following}</span> <span className="text-gray-500">following</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Your Anonymous Whisper Link Card */}
      <div className="card p-5 bg-gradient-to-r from-purple-900 to-indigo-900 text-white space-y-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl">🤫</span>
            <h3 className="font-bold text-sm">Your Anonymous Whisper Link</h3>
          </div>
          <span className="text-[10px] bg-white/20 px-2.5 py-0.5 rounded-full font-mono text-purple-200 font-semibold">
            Public Link
          </span>
        </div>
        <p className="text-xs text-purple-200 leading-relaxed">
          Let people send you anonymous messages. Share on WhatsApp, Instagram, X, TikTok, or your bio.
        </p>
        <div className="flex flex-wrap items-center gap-2 bg-black/40 border border-white/20 rounded-xl p-2.5 text-xs font-mono">
          <span className="truncate flex-1 min-w-[140px] text-purple-200">
            privatevoices.app/w/@{profile.username}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                const url = `${window.location.origin}/w/@${profile.username}`
                navigator.clipboard.writeText(url)
                alert('Whisper link copied to clipboard!')
              }}
              className="px-3 py-1.5 bg-white text-purple-950 font-bold rounded-lg text-xs hover:bg-purple-100 transition-colors shadow-sm"
            >
              Copy Link
            </button>
            <button
              onClick={() => {
                const url = `${window.location.origin}/w/@${profile.username}`
                if (navigator.share) {
                  navigator.share({
                    title: `Send an Anonymous Whisper to ${profile.display_name}`,
                    text: 'Receive honest thoughts from people around you — anonymously.',
                    url,
                  })
                } else {
                  navigator.clipboard.writeText(url)
                  alert('Whisper link copied to clipboard!')
                }
              }}
              className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-lg text-xs transition-colors shadow-sm"
            >
              Share
            </button>
            <a
              href={`/w/@${profile.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg text-xs transition-colors"
            >
              Preview
            </a>
          </div>
        </div>
      </div>

      {/* Tabs / Sections */}
      <div className="flex border-b border-gray-200 bg-white rounded-xl p-1 gap-1">
        <button
          onClick={() => setActiveSection('posts')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
            activeSection === 'posts' ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          My Voices ({posts.length})
        </button>

        <button
          onClick={() => setActiveSection('saved')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
            activeSection === 'saved' ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Bookmark size={14} />
          <span>Saved ({savedPosts.length})</span>
        </button>

        <button
          onClick={() => setActiveSection('privacy')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
            activeSection === 'privacy' ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Shield size={14} />
          <span>Privacy Center</span>
        </button>
      </div>

      {/* Section Content */}
      {activeSection === 'posts' ? (
        posts.length === 0 ? (
          <div className="card p-12 text-center text-gray-400 space-y-1">
            <p className="text-sm font-medium">You haven't posted anything yet.</p>
            <p className="text-xs text-gray-500">Share your thoughts freely with the world!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={profile.id}
                onDelete={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
                onToggleSave={(id, isSaved) => {
                  if (!isSaved) {
                    setSavedPosts((prev) => prev.filter((p) => p.id !== id))
                  } else {
                    const postToAdd = posts.find((p) => p.id === id)
                    if (postToAdd) setSavedPosts((prev) => [postToAdd, ...prev])
                  }
                }}
              />
            ))}
          </div>
        )
      ) : activeSection === 'saved' ? (
        savedPosts.length === 0 ? (
          <div className="card p-12 text-center text-gray-400 space-y-2">
            <div className="text-3xl">🔖</div>
            <p className="text-sm font-semibold text-gray-700">No saved Voices yet</p>
            <p className="text-xs text-gray-500">
              Bookmark interesting voices by clicking the bookmark icon on any post to read them anytime.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {savedPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={profile.id}
                onDelete={(id) => setSavedPosts((prev) => prev.filter((p) => p.id !== id))}
                onToggleSave={(id, isSaved) => {
                  if (!isSaved) {
                    setSavedPosts((prev) => prev.filter((p) => p.id !== id))
                  }
                }}
              />
            ))}
          </div>
        )
      ) : (
        /* Privacy Center Settings */
        <div className="card p-6 space-y-5 divide-y divide-gray-100">
          <div className="space-y-3 pt-1">
            <h3 className="text-sm font-bold text-gray-900">Whisper Controls</h3>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Who can send you Whispers?</span>
              <select
                value={privacy?.whisper_visibility ?? 'anyone'}
                onChange={(e) => handleUpdatePrivacy('whisper_visibility', e.target.value)}
                className="input-field w-auto py-1 px-2.5 text-xs"
              >
                <option value="anyone">Anyone</option>
                <option value="followers">Followers only</option>
                <option value="nobody">Nobody</option>
              </select>
            </div>
          </div>

          <div className="space-y-3 pt-4">
            <h3 className="text-sm font-bold text-gray-900">Direct Message Controls</h3>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Who can message you?</span>
              <select
                value={privacy?.who_can_message ?? 'anyone'}
                onChange={(e) => handleUpdatePrivacy('who_can_message', e.target.value)}
                className="input-field w-auto py-1 px-2.5 text-xs"
              >
                <option value="anyone">Anyone</option>
                <option value="followers">Followers only</option>
                <option value="nobody">Nobody</option>
              </select>
            </div>
          </div>

          <div className="space-y-3 pt-4">
            <h3 className="text-sm font-bold text-gray-900">Discovery Preferences</h3>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Show me in recommendations</span>
              <input
                type="checkbox"
                checked={privacy?.show_in_recommendations ?? true}
                onChange={(e) => handleUpdatePrivacy('show_in_recommendations', e.target.checked)}
                className="rounded text-brand-600 focus:ring-brand-500 h-4 w-4"
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditModal && (
        <EditProfileModal
          initialProfile={{
            displayName: profile.display_name,
            bio: profile.bio,
            isPrivate: profile.is_private,
          }}
          onClose={() => setShowEditModal(false)}
          onUpdated={fetchUserData}
        />
      )}

      {/* Follow List Modal (Followers & Following) */}
      <FollowListModal
        isOpen={showFollowModal}
        onClose={() => setShowFollowModal(false)}
        targetUserId={profile.id}
        targetUsername={profile.username}
        initialTab={followModalTab}
        canView={true}
        currentUserId={profile.id}
      />
    </div>
  )
}
