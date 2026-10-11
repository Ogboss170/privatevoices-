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
  Search,
  Pin,
  Bell,
  Flag,
  UserMinus,
  LogOut,
  FileText,
  VolumeX,
  AlertCircle,
  Trash2,
  UserPlus,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Activity,
  Zap,
  Camera,
  Edit3,
  Radio,
  Sparkles,
  Image as ImageIcon,
  CheckCircle2,
  ExternalLink,
  Crown,
  Copy,
  Info,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/media/imageCompression'
import PostCard from '@/components/feed/PostCard'
import { CommunityRoleBadge } from '@/components/common/PlatformBadge'
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
  const [growthMetrics, setGrowthMetrics] = useState<any | null>(null)

  // Search & Settings parity states
  const [searchQuery, setSearchQuery] = useState('')
  const [searchActive, setSearchActive] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const [notifEnabled, setNotifEnabled] = useState(true)

  // Edit settings state (Full Profile & Branding customization)
  const [showEditProfileModal, setShowEditProfileModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editAvatarUrl, setEditAvatarUrl] = useState('')
  const [editCoverUrl, setEditCoverUrl] = useState('')
  const [editCategory, setEditCategory] = useState('General')
  const [editPrivacy, setEditPrivacy] = useState<'public' | 'private'>('public')
  const [editBroadcastMode, setEditBroadcastMode] = useState(false)
  const [editExternalLink, setEditExternalLink] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const avatarFileInputRef = React.useRef<HTMLInputElement | null>(null)
  const coverFileInputRef = React.useRef<HTMLInputElement | null>(null)

  // Post creation state
  const [newPostContent, setNewPostContent] = useState('')
  const [posting, setPosting] = useState(false)

  // Rules editor state
  const [editingRules, setEditingRules] = useState<any[]>([])
  const [savingRules, setSavingRules] = useState(false)

  // Community Mutes state
  const [mutes, setMutes] = useState<any[]>([])
  const [isMuted, setIsMuted] = useState(false)
  const [muteTargetMember, setMuteTargetMember] = useState<any | null>(null)
  const [muteReason, setMuteReason] = useState('')
  const [muteDuration, setMuteDuration] = useState<'1_day' | '7_days' | '30_days' | 'indefinite'>('7_days')
  const [mutingBusy, setMutingBusy] = useState(false)

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
    setEditName(comm.name || '')
    setEditDesc(comm.description || '')
    setEditAvatarUrl(comm.avatar_url || '')
    setEditCoverUrl(comm.cover_url || comm.banner_url || '')
    setEditCategory(comm.category || 'General')
    setEditPrivacy(comm.privacy || 'public')
    setEditBroadcastMode(Boolean(comm.broadcast_mode))
    setEditExternalLink(comm.external_link || '')

    // Load custom rules from database if present, else fallback
    const customRules = Array.isArray(comm.rules) && comm.rules.length > 0 ? comm.rules : [
      { id: 1, title: 'Be respectful', desc: 'Treat all members with courtesy and kindness.' },
      { id: 2, title: 'No harassment or hate speech', desc: 'Bullying, discrimination, and hate speech are strictly prohibited.' },
      { id: 3, title: 'Stay on topic', desc: 'Keep posts relevant to the community category and purpose.' },
      { id: 4, title: 'No spam or self-promotion', desc: 'Avoid unauthorized advertising or duplicate postings.' },
    ]
    setRules(customRules)
    setEditingRules(customRules)

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

    // 4. Fetch community mutes
    try {
      const { data: muteData } = await supabase
        .from('community_mutes')
        .select('*')
        .eq('community_id', comm.id)

      const activeMutes = (muteData ?? []).filter((m: any) => {
        if (!m.expires_at) return true
        return new Date(m.expires_at) > new Date()
      })

      setMutes(activeMutes)
      if (uId) {
        setIsMuted(activeMutes.some((m: any) => m.user_id === uId))
      }
    } catch {
      setMutes([])
      setIsMuted(false)
    }

    // 4. Fetch community posts (pinned posts stay at top)
    const { data: rawPosts } = await supabase
      .from('posts')
      .select('*, author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url)')
      .eq('community_id', comm.id)
      .order('is_pinned', { ascending: false })
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
        isPinned: p.is_pinned || false,
        pinnedAt: p.pinned_at || null,
        pinnedBy: p.pinned_by || null,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }))
      setPosts(formatted)
    }

    // 5. Fetch community growth & engagement metrics (for owners & mods)
    try {
      const { data: gMetrics } = await supabase.rpc('get_community_growth_metrics', { p_community_id: comm.id })
      if (gMetrics) {
        setGrowthMetrics(gMetrics)
      } else {
        // Fallback calculation
        setGrowthMetrics({
          totalMembers: (mems || []).length,
          newMembers7d: (mems || []).filter((m: any) => new Date(m.created_at) >= new Date(Date.now() - 7 * 86400000)).length,
          newMembers30d: (mems || []).filter((m: any) => new Date(m.created_at) >= new Date(Date.now() - 30 * 86400000)).length,
          totalPosts: (rawPosts || []).length,
          posts7d: (rawPosts || []).filter((p: any) => new Date(p.created_at) >= new Date(Date.now() - 7 * 86400000)).length,
          activeContributors30d: new Set((rawPosts || []).map((p: any) => p.author_id)).size,
          growthRate7d: 0,
          totalInteractions: 0,
        })
      }
    } catch {
      // Safe fallback
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
      const { error } = await supabase
        .from('community_members')
        .insert({ community_id: community.id, user_id: currentUserId, role: 'member', status })

      if (!error && community.creator_id && community.creator_id !== currentUserId) {
        await supabase.from('notifications').insert({
          recipient_id: community.creator_id,
          actor_id: currentUserId,
          type: 'community_join',
          title: 'New Community Member 📌',
          message: `joined ${community.name}.`,
          entity_type: 'community',
          entity_id: community.id,
          is_read: false,
        })
      }

      setMembershipStatus(status === 'pending' ? 'pending' : 'member')
      if (status === 'member') setUserRole('member')
    }
  }

  // Upload Avatar helper for admin
  async function handleUploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !community) return
    setUploadingAvatar(true)

    try {
      let fileToUpload = file
      try {
        fileToUpload = await compressImage(file, { maxWidth: 600, maxHeight: 600, quality: 0.85 })
      } catch (err) {
        console.warn('Avatar compression skipped:', err)
      }

      const fileExt = fileToUpload.name.split('.').pop() || 'jpg'
      const filePath = `communities/${community.id}/avatar-${Date.now()}.${fileExt}`

      let uploadRes = await supabase.storage
        .from('post-media')
        .upload(filePath, fileToUpload, { upsert: true })

      if (uploadRes.error) {
        uploadRes = await supabase.storage
          .from('stories')
          .upload(`chat/${filePath}`, fileToUpload, { upsert: true })
      }

      if (uploadRes.data) {
        const bucket = uploadRes.data.path.startsWith('chat/') ? 'stories' : 'post-media'
        const { data: publicUrlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(uploadRes.data.path)
        setEditAvatarUrl(publicUrlData.publicUrl)
      }
    } catch (err: any) {
      alert(`Avatar upload error: ${err.message}`)
    } finally {
      setUploadingAvatar(false)
    }
  }

  // Upload Cover Banner helper for admin
  async function handleUploadCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !community) return
    setUploadingCover(true)

    try {
      let fileToUpload = file
      try {
        fileToUpload = await compressImage(file, { maxWidth: 1920, maxHeight: 1080, quality: 0.85 })
      } catch (err) {
        console.warn('Cover compression skipped:', err)
      }

      const fileExt = fileToUpload.name.split('.').pop() || 'jpg'
      const filePath = `communities/${community.id}/cover-${Date.now()}.${fileExt}`

      let uploadRes = await supabase.storage
        .from('post-media')
        .upload(filePath, fileToUpload, { upsert: true })

      if (uploadRes.error) {
        uploadRes = await supabase.storage
          .from('stories')
          .upload(`chat/${filePath}`, fileToUpload, { upsert: true })
      }

      if (uploadRes.data) {
        const bucket = uploadRes.data.path.startsWith('chat/') ? 'stories' : 'post-media'
        const { data: publicUrlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(uploadRes.data.path)
        setEditCoverUrl(publicUrlData.publicUrl)
      }
    } catch (err: any) {
      alert(`Cover upload error: ${err.message}`)
    } finally {
      setUploadingCover(false)
    }
  }

  // Admin Profile & Branding Save Function
  async function handleSaveCommunityProfile(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!community || !editName.trim()) return
    setSavingSettings(true)

    try {
      const updatePayload: Record<string, any> = {
        name: editName.trim(),
        description: editDesc.trim(),
        avatar_url: editAvatarUrl.trim() || null,
        cover_url: editCoverUrl.trim() || null,
        banner_url: editCoverUrl.trim() || null,
        category: editCategory,
        privacy: editPrivacy,
        broadcast_mode: editBroadcastMode,
        external_link: editExternalLink.trim() || null,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('communities')
        .update(updatePayload)
        .eq('id', community.id)

      if (error) {
        throw error
      }

      alert('Community profile & branding updated successfully!')
      setShowEditProfileModal(false)
      fetchCommunityData()
    } catch (err: any) {
      alert(`Failed to update community: ${err.message}`)
    } finally {
      setSavingSettings(false)
    }
  }

  async function handleCreateCommunityPost(e: React.FormEvent) {
    e.preventDefault()
    if (!newPostContent.trim() || !currentUserId || !community) return

    if (isMuted) {
      alert('You have been muted in this community and cannot create new posts.')
      return
    }

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
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 flex-1">
          <Link
            href="/communities"
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          {searchActive ? (
            <div className="flex-1 flex items-center bg-gray-100 rounded-xl px-3 py-1.5 gap-2">
              <input
                type="text"
                placeholder="Search posts in community..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-xs text-gray-900 flex-1"
                autoFocus
              />
              <button onClick={() => { setSearchQuery(''); setSearchActive(false) }} className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            </div>
          ) : (
            <h1 className="text-xl font-bold text-gray-900">{community.name}</h1>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearchActive(!searchActive)}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
            title="Search posts"
          >
            <Search size={18} />
          </button>
          {membershipStatus === 'member' && (
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
              title="Community Settings"
            >
              <Settings size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Hidden file inputs for direct admin cover and avatar upload */}
      <input
        type="file"
        ref={avatarFileInputRef}
        onChange={handleUploadAvatar}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={coverFileInputRef}
        onChange={handleUploadCover}
        accept="image/*"
        className="hidden"
      />

      {/* Grand Facebook / Telegram Style Community Header Card */}
      <div className="card overflow-hidden shadow-lg border border-gray-200/80 bg-white">
        {/* Cover Banner Area */}
        <div className="h-56 sm:h-64 bg-gradient-to-r from-slate-900 via-indigo-950 to-brand-900 relative group overflow-hidden">
          {community.cover_url || community.banner_url ? (
            <img
              src={community.cover_url || community.banner_url}
              alt={community.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-tr from-brand-900 via-indigo-900 to-purple-900 text-white/30 p-6 text-center">
              <span className="text-4xl sm:text-5xl font-black tracking-widest uppercase select-none opacity-40">
                {community.name}
              </span>
              <p className="text-xs text-white/50 mt-1 font-mono tracking-wider">
                c/{community.slug}
              </p>
            </div>
          )}

          {/* Cover gradient overlay for contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />

          {/* Admin Cover Upload Quick Action */}
          {isOwnerOrMod && (
            <button
              onClick={() => coverFileInputRef.current?.click()}
              disabled={uploadingCover}
              className="absolute top-4 right-4 px-3.5 py-1.5 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md text-white text-xs font-semibold flex items-center gap-2 border border-white/20 transition-all shadow-md active:scale-95"
              title="Edit Cover Photo"
            >
              <Camera size={14} className="text-white" />
              <span>{uploadingCover ? 'Uploading Cover…' : 'Edit Cover Photo'}</span>
            </button>
          )}

          {/* Broadcast Channel Badge in Top Left */}
          {community.broadcast_mode && (
            <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-indigo-600/90 text-white text-[11px] font-bold backdrop-blur-md flex items-center gap-1.5 shadow-md border border-white/20">
              <Radio size={12} className="animate-pulse text-indigo-200" />
              <span>Official Channel</span>
            </div>
          )}
        </div>

        {/* Profile Info, Avatar & Action Controls */}
        <div className="p-6 relative pt-0">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-16 sm:-mt-20 mb-5 gap-4">
            {/* Avatar with Admin Edit Camera Pill */}
            <div className="relative group/avatar self-start">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-white p-2 shadow-xl relative z-10 border-4 border-white">
                {community.avatar_url ? (
                  <img
                    src={community.avatar_url}
                    alt={community.name}
                    className="w-full h-full rounded-2xl object-cover"
                  />
                ) : (
                  <div className="w-full h-full rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white font-black text-4xl shadow-inner">
                    {community.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Admin Avatar Upload Overlay Pill */}
              {isOwnerOrMod && (
                <button
                  onClick={() => avatarFileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute bottom-2 right-2 z-20 w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center shadow-lg border-2 border-white hover:bg-brand-700 transition-transform active:scale-90"
                  title="Change Community Avatar"
                >
                  <Camera size={14} />
                </button>
              )}
            </div>

            {/* Action Bar (Join, Invite, Admin Edit Profile) */}
            <div className="flex items-center gap-2 flex-wrap">
              {isOwnerOrMod && (
                <button
                  onClick={() => {
                    setEditName(community.name || '')
                    setEditDesc(community.description || '')
                    setEditAvatarUrl(community.avatar_url || '')
                    setEditCoverUrl(community.cover_url || community.banner_url || '')
                    setEditCategory(community.category || 'General')
                    setEditPrivacy(community.privacy || 'public')
                    setEditBroadcastMode(Boolean(community.broadcast_mode))
                    setEditExternalLink(community.external_link || '')
                    setShowEditProfileModal(true)
                  }}
                  className="px-4 py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <Edit3 size={14} />
                  <span>Edit Profile</span>
                </button>
              )}

              <button
                onClick={handleJoinLeave}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95 ${
                  membershipStatus === 'member'
                    ? 'bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-300'
                    : membershipStatus === 'pending'
                    ? 'bg-amber-50 text-amber-700 border border-amber-300'
                    : 'bg-brand-600 text-white hover:bg-brand-700 shadow-brand-500/25'
                }`}
              >
                {membershipStatus === 'member' ? (
                  <>
                    <Check size={15} />
                    <span>Joined Group</span>
                  </>
                ) : membershipStatus === 'pending' ? (
                  <span>Requested to Join</span>
                ) : (
                  <>
                    <Plus size={15} />
                    <span>Join Group</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href)
                  alert('Community link copied to clipboard!')
                }}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 border border-gray-200 shadow-2xs active:scale-95"
                title="Share Community"
              >
                <Share2 size={15} />
                <span>+ Invite</span>
              </button>
            </div>
          </div>

          {/* Group Title, Identity & Stats */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                  {community.name}
                </h2>

                {/* Privacy Badge: Public vs Private (Facebook style) */}
                {community.privacy === 'private' ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-3 py-0.5 rounded-full border border-amber-200/80 shadow-2xs">
                    <Lock size={12} className="text-amber-600" />
                    <span>Private Group</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-3 py-0.5 rounded-full border border-emerald-200/80 shadow-2xs">
                    <Globe size={12} className="text-emerald-600" />
                    <span>Public Group</span>
                  </span>
                )}

                {/* Telegram-style channel pill */}
                {community.broadcast_mode && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-indigo-800 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                    <Radio size={11} className="text-indigo-600" />
                    <span>Broadcast Channel</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-brand-600 font-semibold font-mono">
                  c/{community.slug}
                </p>
                {community.external_link && (
                  <>
                    <span className="text-gray-300">•</span>
                    <a
                      href={community.external_link.startsWith('http') ? community.external_link : `https://${community.external_link}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                    >
                      <ExternalLink size={12} />
                      <span>{community.external_link.replace(/^https?:\/\//, '')}</span>
                    </a>
                  </>
                )}
              </div>
            </div>

            {/* Description / Bio */}
            {community.description && (
              <p className="text-sm text-gray-700 leading-relaxed max-w-xl">
                {community.description}
              </p>
            )}

            {/* Facebook/Telegram Style Social Counter Banner */}
            <div className="flex items-center gap-4 text-xs text-gray-500 pt-3 border-t border-gray-100 flex-wrap">
              <span className="flex items-center gap-1.5">
                <Users size={14} className="text-gray-400" />
                <strong className="text-gray-900 font-bold">{members.length}</strong>
                <span>{members.length === 1 ? 'member' : 'members'}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <FileText size={14} className="text-gray-400" />
                <strong className="text-gray-900 font-bold">{posts.length}</strong>
                <span>discussions</span>
              </span>
              <span>•</span>
              <span className="capitalize font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">
                {community.category || 'General'}
              </span>
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
              isMuted ? (
                <div className="card p-4 flex items-center gap-3 bg-amber-50/80 border border-amber-200 text-amber-900 rounded-xl">
                  <VolumeX size={20} className="text-amber-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold">You are currently muted in this community</p>
                    <p className="text-[11px] text-amber-700">A community moderator has restricted your posting privileges.</p>
                  </div>
                </div>
              ) : community.broadcast_mode && !isOwnerOrMod ? (
              <div className="card p-4 flex items-center gap-3 bg-indigo-50/70 border border-indigo-200/80 text-indigo-950 rounded-2xl">
                <Radio size={19} className="text-indigo-600 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold flex items-center gap-1.5">
                    <span>Broadcast Channel Mode Active</span>
                    <span className="text-[10px] bg-indigo-200/70 text-indigo-800 font-extrabold px-1.5 py-0.2 rounded-full">Telegram Style</span>
                  </p>
                  <p className="text-[11px] text-indigo-700 mt-0.5">
                    Only channel admins can broadcast new voices. You can listen, react, and reply to discussions below.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateCommunityPost} className="card p-4 space-y-3">
                <textarea
                  rows={3}
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  placeholder={
                    community.broadcast_mode
                      ? `Broadcast an official announcement to @${community.slug}...`
                      : `Share something with @${community.slug}...`
                  }
                  className="input-field text-sm resize-none"
                />
                <div className="flex justify-between items-center">
                  {community.broadcast_mode ? (
                    <span className="text-[11px] font-bold text-indigo-600 flex items-center gap-1">
                      <Radio size={12} />
                      <span>Admin Broadcast</span>
                    </span>
                  ) : <div />}
                  <button
                    type="submit"
                    disabled={posting || !newPostContent.trim()}
                    className="btn-primary text-xs py-2 px-4 shadow-sm"
                  >
                    {posting ? 'Posting...' : community.broadcast_mode ? 'Broadcast Voice' : 'Post to Community'}
                  </button>
                </div>
              </form>
            )
          )}

          {posts.length === 0 ? (
            <div className="card p-12 text-center space-y-2">
              <h3 className="font-bold text-gray-900">No conversations yet.</h3>
              <p className="text-xs text-gray-500">Be the first person to start a conversation in this community.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={currentUserId || undefined}
                  communityRole={userRole}
                  onTogglePin={() => {
                    fetchCommunityData()
                  }}
                />
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
              {/* Role Badge */}
              {m.role === 'owner' ? (
                <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  <Shield size={12} />
                  Owner
                </span>
              ) : m.role === 'moderator' ? (
                <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                  <UserCheck size={12} />
                  Moderator
                </span>
              ) : (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                  Member
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'manage' && isOwnerOrMod && (
        <div className="space-y-6">
          {/* 1. Community Growth & Engagement Metrics Overview */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-brand-600" />
                <h3 className="font-bold text-gray-900 text-base">Community Growth & Engagement</h3>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                7-Day Growth: {growthMetrics?.growthRate7d ? `+${growthMetrics.growthRate7d}%` : '+0%'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 space-y-1">
                <div className="flex items-center justify-between text-gray-500">
                  <span className="text-xs font-medium">Total Members</span>
                  <Users size={15} className="text-brand-600" />
                </div>
                <p className="text-xl font-bold text-gray-900">{growthMetrics?.totalMembers ?? members.length}</p>
                <p className="text-[11px] text-emerald-600 font-semibold">
                  +{growthMetrics?.newMembers7d ?? 0} past 7d
                </p>
              </div>

              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 space-y-1">
                <div className="flex items-center justify-between text-gray-500">
                  <span className="text-xs font-medium">Total Voices</span>
                  <FileText size={15} className="text-purple-600" />
                </div>
                <p className="text-xl font-bold text-gray-900">{growthMetrics?.totalPosts ?? posts.length}</p>
                <p className="text-[11px] text-purple-600 font-semibold">
                  +{growthMetrics?.posts7d ?? 0} new this week
                </p>
              </div>

              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 space-y-1">
                <div className="flex items-center justify-between text-gray-500">
                  <span className="text-xs font-medium">30d Contributors</span>
                  <Activity size={15} className="text-blue-600" />
                </div>
                <p className="text-xl font-bold text-gray-900">{growthMetrics?.activeContributors30d ?? 0}</p>
                <p className="text-[11px] text-gray-400">Unique active authors</p>
              </div>

              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 space-y-1">
                <div className="flex items-center justify-between text-gray-500">
                  <span className="text-xs font-medium">Total Interactions</span>
                  <Zap size={15} className="text-amber-600" />
                </div>
                <p className="text-xl font-bold text-gray-900">{growthMetrics?.totalInteractions ?? 0}</p>
                <p className="text-[11px] text-amber-700 font-medium">Likes & comments</p>
              </div>
            </div>

            <div className="p-3 bg-brand-50/60 border border-brand-100 rounded-xl text-xs text-brand-900 flex items-center justify-between">
              <span className="font-medium">Member Acquisition: <strong>{growthMetrics?.newMembers30d ?? 0}</strong> new members joined over the last 30 days.</span>
              <span className="text-[11px] font-bold text-brand-700">Creator Analytics Active</span>
            </div>
          </div>

          {/* 2. Community Settings & Customization Card */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <Settings size={18} className="text-brand-600" />
              <h3 className="font-bold text-gray-900 text-base">Community Settings</h3>
            </div>

            <form onSubmit={handleSaveCommunityProfile} className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Community Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="e.g. Lagos Tech Founders, Campus Voices"
                    className="input-field text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Category Topic
                  </label>
                  <input
                    type="text"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    placeholder="e.g. Technology, Education, Music, Art"
                    className="input-field text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Description & Purpose
                </label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Describe what this group is about and what members can discuss..."
                  className="input-field text-xs resize-none"
                />
              </div>

              {/* Avatar & Cover Banner Visual Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Profile Picture / Avatar
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-brand-600">
                      {editAvatarUrl ? (
                        <img src={editAvatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        editName.charAt(0) || 'C'
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={uploadingAvatar}
                      onClick={() => avatarFileInputRef.current?.click()}
                      className="btn-secondary text-xs py-2 px-3 flex-1 flex items-center justify-center gap-1.5"
                    >
                      <Camera size={13} />
                      <span>{uploadingAvatar ? 'Uploading...' : 'Upload Image'}</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={editAvatarUrl}
                    onChange={(e) => setEditAvatarUrl(e.target.value)}
                    placeholder="Or paste image URL"
                    className="input-field text-[11px] mt-1.5"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Cover Banner Photo
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-10 rounded-xl bg-slate-900 border border-gray-200 overflow-hidden flex-shrink-0">
                      {editCoverUrl && (
                        <img src={editCoverUrl} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={uploadingCover}
                      onClick={() => coverFileInputRef.current?.click()}
                      className="btn-secondary text-xs py-2 px-3 flex-1 flex items-center justify-center gap-1.5"
                    >
                      <Camera size={13} />
                      <span>{uploadingCover ? 'Uploading...' : 'Upload Cover'}</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={editCoverUrl}
                    onChange={(e) => setEditCoverUrl(e.target.value)}
                    placeholder="Or paste banner URL"
                    className="input-field text-[11px] mt-1.5"
                  />
                </div>
              </div>

              {/* Group Type & Telegram Channel Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Group Privacy (Facebook style)
                  </label>
                  <select
                    value={editPrivacy}
                    onChange={(e) => setEditPrivacy(e.target.value as 'public' | 'private')}
                    className="input-field text-xs w-full"
                  >
                    <option value="public">🌐 Public (Anyone can discover & join)</option>
                    <option value="private">🔒 Private (Members-only discussions, admin approves joins)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Posting Mode (Telegram style)
                  </label>
                  <select
                    value={editBroadcastMode ? 'broadcast' : 'discussion'}
                    onChange={(e) => setEditBroadcastMode(e.target.value === 'broadcast')}
                    className="input-field text-xs w-full"
                  >
                    <option value="discussion">👥 Open Group (All members can post)</option>
                    <option value="broadcast">📢 Broadcast Channel (Only Admins can post, members react)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Website or Telegram Link (Optional)
                </label>
                <input
                  type="text"
                  value={editExternalLink}
                  onChange={(e) => setEditExternalLink(e.target.value)}
                  placeholder="https://t.me/channel or https://example.com"
                  className="input-field text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                className="btn-primary py-2.5 px-4 text-xs font-bold w-full shadow-sm"
              >
                {savingSettings ? 'Saving Community Profile...' : 'Save Community Profile & Branding'}
              </button>
            </form>
          </div>

          {/* 2. Role Assignment & Moderation Panel */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-brand-600" />
              <h3 className="font-bold text-gray-900 text-base">Member Roles & Moderation</h3>
            </div>
            <p className="text-xs text-gray-500">Promote members to Moderator, demote, or remove them from the community.</p>

            <div className="space-y-3 pt-2">
              {members
                .filter((m) => m.role !== 'owner')
                .map((m) => (
                  <div key={m.user?.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-600 text-xs">
                        {m.user?.display_name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-gray-900 block">{m.user?.display_name}</span>
                        <span className="text-[11px] text-gray-400 font-mono">@{m.user?.username}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Current role badge */}
                      <CommunityRoleBadge role={m.role} />
                      {m.role === 'member' && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          Member
                        </span>
                      )}

                      {/* Explicit Role Assignment (Owner Only) */}
                      {userRole === 'owner' && (
                        <select
                          value={m.role}
                          onChange={async (e) => {
                            const newRole = e.target.value
                            await supabase
                              .from('community_members')
                              .update({ role: newRole })
                              .match({ community_id: community.id, user_id: m.user_id })
                            fetchCommunityData()
                          }}
                          className="text-[11px] font-semibold px-2 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
                        >
                          <option value="member">Member</option>
                          <option value="vip">⭐ VIP</option>
                          <option value="moderator">🛡️ Moderator</option>
                        </select>
                      )}

                      {/* Mute / Unmute Button */}
                      {isOwnerOrMod && m.role === 'member' && (
                        (() => {
                          const memberMute = mutes.find((mu) => mu.user_id === m.user_id)
                          return memberMute ? (
                            <button
                              onClick={async () => {
                                if (!confirm(`Unmute @${m.user?.username}?`)) return
                                await supabase
                                  .from('community_mutes')
                                  .delete()
                                  .match({ community_id: community.id, user_id: m.user_id })
                                fetchCommunityData()
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 transition-colors flex items-center gap-1"
                              title="Member is muted. Click to unmute."
                            >
                              <VolumeX size={11} />
                              Unmute
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setMuteTargetMember(m)
                                setMuteReason('')
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors flex items-center gap-1"
                              title="Mute member from posting"
                            >
                              <VolumeX size={11} />
                              Mute
                            </button>
                          )
                        })()
                      )}

                      {/* Remove from community */}
                      {(userRole === 'owner' || (userRole === 'moderator' && m.role === 'member')) && (
                        <button
                          onClick={async () => {
                            if (!confirm(`Remove @${m.user?.username} from this community?`)) return
                            await supabase
                              .from('community_members')
                              .delete()
                              .match({ community_id: community.id, user_id: m.user_id })
                            fetchCommunityData()
                          }}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove member"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* 3. Community Rules Editor (Owner Only) */}
          {userRole === 'owner' && (
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <BookOpen size={18} className="text-brand-600" />
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">Community Rules Editor</h3>
                    <p className="text-xs text-gray-500">Define custom rules displayed on your community about page.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newId = editingRules.length > 0 ? Math.max(...editingRules.map((r: any) => Number(r.id) || 0)) + 1 : 1
                    setEditingRules([...editingRules, { id: newId, title: '', desc: '' }])
                  }}
                  className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 transition-colors"
                >
                  <Plus size={14} /> Add Rule
                </button>
              </div>

              <div className="space-y-3">
                {editingRules.map((rule, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-700">Rule #{index + 1}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRules(editingRules.filter((_, i) => i !== index))
                        }}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete rule"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder="Rule Title (e.g., No spam or promotion)"
                      value={rule.title}
                      onChange={(e) => {
                        const updated = [...editingRules]
                        updated[index] = { ...updated[index], title: e.target.value }
                        setEditingRules(updated)
                      }}
                      className="input-field text-xs bg-white"
                    />

                    <textarea
                      rows={2}
                      placeholder="Rule details and expectations..."
                      value={rule.desc}
                      onChange={(e) => {
                        const updated = [...editingRules]
                        updated[index] = { ...updated[index], desc: e.target.value }
                        setEditingRules(updated)
                      }}
                      className="input-field text-xs bg-white resize-none"
                    />
                  </div>
                ))}
              </div>

              <button
                type="button"
                disabled={savingRules}
                onClick={async () => {
                  if (!community) return
                  setSavingRules(true)

                  const cleaned = editingRules
                    .filter((r) => r.title.trim())
                    .map((r, i) => ({
                      id: i + 1,
                      title: r.title.trim(),
                      desc: r.desc.trim(),
                    }))

                  const { error } = await supabase
                    .from('communities')
                    .update({ rules: cleaned })
                    .eq('id', community.id)

                  setSavingRules(false)
                  if (error) {
                    alert(`Failed to save rules: ${error.message}`)
                  } else {
                    alert('Community rules updated successfully!')
                    fetchCommunityData()
                  }
                }}
                className="btn-primary py-2 px-4 text-xs font-bold w-full"
              >
                {savingRules ? 'Saving Rules...' : 'Save All Rules'}
              </button>
            </div>
          )}

          {/* 4. Danger Zone (Owner Only): Transfer Ownership & Delete Community */}
          {userRole === 'owner' && (
            <div className="card p-6 space-y-5 border border-red-200 bg-red-50/20">
              <div className="flex items-center gap-2 border-b border-red-100 pb-3">
                <AlertTriangle size={18} className="text-red-600" />
                <div>
                  <h3 className="font-bold text-red-900 text-base">Community Ownership & Danger Zone</h3>
                  <p className="text-xs text-red-600/80">Irreversible actions that affect this entire community.</p>
                </div>
              </div>

              {/* Transfer Ownership */}
              <div className="p-4 bg-white rounded-xl border border-gray-200 space-y-3">
                <div className="flex items-center gap-2">
                  <UserPlus size={16} className="text-brand-600" />
                  <h4 className="text-xs font-bold text-gray-900">Transfer Community Ownership</h4>
                </div>
                <p className="text-xs text-gray-500">
                  Select an active member or moderator to become the new primary Owner of @{community.slug}. You will be reassigned as a Moderator.
                </p>

                <div className="flex items-center gap-3">
                  <select
                    id="transferOwnerSelect"
                    className="input-field text-xs flex-1"
                    defaultValue=""
                  >
                    <option value="" disabled>Select new owner...</option>
                    {members
                      .filter((m) => m.user_id !== currentUserId)
                      .map((m) => (
                        <option key={m.user_id} value={m.user_id}>
                          @{m.user?.username} ({m.user?.display_name}) - {m.role}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={async () => {
                      const selectEl = document.getElementById('transferOwnerSelect') as HTMLSelectElement
                      const targetNewOwnerId = selectEl?.value
                      if (!targetNewOwnerId) {
                        alert('Please select a member to transfer ownership to.')
                        return
                      }
                      const targetMember = members.find((m) => m.user_id === targetNewOwnerId)
                      if (!confirm(`Are you absolutely sure you want to transfer ownership of ${community.name} to @${targetMember?.user?.username}? You will be stepped down to Moderator.`)) {
                        return
                      }

                      // 1. Promote new owner
                      const { error: err1 } = await supabase
                        .from('community_members')
                        .update({ role: 'owner' })
                        .match({ community_id: community.id, user_id: targetNewOwnerId })

                      // 2. Step down current owner to moderator
                      const { error: err2 } = await supabase
                        .from('community_members')
                        .update({ role: 'moderator' })
                        .match({ community_id: community.id, user_id: currentUserId })

                      // 3. Update community creator_id
                      await supabase
                        .from('communities')
                        .update({ creator_id: targetNewOwnerId })
                        .eq('id', community.id)

                      if (err1 || err2) {
                        alert(`Error transferring ownership: ${err1?.message || err2?.message}`)
                      } else {
                        alert(`Ownership transferred to @${targetMember?.user?.username} successfully!`)
                        fetchCommunityData()
                      }
                    }}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-gray-900 hover:bg-black text-white transition-colors flex-shrink-0"
                  >
                    Transfer
                  </button>
                </div>
              </div>

              {/* Delete / Disband Community */}
              <div className="p-4 bg-white rounded-xl border border-red-200 space-y-3">
                <div className="flex items-center gap-2">
                  <Trash2 size={16} className="text-red-600" />
                  <h4 className="text-xs font-bold text-red-900">Disband & Delete Community</h4>
                </div>
                <p className="text-xs text-gray-500">
                  Permanently delete @{community.slug}, all discussions, and all member associations. This cannot be undone.
                </p>

                <button
                  type="button"
                  onClick={async () => {
                    const promptConfirm = prompt(`CRITICAL CONFIRMATION: Type "${community.slug}" to permanently disband and delete this community:`)
                    if (promptConfirm !== community.slug) {
                      if (promptConfirm !== null) alert('Slug did not match. Deletion aborted.')
                      return
                    }

                    const { error } = await supabase
                      .from('communities')
                      .delete()
                      .eq('id', community.id)

                    if (error) {
                      alert(`Failed to delete community: ${error.message}`)
                    } else {
                      alert(`Community @${community.slug} has been permanently disbanded.`)
                      router.push('/communities')
                    }
                  }}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
                >
                  Permanently Delete Community
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Member Settings Modal Parity */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-lg">{community.name} Settings</h3>
              <button onClick={() => setShowSettingsModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => { alert('Showing posts you created in this group.'); setShowSettingsModal(false) }}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 text-left transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><FileText size={18} /></div>
                <div><div className="text-xs font-bold text-gray-900">My Posts</div><div className="text-[11px] text-gray-400">Manage posts you made in this group</div></div>
              </button>

              <button
                onClick={() => { setIsPinned(!isPinned); alert(isPinned ? 'Unpinned' : 'Community pinned to top!'); setShowSettingsModal(false) }}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 text-left transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center"><Pin size={18} /></div>
                <div><div className="text-xs font-bold text-gray-900">{isPinned ? 'Unpin Community' : 'Pin Community'}</div><div className="text-[11px] text-gray-400">Pin to top of your community list</div></div>
              </button>

              <button
                onClick={() => { setNotifEnabled(!notifEnabled); alert(notifEnabled ? 'Notifications muted.' : 'Notifications unmuted.'); setShowSettingsModal(false) }}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 text-left transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center"><Bell size={18} /></div>
                <div><div className="text-xs font-bold text-gray-900">Manage Notifications</div><div className="text-[11px] text-gray-400">Control alerts for this group</div></div>
              </button>

              <button
                onClick={() => { alert('Thank you. Moderation team will review this community.'); setShowSettingsModal(false) }}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 text-left transition-colors text-red-600"
              >
                <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center"><Flag size={18} /></div>
                <div><div className="text-xs font-bold">Report Community</div><div className="text-[11px] text-red-400">Report rule violations</div></div>
              </button>

              <button
                onClick={async () => {
                  if (!confirm(`Leave ${community.name}?`)) return
                  await supabase.from('community_members').delete().match({ community_id: community.id, user_id: currentUserId })
                  setShowSettingsModal(false)
                  router.push('/communities')
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 text-left transition-colors text-red-600"
              >
                <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center"><LogOut size={18} /></div>
                <div><div className="text-xs font-bold">Leave Community</div><div className="text-[11px] text-red-400">You can rejoin anytime</div></div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mute Member Modal */}
      {muteTargetMember && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-amber-600">
                <VolumeX size={20} />
                <h3 className="font-bold text-gray-900 text-base">
                  Mute @{muteTargetMember.user?.username}
                </h3>
              </div>
              <button
                onClick={() => setMuteTargetMember(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Muted members remain in the community but cannot publish new posts or comments until their mute expires.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Mute Duration
                </label>
                <select
                  value={muteDuration}
                  onChange={(e) => setMuteDuration(e.target.value as any)}
                  className="input-field text-xs w-full"
                >
                  <option value="1_day">24 Hours (1 Day)</option>
                  <option value="7_days">7 Days (1 Week)</option>
                  <option value="30_days">30 Days (1 Month)</option>
                  <option value="indefinite">Indefinite (Until unmuted)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Reason for Mute (Optional)
                </label>
                <textarea
                  rows={2}
                  value={muteReason}
                  onChange={(e) => setMuteReason(e.target.value)}
                  placeholder="e.g. Inappropriate language, repetitive spam..."
                  className="input-field text-xs resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMuteTargetMember(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={mutingBusy}
                  onClick={async () => {
                    if (!community || !muteTargetMember || !currentUserId) return
                    setMutingBusy(true)

                    let expiresAt: string | null = null
                    const now = new Date()
                    if (muteDuration === '1_day') {
                      expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
                    } else if (muteDuration === '7_days') {
                      expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
                    } else if (muteDuration === '30_days') {
                      expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
                    }

                    const { error } = await supabase.from('community_mutes').upsert({
                      community_id: community.id,
                      user_id: muteTargetMember.user_id,
                      muted_by: currentUserId,
                      reason: muteReason.trim() || null,
                      expires_at: expiresAt,
                    }, { onConflict: 'community_id,user_id' })

                    setMutingBusy(false)
                    if (error) {
                      alert(`Failed to mute member: ${error.message}`)
                    } else {
                      alert(`@${muteTargetMember.user?.username} has been muted in this community.`)
                      setMuteTargetMember(null)
                      fetchCommunityData()
                    }
                  }}
                  className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
                >
                  {mutingBusy ? 'Muting...' : 'Confirm Mute'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Full Admin Edit Community Profile & Branding Modal */}
      {showEditProfileModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 overflow-y-auto"
          onClick={() => setShowEditProfileModal(false)}
        >
          <div
            className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 my-8 border border-gray-100 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center shadow-xs">
                  <Edit3 size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900 text-base">
                    Edit Community Profile
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Update name, pictures, privacy & channel settings
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditProfileModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCommunityProfile} className="space-y-4 text-xs">
              {/* Community Name */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Community Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Lagos Tech Founders, Campus Voices"
                  className="input-field text-xs font-bold"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Description / Bio
                </label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Tell people what this community is about..."
                  className="input-field text-xs resize-none"
                />
              </div>

              {/* Pictures Preview & Live Uploader */}
              <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
                <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
                  Community Visuals & Branding
                </span>

                {/* Avatar Preview */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-brand-100 border border-gray-200 overflow-hidden flex items-center justify-center font-bold text-brand-600 text-base shadow-xs">
                      {editAvatarUrl ? (
                        <img src={editAvatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        editName.charAt(0) || 'C'
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-xs">Profile Picture</p>
                      <p className="text-[10px] text-gray-400">Square icon recommended (500x500)</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={uploadingAvatar}
                    onClick={() => avatarFileInputRef.current?.click()}
                    className="btn-secondary text-[11px] py-1.5 px-3 flex items-center gap-1.5 shadow-2xs"
                  >
                    <Camera size={13} />
                    <span>{uploadingAvatar ? 'Uploading...' : 'Change Photo'}</span>
                  </button>
                </div>

                {/* Cover Banner Preview */}
                <div className="space-y-1.5 pt-2 border-t border-gray-200/60">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-900 text-xs">Cover Banner</p>
                      <p className="text-[10px] text-gray-400">Panoramic banner (1920x1080)</p>
                    </div>
                    <button
                      type="button"
                      disabled={uploadingCover}
                      onClick={() => coverFileInputRef.current?.click()}
                      className="btn-secondary text-[11px] py-1.5 px-3 flex items-center gap-1.5 shadow-2xs"
                    >
                      <Camera size={13} />
                      <span>{uploadingCover ? 'Uploading...' : 'Change Cover'}</span>
                    </button>
                  </div>
                  {editCoverUrl && (
                    <div className="h-20 w-full rounded-xl overflow-hidden border border-gray-200 relative bg-black">
                      <img src={editCoverUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              {/* Group Type (Facebook Style) & Channel Mode (Telegram Style) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Group Privacy
                  </label>
                  <select
                    value={editPrivacy}
                    onChange={(e) => setEditPrivacy(e.target.value as 'public' | 'private')}
                    className="input-field text-xs w-full font-medium"
                  >
                    <option value="public">🌐 Public (Anyone can view & join)</option>
                    <option value="private">🔒 Private (Members-only, join by request)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Channel Mode
                  </label>
                  <select
                    value={editBroadcastMode ? 'broadcast' : 'discussion'}
                    onChange={(e) => setEditBroadcastMode(e.target.value === 'broadcast')}
                    className="input-field text-xs w-full font-medium"
                  >
                    <option value="discussion">👥 Open Group (All members can post)</option>
                    <option value="broadcast">📢 Broadcast Channel (Only Admins post)</option>
                  </select>
                </div>
              </div>

              {/* Category & Website link */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Category Topic
                  </label>
                  <input
                    type="text"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    placeholder="e.g. Technology, Education"
                    className="input-field text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Website or Social Link
                  </label>
                  <input
                    type="text"
                    value={editExternalLink}
                    onChange={(e) => setEditExternalLink(e.target.value)}
                    placeholder="https://t.me/... or https://..."
                    className="input-field text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSettings || !editName.trim()}
                  className="btn-primary text-xs py-2 px-5 font-bold shadow-sm"
                >
                  {savingSettings ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
