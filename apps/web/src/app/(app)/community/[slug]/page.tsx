'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Users,
  Shield,
  Lock,
  Globe,
  Share2,
  Check,
  Plus,
  MessageSquare,
  BookOpen,
  UserCheck,
  Settings,
  X,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import PostCard from '@/components/feed/PostCard'
import type { Post } from '@private-voices/shared'

export default function CommunityDetailPage(): React.JSX.Element {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const supabase = createSupabaseBrowserClient()

  const [community, setCommunity] = useState<any | null>(null)
  const [activeTab, setActiveTab] = useState<'posts' | 'about' | 'members' | 'manage'>('posts')
  const [members, setMembers] = useState<any[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<'owner' | 'moderator' | 'member' | null>(null)
  const [membershipStatus, setMembershipStatus] = useState<'none' | 'pending' | 'member'>('none')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [rules, setRules] = useState<any[]>([])

  // Post creation inside community
  const [newPostContent, setNewPostContent] = useState('')
  const [posting, setPosting] = useState(false)

  const fetchCommunityData = useCallback(async () => {
    setLoading(true)
    const { data: userRes } = await supabase.auth.getUser()
    const uId = userRes?.user?.id || null
    setCurrentUserId(uId)

    // 1. Fetch community by slug
    const { data: comm, error } = await supabase
      .from('communities')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error || !comm) {
      setLoading(false)
      return
    }

    setCommunity(comm)

    // Default rules if none defined
    setRules([
      { id: 1, title: 'Be respectful', desc: 'Treat all members with courtesy and kindness.' },
      { id: 2, title: 'No harassment or hate speech', desc: 'Bullying, discrimination, and hate speech are strictly prohibited.' },
      { id: 3, title: 'Stay on topic', desc: 'Keep posts relevant to the community category and purpose.' },
      { id: 4, title: 'No spam or self-promotion', desc: 'Avoid unauthorized advertising or duplicate postings.' },
    ])

    // 2. Fetch membership status for current user
    if (uId) {
      const { data: member } = await supabase
        .from('community_members')
        .select('*')
        .match({ community_id: comm.id, user_id: uId })
        .maybeSingle()

      if (member) {
        setMembershipStatus(member.status === 'pending' ? 'pending' : 'member')
        setUserRole(member.role)
      } else {
        setMembershipStatus('none')
        setUserRole(null)
      }
    }

    // 3. Fetch members list
    const { data: mems } = await supabase
      .from('community_members')
      .select('*, user:profiles!community_members_user_id_fkey(id, username, display_name, avatar_url)')
      .eq('community_id', comm.id)

    setMembers(mems || [])

    // 4. Fetch community posts
    const { data: rawPosts } = await supabase
      .from('posts')
      .select('*, author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url)')
      .eq('community_id', comm.id)
      .order('created_at', { ascending: false })

    if (rawPosts) {
      const formatted: Post[] = rawPosts.map((p: any) => ({
        id: p.id,
        authorId: p.author_id,
        author: {
          id: p.author.id,
          username: p.author.username,
          displayName: p.author.display_name,
          avatarUrl: p.author.avatar_url,
        },
        content: p.content,
        imageUrls: p.image_urls ?? [],
        hashtags: [],
        likeCount: 0,
        commentCount: 0,
        repostCount: 0,
        isLikedByMe: false,
        isSavedByMe: false,
        isRepostedByMe: false,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }))
      setPosts(formatted)
    }

    setLoading(false)
  }, [slug, supabase])

  useEffect(() => {
    fetchCommunityData()
  }, [fetchCommunityData])

  async function handleJoinLeave() {
    if (!currentUserId || !community) return

    if (membershipStatus === 'member' || membershipStatus === 'pending') {
      // Leave / Cancel request
      await supabase
        .from('community_members')
        .delete()
        .match({ community_id: community.id, user_id: currentUserId })

      setMembershipStatus('none')
      setUserRole(null)
    } else {
      // Join
      const status = community.privacy === 'private' ? 'pending' : 'member'
      await supabase
        .from('community_members')
        .insert({ community_id: community.id, user_id: currentUserId, role: 'member', status })

      setMembershipStatus(status === 'pending' ? 'pending' : 'member')
      if (status === 'member') setUserRole('member')
    }
  }

  async function handleCreateCommunityPost(e: React.FormEvent) {
    e.preventDefault()
    if (!newPostContent.trim() || !currentUserId || !community) return

    setPosting(true)
    const { error } = await supabase.from('posts').insert({
      author_id: currentUserId,
      community_id: community.id,
      content: newPostContent.trim(),
    })

    if (!error) {
      setNewPostContent('')
      fetchCommunityData()
    }
    setPosting(false)
  }

  if (loading) {
    return (
      <div className="card p-12 text-center text-gray-400 max-w-2xl mx-auto">
        <p className="text-sm">Loading community...</p>
      </div>
    )
  }

  if (!community) {
    return (
      <div className="card p-12 text-center max-w-2xl mx-auto space-y-3">
        <h2 className="text-lg font-bold text-gray-900">Community Not Found</h2>
        <p className="text-xs text-gray-500">The requested community @{slug} does not exist or has been removed.</p>
        <Link href="/communities" className="btn-primary text-xs py-2 px-4 inline-block">
          Explore Communities
        </Link>
      </div>
    )
  }

  const isOwnerOrMod = userRole === 'owner' || userRole === 'moderator'

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-16">
      {/* Top Header Bar */}
      <div className="flex items-center space-x-3">
        <Link
          href="/communities"
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">{community.name}</h1>
      </div>

      {/* Community Header Banner Card */}
      <div className="card overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-brand-600 to-indigo-600 relative" />
        <div className="p-6 relative pt-0">
          <div className="flex items-end justify-between -mt-10 mb-4">
            <div className="w-20 h-20 rounded-2xl bg-white p-1 shadow-md">
              <div className="w-full h-full rounded-xl bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-2xl">
                {community.name.charAt(0).toUpperCase()}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleJoinLeave}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                  membershipStatus === 'member'
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : membershipStatus === 'pending'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-brand-600 text-white hover:bg-brand-700'
                }`}
              >
                {membershipStatus === 'member'
                  ? 'Joined'
                  : membershipStatus === 'pending'
                  ? 'Requested'
                  : 'Join Community'}
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href)
                  alert('Community link copied!')
                }}
                className="p-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl transition-colors"
                title="Share Community"
              >
                <Share2 size={16} />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">{community.name}</h2>
              {community.privacy === 'private' ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  <Lock size={12} />
                  <span>Private</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <Globe size={12} />
                  <span>Public</span>
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 font-mono">@{community.slug}</p>
            {community.description && <p className="text-sm text-gray-700">{community.description}</p>}

            <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t border-gray-100">
              <span className="flex items-center gap-1">
                <Users size={14} className="text-gray-400" />
                <strong className="text-gray-900">{members.length}</strong> members
              </span>
              <span>•</span>
              <span className="capitalize">{community.category || 'General Topic'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-gray-200 bg-white rounded-xl p-1 gap-1">
        <button
          onClick={() => setActiveTab('posts')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
            activeTab === 'posts' ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Posts
        </button>
        <button
          onClick={() => setActiveTab('about')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
            activeTab === 'about' ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          About & Rules
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
            activeTab === 'members' ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Members ({members.length})
        </button>
        {isOwnerOrMod && (
          <button
            onClick={() => setActiveTab('manage')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 ${
              activeTab === 'manage' ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Settings size={14} />
            <span>Manage</span>
          </button>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'posts' && (
        <div className="space-y-4">
          {/* Post composer inside community */}
          {membershipStatus === 'member' && (
            <form onSubmit={handleCreateCommunityPost} className="card p-4 space-y-3">
              <textarea
                rows={3}
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder={`Share something with @${community.slug}...`}
                className="input-field text-sm resize-none"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={posting || !newPostContent.trim()}
                  className="btn-primary text-xs py-2 px-4"
                >
                  {posting ? 'Posting...' : 'Post to Community'}
                </button>
              </div>
            </form>
          )}

          {posts.length === 0 ? (
            <div className="card p-12 text-center space-y-2">
              <h3 className="font-bold text-gray-900">No conversations yet.</h3>
              <p className="text-xs text-gray-500">Be the first person to start a conversation in this community.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} currentUserId={currentUserId || undefined} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'about' && (
        <div className="space-y-4">
          <div className="card p-6 space-y-3">
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <BookOpen size={18} className="text-brand-600" />
              <span>Community Rules</span>
            </h3>
            <div className="space-y-3 pt-2">
              {rules.map((rule) => (
                <div key={rule.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-1">
                  <h4 className="text-xs font-bold text-gray-900">
                    {rule.id}. {rule.title}
                  </h4>
                  <p className="text-xs text-gray-600">{rule.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'members' && (
        <div className="card divide-y divide-gray-100">
          {members.map((m) => (
            <div key={m.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-600 text-sm">
                  {m.user?.display_name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">{m.user?.display_name}</h4>
                  <p className="text-xs text-gray-400">@{m.user?.username}</p>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 capitalize">
                {m.role}
              </span>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'manage' && isOwnerOrMod && (
        <div className="card p-6 space-y-4">
          <h3 className="font-bold text-gray-900 text-base">Community Moderation & Management</h3>
          <p className="text-xs text-gray-500">Owner and moderator administrative tools.</p>

          <div className="space-y-2 pt-2 text-xs">
            <button
              onClick={() => alert('Pending join requests reviewed.')}
              className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-xl font-medium text-gray-700 flex justify-between items-center"
            >
              <span>Review Join Requests</span>
              <span className="text-gray-400 font-mono">0 pending</span>
            </button>
            <button
              onClick={() => alert('Community reports opened.')}
              className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-xl font-medium text-gray-700 flex justify-between items-center"
            >
              <span>Review Content Reports</span>
              <span className="text-gray-400 font-mono">0 reports</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
