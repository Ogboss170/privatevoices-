'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Edit3, Lock, Shield, ExternalLink, LogOut, Settings, Bookmark, LayoutGrid, Play, Repeat, UserCheck } from 'lucide-react'
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
  const [activeSection, setActiveSection] = useState<'posts' | 'voices' | 'reposts' | 'tagged'>('posts')

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

      {/* 4-Tab Content Navigation: Posts | Voices | Reposts | Tagged */}
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveSection('posts')}
          title="Posts"
          aria-label="Posts"
          className="flex-1 py-3 flex flex-col items-center justify-center relative transition-colors focus:outline-none"
        >
          <LayoutGrid
            size={20}
            className={`transition-colors ${
              activeSection === 'posts' ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600'
            }`}
            strokeWidth={activeSection === 'posts' ? 2.5 : 1.8}
          />
          {activeSection === 'posts' && (
            <span className="absolute bottom-0 h-0.5 w-12 bg-brand-600 rounded-full transition-all duration-200" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('voices')}
          title="Voices"
          aria-label="Voices"
          className="flex-1 py-3 flex flex-col items-center justify-center relative transition-colors focus:outline-none"
        >
          <Play
            size={20}
            className={`transition-colors ${
              activeSection === 'voices' ? 'text-brand-600 fill-brand-600' : 'text-gray-400 hover:text-gray-600'
            }`}
            strokeWidth={activeSection === 'voices' ? 2.5 : 1.8}
          />
          {activeSection === 'voices' && (
            <span className="absolute bottom-0 h-0.5 w-12 bg-brand-600 rounded-full transition-all duration-200" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('reposts')}
          title="Reposts"
          aria-label="Reposts"
          className="flex-1 py-3 flex flex-col items-center justify-center relative transition-colors focus:outline-none"
        >
          <Repeat
            size={20}
            className={`transition-colors ${
              activeSection === 'reposts' ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600'
            }`}
            strokeWidth={activeSection === 'reposts' ? 2.5 : 1.8}
          />
          {activeSection === 'reposts' && (
            <span className="absolute bottom-0 h-0.5 w-12 bg-brand-600 rounded-full transition-all duration-200" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('tagged')}
          title="Tagged"
          aria-label="Tagged"
          className="flex-1 py-3 flex flex-col items-center justify-center relative transition-colors focus:outline-none"
        >
          <UserCheck
            size={20}
            className={`transition-colors ${
              activeSection === 'tagged' ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600'
            }`}
            strokeWidth={activeSection === 'tagged' ? 2.5 : 1.8}
          />
          {activeSection === 'tagged' && (
            <span className="absolute bottom-0 h-0.5 w-12 bg-brand-600 rounded-full transition-all duration-200" />
          )}
        </button>
      </div>

      {/* Section Content */}
      {activeSection === 'posts' && (
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
      )}

      {activeSection === 'voices' && (() => {
        const voicePosts = posts.filter(
          (p) =>
            p.content?.includes('🎙️') ||
            p.content?.includes('audio') ||
            (p as any).audio_url ||
            (p as any).media_type === 'audio'
        )
        return voicePosts.length === 0 ? (
          <div className="card p-12 text-center text-gray-400 space-y-2 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 mb-2">
              <Play size={22} className="fill-brand-600" />
            </div>
            <p className="text-sm font-semibold text-gray-700">No Voices recorded</p>
            <p className="text-xs text-gray-500">
              Audio whispers and voice notes you record will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {voicePosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={profile.id}
                onDelete={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
                onToggleSave={(id, isSaved) => {
                  if (!isSaved) {
                    setSavedPosts((prev) => prev.filter((p) => p.id !== id))
                  }
                }}
              />
            ))}
          </div>
        )
      })()}

      {activeSection === 'reposts' && (() => {
        const repostList = posts.filter((p) => p.isRepostedByMe)
        return repostList.length === 0 ? (
          <div className="card p-12 text-center text-gray-400 space-y-2 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 mb-2">
              <Repeat size={22} />
            </div>
            <p className="text-sm font-semibold text-gray-700">No reposts yet</p>
            <p className="text-xs text-gray-500">
              Voices and posts you repost will appear on your profile tab.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {repostList.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={profile.id}
                onDelete={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
              />
            ))}
          </div>
        )
      })()}

      {activeSection === 'tagged' && (() => {
        const taggedPosts = posts.filter(
          (p) => profile?.username && p.content?.toLowerCase().includes(`@${profile.username.toLowerCase()}`)
        )
        return taggedPosts.length === 0 ? (
          <div className="card p-12 text-center text-gray-400 space-y-2 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 mb-2">
              <UserCheck size={22} />
            </div>
            <p className="text-sm font-semibold text-gray-700">No tagged voices</p>
            <p className="text-xs text-gray-500">
              When someone tags you in a voice or whisper, it will show up here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {taggedPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={profile.id}
                onDelete={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
              />
            ))}
          </div>
        )
      })()}

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
