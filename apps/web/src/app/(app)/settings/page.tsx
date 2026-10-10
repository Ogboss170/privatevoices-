'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  User,
  AtSign,
  Mail,
  KeyRound,
  Trash2,
  Lock,
  MessageSquare,
  Users,
  Shield,
  Ban,
  Eye,
  EyeOff,
  Sliders,
  VolumeX,
  FileText,
  Smartphone,
  History,
  LogOut,
  Bell,
  SunMoon,
  Globe,
  Download,
  BookOpen,
  HelpCircle,
  Info,
  ChevronRight,
  Check,
  AlertTriangle,
  X,
  UserPlus,
  Bug,
  Send,
  Bookmark,
  Search,
  Laptop,
  Monitor,
  Compass,
  Star,
  Sparkles,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useWebTheme, LANGUAGE_OPTIONS } from '@/context/WebThemeContext'
import EditProfileModal from '@/components/profile/EditProfileModal'
import PostCard from '@/components/feed/PostCard'
import type { Post } from '@private-voices/shared'
import { extractPostMediaAndCleanContent } from '@private-voices/shared'

export default function SettingsPage(): React.JSX.Element {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const {
    themeMode,
    setThemeMode,
    language,
    setLanguage,
    t,
    reduceMotion,
    setReduceMotion,
    highContrast,
    setHighContrast,
    compactMode,
    setCompactMode,
  } = useWebTheme()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [privacy, setPrivacy] = useState<any>(null)

  // Blocked and Muted user modal states
  const [showBlockedModal, setShowBlockedModal] = useState(false)
  const [showMutedModal, setShowMutedModal] = useState(false)
  const [blockedUsers, setBlockedUsers] = useState<any[]>([])
  const [mutedUsers, setMutedUsers] = useState<any[]>([])
  const [loadingSafetyLists, setLoadingSafetyLists] = useState(false)

  // Report Bug Modal states
  const [showReportBugModal, setShowReportBugModal] = useState(false)
  const [bugCategory, setBugCategory] = useState('ui_glitch')
  const [bugDescription, setBugDescription] = useState('')
  const [submittingBug, setSubmittingBug] = useState(false)
  const [bugSubmitted, setBugSubmitted] = useState(false)

  // Switch / option states
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system')
  const [appLock, setAppLock] = useState(false)
  const [pushNotifs, setPushNotifs] = useState(true)
  const [followerNotifs, setFollowerNotifs] = useState(true)
  const [whisperNotifs, setWhisperNotifs] = useState(true)
  const [messageNotifs, setMessageNotifs] = useState(true)
  const [commentsNotifs, setCommentsNotifs] = useState(true)
  const [likeCommentNotifs, setLikeCommentNotifs] = useState(true)
  const [mentionNotifs, setMentionNotifs] = useState(true)
  const [communityNotifs, setCommunityNotifs] = useState(true)
  const [storyNotifs, setStoryNotifs] = useState(true)

  // Delete Account Confirmation Modal states
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0)
  const [deleteInputText, setDeleteInputText] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Logout All Confirmation Modal state
  const [showLogoutAllConfirm, setShowLogoutAllConfirm] = useState(false)
  const [loggingOutAll, setLoggingOutAll] = useState(false)

  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Search & Navigation state
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  // Active Sessions & Device Manager state
  const [showSessionsModal, setShowSessionsModal] = useState(false)
  const [signingOutOthers, setSigningOutOthers] = useState(false)
  const [signOutOthersSuccess, setSignOutOthersSuccess] = useState(false)
  const [currentSessionInfo, setCurrentSessionInfo] = useState<{
    browser: string
    os: string
    deviceType: string
    lastActive: string
  } | null>(null)

  // Edit Profile Modal state
  const [showEditProfileModal, setShowEditProfileModal] = useState(false)

  // Change Username Modal state
  const [showChangeUsernameModal, setShowChangeUsernameModal] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [updatingUsername, setUpdatingUsername] = useState(false)
  const [changeUsernameError, setChangeUsernameError] = useState<string | null>(null)
  const [changeUsernameSuccess, setChangeUsernameSuccess] = useState(false)
  const [usernameCooldown, setUsernameCooldown] = useState<{
    can_change: boolean
    days_remaining: number
    eligible_at: string | null
    username_changed_at: string | null
  } | null>(null)

  // Change Email Modal state
  const [showChangeEmailModal, setShowChangeEmailModal] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [updatingEmail, setUpdatingEmail] = useState(false)
  const [changeEmailError, setChangeEmailError] = useState<string | null>(null)
  const [changeEmailSuccess, setChangeEmailSuccess] = useState(false)

  // Change Password Modal state
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false)
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null)
  const [changePasswordSuccess, setChangePasswordSuccess] = useState(false)

  // Saved Posts (Bookmarks) state
  const [showSavedPostsModal, setShowSavedPostsModal] = useState(false)
  const [savedPosts, setSavedPosts] = useState<Post[]>([])
  const [loadingSaved, setLoadingSaved] = useState(false)

  const fetchSavedPosts = useCallback(async (uId: string) => {
    setLoadingSaved(true)
    try {
      const { data: savedRows } = await supabase
        .from('saved_posts')
        .select('post_id, created_at')
        .eq('user_id', uId)
        .order('created_at', { ascending: false })

      if (savedRows && savedRows.length > 0) {
        const savedPostIds = savedRows.map((r) => r.post_id)
        let { data: rawSavedPosts } = await supabase
          .from('posts')
          .select('*, author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url)')
          .in('id', savedPostIds)

        if (!rawSavedPosts) {
          const fallbackRes = await supabase.from('posts').select('*').in('id', savedPostIds)
          rawSavedPosts = fallbackRes.data
        }

        if (rawSavedPosts) {
          const authorIds = Array.from(new Set(rawSavedPosts.map((p) => p.author_id)))
          const { data: profList } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url')
            .in('id', authorIds)
          const profileMap = new Map((profList ?? []).map((p) => [p.id, p]))

          const postMap = new Map(rawSavedPosts.map((p) => [p.id, p]))
          const orderedSaved = savedPostIds.map((id) => postMap.get(id)).filter(Boolean) as any[]

          const formattedSaved: Post[] = await Promise.all(
            orderedSaved.map(async (p) => {
              let likeCount = 0
              let commentCount = 0
              let isLiked = false
              try {
                const [{ count: lCount }, { count: cCount }, { data: myLike }] = await Promise.all([
                  supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
                  supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
                  supabase.from('likes').select('user_id').match({ user_id: uId, post_id: p.id }).maybeSingle(),
                ])
                likeCount = lCount ?? 0
                commentCount = cCount ?? 0
                isLiked = !!myLike
              } catch {
                // ignore
              }

              const authorObj = p.author || profileMap.get(p.author_id)
              const { content: cleanContent, imageUrls } = extractPostMediaAndCleanContent(p.content, p.image_urls)
              return {
                id: p.id,
                authorId: p.author_id,
                author: {
                  id: authorObj?.id || p.author_id,
                  username: authorObj?.username || 'user',
                  displayName: authorObj?.display_name || 'User',
                  avatarUrl: authorObj?.avatar_url || null,
                },
                content: cleanContent,
                imageUrls,
                hashtags: [],
                likeCount,
                commentCount,
                repostCount: 0,
                isLikedByMe: isLiked,
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
    } catch {
      // ignore
    } finally {
      setLoadingSaved(false)
    }
  }, [supabase])

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    const { data: userRes } = await supabase.auth.getUser()
    if (!userRes.user) {
      router.push('/login')
      return
    }

    setUserId(userRes.user.id)
    setUserEmail(userRes.user.email ?? null)

    const [{ data: prof }, { data: priv }, { data: notifPrefs }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userRes.user.id).single(),
      supabase.from('privacy_settings').select('*').eq('user_id', userRes.user.id).maybeSingle(),
      supabase.from('notification_preferences').select('*').eq('user_id', userRes.user.id).maybeSingle(),
    ])

    setProfile(prof)
    setPrivacy(priv || {
      whisper_visibility: 'anyone',
      who_can_message: 'anyone',
      show_in_recommendations: true,
      allow_profile_indexing: true,
    })

    if (notifPrefs) {
      setPushNotifs(notifPrefs.push_enabled ?? true)
      setCommentsNotifs(notifPrefs.comments_enabled ?? true)
      setMentionNotifs(notifPrefs.mentions_enabled ?? true)
      setMessageNotifs(notifPrefs.direct_messages_enabled ?? true)
      setWhisperNotifs(notifPrefs.whispers_enabled ?? true)
      setLikeCommentNotifs(notifPrefs.likes_enabled ?? true)
      setFollowerNotifs(notifPrefs.followers_enabled ?? true)
      setCommunityNotifs(notifPrefs.community_announcements_enabled ?? true)
    }

    try {
      const { data: cdData } = await supabase.rpc('get_username_cooldown_status', {
        p_user_id: userRes.user.id,
      })
      if (cdData) {
        setUsernameCooldown(cdData)
      }
    } catch {
      // ignore
    }

    setLoading(false)
    fetchSavedPosts(userRes.user.id)
  }, [supabase, router, fetchSavedPosts])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  async function handleUpdateProfile(updates: Partial<any>) {
    if (!userId) return
    setSaving(true)
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId)
    if (!error) {
      setProfile((prev: any) => ({ ...prev, ...updates }))
      showSavedBadge()
    }
    setSaving(false)
  }

  async function handleUpdatePrivacy(key: string, value: any) {
    if (!userId) return
    setSaving(true)

    const { data: existing } = await supabase
      .from('privacy_settings')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    let error
    if (existing) {
      const res = await supabase.from('privacy_settings').update({ [key]: value }).eq('user_id', userId)
      error = res.error
    } else {
      const res = await supabase.from('privacy_settings').insert({ user_id: userId, [key]: value })
      error = res.error
    }

    if (!error) {
      setPrivacy((prev: any) => ({ ...prev, [key]: value }))
      showSavedBadge()
    }
    setSaving(false)
  }

  async function handleUpdateNotifPref(key: string, value: boolean) {
    if (!userId) return
    setSaving(true)

    const { error } = await supabase
      .from('notification_preferences')
      .upsert(
        { user_id: userId, [key]: value, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )

    if (!error) {
      showSavedBadge()
    }
    setSaving(false)
  }

  function showSavedBadge() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function fetchBlockedUsers() {
    if (!userId) return
    setLoadingSafetyLists(true)
    const { data } = await supabase
      .from('user_blocks')
      .select('blocked_id, profile:profiles!user_blocks_blocked_id_fkey(id, username, display_name, avatar_url)')
      .eq('blocker_id', userId)
    setBlockedUsers(data || [])
    setLoadingSafetyLists(false)
  }

  async function fetchMutedUsers() {
    if (!userId) return
    setLoadingSafetyLists(true)
    const { data } = await supabase
      .from('user_mutes')
      .select('muted_id, profile:profiles!user_mutes_muted_id_fkey(id, username, display_name, avatar_url)')
      .eq('muter_id', userId)
    setMutedUsers(data || [])
    setLoadingSafetyLists(false)
  }

  async function handleUnblock(blockedId: string) {
    if (!userId) return
    await supabase.from('user_blocks').delete().eq('blocker_id', userId).eq('blocked_id', blockedId)
    setBlockedUsers((prev) => prev.filter((item) => item.blocked_id !== blockedId))
  }

  async function handleUnmute(mutedId: string) {
    if (!userId) return
    await supabase.from('user_mutes').delete().eq('muter_id', userId).eq('muted_id', mutedId)
    setMutedUsers((prev) => prev.filter((item) => item.muted_id !== mutedId))
  }

  const detectSessionInfo = useCallback(() => {
    if (typeof window === 'undefined') return
    const ua = window.navigator.userAgent
    let browser = 'Modern Browser'
    if (ua.includes('Edg/')) browser = 'Microsoft Edge'
    else if (ua.includes('Chrome/')) browser = 'Google Chrome'
    else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Apple Safari'
    else if (ua.includes('Firefox/')) browser = 'Mozilla Firefox'
    else if (ua.includes('OPR/') || ua.includes('Opera/')) browser = 'Opera'

    let os = 'Unknown OS'
    if (ua.includes('Windows')) os = 'Windows PC'
    else if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS'
    else if (ua.includes('Linux')) os = 'Linux'
    else if (ua.includes('Android')) os = 'Android Device'
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS Device'

    let deviceType = 'Desktop'
    if (/Mobile|Android|iPhone|iPod/i.test(ua)) deviceType = 'Mobile Device'
    else if (/iPad|Tablet/i.test(ua)) deviceType = 'Tablet'

    setCurrentSessionInfo({
      browser,
      os,
      deviceType,
      lastActive: 'Active now (Current device)',
    })
  }, [])

  useEffect(() => {
    detectSessionInfo()
  }, [detectSessionInfo])

  async function handleSignOutOtherDevices() {
    setSigningOutOthers(true)
    try {
      await supabase.auth.signOut({ scope: 'others' })
      setSignOutOthersSuccess(true)
      setTimeout(() => setSignOutOthersSuccess(false), 3000)
    } catch {
      // ignore
    } finally {
      setSigningOutOthers(false)
    }
  }

  async function handleLogoutAllDevices() {
    setLoggingOutAll(true)
    await supabase.auth.signOut({ scope: 'global' })
    setLoggingOutAll(false)
    setShowLogoutAllConfirm(false)
    router.push('/login')
  }

  async function handleReportBugSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!bugDescription.trim() || !userId) return

    setSubmittingBug(true)
    const { error } = await supabase.from('content_reports').insert({
      reporter_id: userId,
      target_type: 'bug_report',
      target_id: userId,
      reason: `Bug Report: ${bugCategory}`,
      details: bugDescription.trim(),
    })

    setSubmittingBug(false)
    if (!error) {
      setBugSubmitted(true)
      setTimeout(() => {
        setBugSubmitted(false)
        setShowReportBugModal(false)
        setBugDescription('')
      }, 2000)
    } else {
      alert(`Failed to submit report: ${error.message}`)
    }
  }

  async function handleDeleteAccount() {
    if (!userId) return
    setDeleting(true)
    await supabase.from('profiles').delete().eq('id', userId)
    await supabase.auth.signOut()
    setDeleting(false)
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="card p-12 text-center text-gray-400 max-w-2xl mx-auto">
        <p className="text-sm">Loading settings...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-16">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            href="/profile"
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
            title="Back to Profile"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t.settings}</h1>
        </div>

        {saved && (
          <span className="flex items-center space-x-1 text-xs text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <Check size={14} />
            <span>{t.saved}</span>
          </span>
        )}
      </div>

      {/* ── SEARCH BAR (Instagram / iOS Style) ── */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
          <Search size={18} />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search settings (e.g., password, notifications, theme, privacy)..."
          className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 shadow-xs transition-all"
        />
        {searchQuery.length > 0 && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* ── CATEGORY HUB TILES ── */}
      {!searchQuery && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { id: 'section-account', label: 'Account', icon: User, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/40' },
            { id: 'section-privacy', label: 'Privacy', icon: Lock, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' },
            { id: 'section-notifications', label: 'Alerts', icon: Bell, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40' },
            { id: 'section-appearance', label: 'Theme', icon: SunMoon, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/40' },
            { id: 'section-security', label: 'Security', icon: Shield, color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/40' },
          ].map((hub) => {
            const Icon = hub.icon
            return (
              <button
                key={hub.id}
                type="button"
                onClick={() => {
                  const elem = document.getElementById(hub.id)
                  if (elem) {
                    elem.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                }}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 hover:border-brand-500/50 hover:shadow-sm transition-all group cursor-pointer"
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-1.5 transition-transform group-hover:scale-110 ${hub.color}`}>
                  <Icon size={16} />
                </div>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                  {hub.label}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── 1. ACCOUNT ── */}
      <section id="section-account" className="card p-6 space-y-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">
          {t.account}
        </h2>
        <div className="space-y-1 text-sm">
          <div
            onClick={() => setShowEditProfileModal(true)}
            className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
          >
            <div className="flex items-center space-x-3">
              <User size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Edit Profile</span>
                <span className="text-xs text-gray-400">Display name, bio, avatar</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>

          <div
            onClick={() => {
              setNewUsername(profile?.username || '')
              setChangeUsernameError(null)
              setChangeUsernameSuccess(false)
              setShowChangeUsernameModal(true)
            }}
            className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
          >
            <div className="flex items-center space-x-3">
              <AtSign size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Change Username</span>
                <span className="text-xs text-gray-400">@{profile?.username || 'username'}</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>

          <div
            onClick={() => {
              setNewEmail(userEmail || '')
              setChangeEmailError(null)
              setChangeEmailSuccess(false)
              setShowChangeEmailModal(true)
            }}
            className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
          >
            <div className="flex items-center space-x-3">
              <Mail size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Change Email</span>
                <span className="text-xs text-gray-400">{userEmail || 'Update account email address'}</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>

          <div
            onClick={() => {
              setShowChangePasswordModal(true)
              setChangePasswordError(null)
              setChangePasswordSuccess(false)
              setNewPassword('')
              setConfirmNewPassword('')
            }}
            className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
          >
            <div className="flex items-center space-x-3">
              <KeyRound size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Change Password</span>
                <span className="text-xs text-gray-400">Update security password</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>
        </div>
      </section>

      {/* ── 2. PRIVACY ── */}
      <section id="section-privacy" className="card p-6 space-y-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">
          {t.privacy}
        </h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between p-2">
            <div className="flex items-center space-x-3">
              <MessageSquare size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 dark:text-gray-100 block">{t.anonymousWhispers}</span>
                <span className="text-xs text-gray-400">Who can send you Whispers</span>
              </div>
            </div>
            <select
              value={privacy?.whisper_visibility || 'anyone'}
              onChange={(e) => handleUpdatePrivacy('whisper_visibility', e.target.value)}
              className="input-field w-auto py-1 px-2 text-xs"
            >
              <option value="anyone">Everyone</option>
              <option value="followers">Followers only</option>
              <option value="nobody">Nobody</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-2">
            <div className="flex items-center space-x-3">
              <Users size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Who can follow me</span>
                <span className="text-xs text-gray-400">Control who can follow your profile</span>
              </div>
            </div>
            <select className="input-field w-auto py-1 px-2 text-xs" defaultValue="everyone">
              <option value="everyone">Everyone</option>
              <option value="approval">Requires Approval</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-2">
            <div className="flex items-center space-x-3">
              <Shield size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Who can message me</span>
                <span className="text-xs text-gray-400">Direct chat permissions</span>
              </div>
            </div>
            <select
              value={privacy?.who_can_message || 'anyone'}
              onChange={(e) => handleUpdatePrivacy('who_can_message', e.target.value)}
              className="input-field w-auto py-1 px-2 text-xs"
            >
              <option value="anyone">Everyone</option>
              <option value="followers">Followers only</option>
              <option value="nobody">Nobody</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-2">
            <div className="flex items-center space-x-3">
              <Lock size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Private Account</span>
                <span className="text-xs text-gray-400">Only approved followers can see posts</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={profile?.is_private || false}
              onChange={(e) => handleUpdateProfile({ is_private: e.target.checked })}
              className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 cursor-pointer"
            />
          </div>

          <div
            onClick={() => {
              setShowBlockedModal(true)
              fetchBlockedUsers()
            }}
            className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
          >
            <div className="flex items-center space-x-3">
              <Ban size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Blocked Accounts</span>
                <span className="text-xs text-gray-400">Manage blocked users</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>
        </div>
      </section>

      {/* ── 2.5 SOCIAL ── */}
      <section className="card p-6 space-y-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">
          Social
        </h2>
        <div className="space-y-1 text-sm">
          <div
            onClick={() => {
              if (userId) fetchSavedPosts(userId)
              setShowSavedPostsModal(true)
            }}
            className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
          >
            <div className="flex items-center space-x-3">
              <Bookmark size={18} className="text-brand-600" />
              <div>
                <span className="font-semibold text-gray-800 block">Saved</span>
                <span className="text-xs text-gray-400">Voices and posts you bookmarked ({savedPosts.length})</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>

          <Link
            href="/communities"
            className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
          >
            <div className="flex items-center space-x-3">
              <Users size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Communities</span>
                <span className="text-xs text-gray-400">Discover, join, create, and manage communities</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </Link>

          <Link
            href="/invite"
            className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
          >
            <div className="flex items-center space-x-3">
              <UserPlus size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Invite Friends</span>
                <span className="text-xs text-gray-400">Share your invite code with friends</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </Link>
        </div>
      </section>

      {/* ── 3. CONTENT & SAFETY ── */}
      <section className="card p-6 space-y-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">
          Content & Safety
        </h2>
        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
            <div className="flex items-center space-x-3">
              <Eye size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Sensitive Content</span>
                <span className="text-xs text-gray-400">Filter or blur sensitive material</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>

          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
            <div className="flex items-center space-x-3">
              <Sliders size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Content Preferences</span>
                <span className="text-xs text-gray-400">Topics & recommendations</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>

          <div
            onClick={() => {
              setShowMutedModal(true)
              fetchMutedUsers()
            }}
            className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
          >
            <div className="flex items-center space-x-3">
              <VolumeX size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Muted Accounts</span>
                <span className="text-xs text-gray-400">Accounts hidden from your feed</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>

          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
            <div className="flex items-center space-x-3">
              <FileText size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Reports & Appeals</span>
                <span className="text-xs text-gray-400">View status of reported content</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>
        </div>
      </section>

      {/* ── 4. SECURITY ── */}
      <section id="section-security" className="card p-6 space-y-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">
          Security
        </h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between p-2">
            <div className="flex items-center space-x-3">
              <Smartphone size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">App Lock / Face ID / Fingerprint</span>
                <span className="text-xs text-gray-400">Require biometric unlock on launch</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={appLock}
              onChange={(e) => setAppLock(e.target.checked)}
              className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 cursor-pointer"
            />
          </div>

          <div
            onClick={() => setShowSessionsModal(true)}
            className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-slate-850 rounded-lg cursor-pointer transition-colors"
          >
            <div className="flex items-center space-x-3">
              <History size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 dark:text-gray-100 block">Login Sessions & Devices</span>
                <span className="text-xs text-gray-400">View active devices & manage logins</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>
        </div>
      </section>

      {/* ── 5. NOTIFICATIONS ── */}
      <section id="section-notifications" className="card p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-2">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Notifications & Alerts
          </h2>
          <span className="text-[11px] font-medium text-brand-600 bg-brand-50 dark:bg-brand-950/40 px-2 py-0.5 rounded-full">
            Granular Controls
          </span>
        </div>

        {/* Master Switch */}
        <div className="p-3.5 rounded-2xl bg-brand-50/50 dark:bg-brand-950/20 border border-brand-200/60 dark:border-brand-900/40 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-brand-500 text-white flex items-center justify-center">
              <Bell size={16} />
            </div>
            <div>
              <span className="font-bold text-sm text-gray-900 dark:text-gray-100 block">Allow Push Notifications</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Master switch for all device push alerts</span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={pushNotifs}
            onChange={(e) => {
              setPushNotifs(e.target.checked)
              handleUpdateNotifPref('push_enabled', e.target.checked)
            }}
            className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 cursor-pointer"
          />
        </div>

        <div className={`space-y-4 text-sm transition-opacity ${!pushNotifs ? 'opacity-50 pointer-events-none' : ''}`}>
          {/* Sub-group 1: Activity & Interactions */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block px-1">
              Activity & Interactions
            </span>

            <div className="bg-gray-50/60 dark:bg-slate-850/60 rounded-2xl p-2 space-y-1">
              <div className="flex items-center justify-between p-2 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-colors">
                <div>
                  <span className="text-gray-800 dark:text-gray-200 font-medium block">Comments & Replies</span>
                  <span className="text-xs text-gray-400 block">When someone comments on your Voices</span>
                </div>
                <input
                  type="checkbox"
                  checked={commentsNotifs}
                  onChange={(e) => {
                    setCommentsNotifs(e.target.checked)
                    handleUpdateNotifPref('comments_enabled', e.target.checked)
                  }}
                  className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-colors">
                <div>
                  <span className="text-gray-800 dark:text-gray-200 font-medium block">Mentions (@you)</span>
                  <span className="text-xs text-gray-400 block">When someone tags you in a post or comment</span>
                </div>
                <input
                  type="checkbox"
                  checked={mentionNotifs}
                  onChange={(e) => {
                    setMentionNotifs(e.target.checked)
                    handleUpdateNotifPref('mentions_enabled', e.target.checked)
                  }}
                  className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-colors">
                <div>
                  <span className="text-gray-800 dark:text-gray-200 font-medium block">Likes & Reactions</span>
                  <span className="text-xs text-gray-400 block">When someone likes your posts or comments</span>
                </div>
                <input
                  type="checkbox"
                  checked={likeCommentNotifs}
                  onChange={(e) => {
                    setLikeCommentNotifs(e.target.checked)
                    handleUpdateNotifPref('likes_enabled', e.target.checked)
                  }}
                  className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Sub-group 2: Direct & Social */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block px-1">
              Direct & Social
            </span>

            <div className="bg-gray-50/60 dark:bg-slate-850/60 rounded-2xl p-2 space-y-1">
              <div className="flex items-center justify-between p-2 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-colors">
                <div>
                  <span className="text-gray-800 dark:text-gray-200 font-medium block">Direct Messages</span>
                  <span className="text-xs text-gray-400 block">Incoming private 1-on-1 chats</span>
                </div>
                <input
                  type="checkbox"
                  checked={messageNotifs}
                  onChange={(e) => {
                    setMessageNotifs(e.target.checked)
                    handleUpdateNotifPref('direct_messages_enabled', e.target.checked)
                  }}
                  className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-colors">
                <div>
                  <span className="text-gray-800 dark:text-gray-200 font-medium block">Anonymous Whispers</span>
                  <span className="text-xs text-gray-400 block">Incoming secret or anonymous whispers</span>
                </div>
                <input
                  type="checkbox"
                  checked={whisperNotifs}
                  onChange={(e) => {
                    setWhisperNotifs(e.target.checked)
                    handleUpdateNotifPref('whispers_enabled', e.target.checked)
                  }}
                  className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-colors">
                <div>
                  <span className="text-gray-800 dark:text-gray-200 font-medium block">New Followers</span>
                  <span className="text-xs text-gray-400 block">When another user begins following you</span>
                </div>
                <input
                  type="checkbox"
                  checked={followerNotifs}
                  onChange={(e) => {
                    setFollowerNotifs(e.target.checked)
                    handleUpdateNotifPref('followers_enabled', e.target.checked)
                  }}
                  className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Sub-group 3: Community */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block px-1">
              Communities
            </span>

            <div className="bg-gray-50/60 dark:bg-slate-850/60 rounded-2xl p-2 space-y-1">
              <div className="flex items-center justify-between p-2 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-colors">
                <div>
                  <span className="text-gray-800 dark:text-gray-200 font-medium block">Community Announcements</span>
                  <span className="text-xs text-gray-400 block">Important broadcasts & updates from joined communities</span>
                </div>
                <input
                  type="checkbox"
                  checked={communityNotifs}
                  onChange={(e) => {
                    setCommunityNotifs(e.target.checked)
                    handleUpdateNotifPref('community_announcements_enabled', e.target.checked)
                  }}
                  className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. APPEARANCE ── */}
      <section id="section-appearance" className="card p-6 space-y-4">
        <h2 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-slate-800 pb-2">
          {t.appearance}
        </h2>
        <div className="space-y-4 text-sm">
          {/* Premium Theme Selector Cards */}
          <div className="space-y-3 pb-2">
            <div>
              <span className="font-semibold text-gray-900 dark:text-gray-100 block">{t.theme}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{t.themeDesc}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* 1. Light Theme Card */}
              <button
                type="button"
                onClick={() => setThemeMode('light')}
                className={`relative flex flex-col p-3 rounded-2xl border text-left transition-all group ${
                  themeMode === 'light'
                    ? 'border-brand-600 bg-brand-50/20 dark:bg-brand-950/20 ring-2 ring-brand-500/30'
                    : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-gray-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Visual Preview */}
                <div className="w-full h-20 rounded-xl bg-[#fafafa] border border-gray-200 p-2 flex flex-col justify-between overflow-hidden shadow-xs mb-3">
                  <div className="flex items-center justify-between border-b border-gray-200/80 pb-1.5">
                    <div className="w-8 h-2 rounded-full bg-gray-300" />
                    <div className="w-3 h-3 rounded-full bg-brand-600" />
                  </div>
                  <div className="space-y-1">
                    <div className="w-full h-2 rounded bg-gray-200" />
                    <div className="w-3/4 h-2 rounded bg-gray-200" />
                  </div>
                  <div className="w-12 h-3 rounded-md bg-brand-600/20" />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100 block">{t.themeLight}</span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">{t.themeLightDesc}</span>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                      themeMode === 'light'
                        ? 'border-brand-600 bg-brand-600'
                        : 'border-gray-300 dark:border-slate-600'
                    }`}
                  >
                    {themeMode === 'light' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>
              </button>

              {/* 2. Dark Theme Card */}
              <button
                type="button"
                onClick={() => setThemeMode('dark')}
                className={`relative flex flex-col p-3 rounded-2xl border text-left transition-all group ${
                  themeMode === 'dark'
                    ? 'border-brand-600 bg-brand-50/20 dark:bg-brand-950/20 ring-2 ring-brand-500/30'
                    : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-gray-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Visual Preview */}
                <div className="w-full h-20 rounded-xl bg-[#121212] border border-[#262626] p-2 flex flex-col justify-between overflow-hidden shadow-xs mb-3">
                  <div className="flex items-center justify-between border-b border-[#262626] pb-1.5">
                    <div className="w-8 h-2 rounded-full bg-neutral-700" />
                    <div className="w-3 h-3 rounded-full bg-brand-500" />
                  </div>
                  <div className="space-y-1">
                    <div className="w-full h-2 rounded bg-neutral-800" />
                    <div className="w-3/4 h-2 rounded bg-neutral-800" />
                  </div>
                  <div className="w-12 h-3 rounded-md bg-brand-500/20" />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100 block">{t.themeDark}</span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">{t.themeDarkDesc}</span>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                      themeMode === 'dark'
                        ? 'border-brand-600 bg-brand-600'
                        : 'border-gray-300 dark:border-slate-600'
                    }`}
                  >
                    {themeMode === 'dark' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>
              </button>

              {/* 3. System Theme Card */}
              <button
                type="button"
                onClick={() => setThemeMode('system')}
                className={`relative flex flex-col p-3 rounded-2xl border text-left transition-all group ${
                  themeMode === 'system'
                    ? 'border-brand-600 bg-brand-50/20 dark:bg-brand-950/20 ring-2 ring-brand-500/30'
                    : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-gray-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Split Visual Preview */}
                <div className="w-full h-20 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-xs mb-3 flex">
                  {/* Left half Light */}
                  <div className="w-1/2 h-full bg-[#fafafa] p-2 flex flex-col justify-between border-r border-gray-200">
                    <div className="w-6 h-2 rounded-full bg-gray-300" />
                    <div className="w-full h-2 rounded bg-gray-200" />
                    <div className="w-8 h-2 rounded bg-brand-600/30" />
                  </div>
                  {/* Right half Dark */}
                  <div className="w-1/2 h-full bg-[#121212] p-2 flex flex-col justify-between">
                    <div className="w-6 h-2 rounded-full bg-neutral-700 ml-auto" />
                    <div className="w-full h-2 rounded bg-neutral-800" />
                    <div className="w-8 h-2 rounded bg-brand-500/30 ml-auto" />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100 block">{t.themeSystem}</span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">{t.themeSystemDesc}</span>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                      themeMode === 'system'
                        ? 'border-brand-600 bg-brand-600'
                        : 'border-gray-300 dark:border-slate-600'
                    }`}
                  >
                    {themeMode === 'system' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Language */}
          <div className="flex items-center justify-between p-2 border-t border-gray-50 dark:border-slate-800/60 pt-3">
            <div className="flex items-center space-x-3">
              <Globe size={18} className="text-gray-500 dark:text-gray-400" />
              <div>
                <span className="font-semibold text-gray-800 dark:text-gray-100 block">{t.language}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{t.languageDesc}</span>
              </div>
            </div>
            <select
              value={language}
              onChange={(e: any) => setLanguage(e.target.value)}
              className="input-field w-auto py-1 px-3 text-xs font-semibold cursor-pointer"
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.nativeName} ({opt.label})
                </option>
              ))}
            </select>
          </div>

          {/* Reduce Motion */}
          <div className="flex items-center justify-between p-2 border-t border-gray-50 dark:border-slate-800/60 pt-3">
            <div className="flex items-center space-x-3">
              <Sliders size={18} className="text-gray-500 dark:text-gray-400" />
              <div>
                <span className="font-semibold text-gray-800 dark:text-gray-100 block">{t.reduceMotion}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{t.reduceMotionDesc}</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={reduceMotion}
              onChange={(e) => setReduceMotion(e.target.checked)}
              className="w-4 h-4 text-brand-600 rounded border-gray-300 dark:border-slate-700 focus:ring-brand-500 cursor-pointer"
            />
          </div>

          {/* High Contrast */}
          <div className="flex items-center justify-between p-2 border-t border-gray-50 dark:border-slate-800/60 pt-3">
            <div className="flex items-center space-x-3">
              <Eye size={18} className="text-gray-500 dark:text-gray-400" />
              <div>
                <span className="font-semibold text-gray-800 dark:text-gray-100 block">{t.highContrast}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{t.highContrastDesc}</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={highContrast}
              onChange={(e) => setHighContrast(e.target.checked)}
              className="w-4 h-4 text-brand-600 rounded border-gray-300 dark:border-slate-700 focus:ring-brand-500 cursor-pointer"
            />
          </div>

          {/* Compact Mode */}
          <div className="flex items-center justify-between p-2 border-t border-gray-50 dark:border-slate-800/60 pt-3">
            <div className="flex items-center space-x-3">
              <Smartphone size={18} className="text-gray-500 dark:text-gray-400" />
              <div>
                <span className="font-semibold text-gray-800 dark:text-gray-100 block">{t.compactMode}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{t.compactModeDesc}</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={compactMode}
              onChange={(e) => setCompactMode(e.target.checked)}
              className="w-4 h-4 text-brand-600 rounded border-gray-300 dark:border-slate-700 focus:ring-brand-500 cursor-pointer"
            />
          </div>
        </div>
      </section>

      {/* ── 7. DATA & PRIVACY ── */}
      <section className="card p-6 space-y-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">
          Data & Privacy
        </h2>
        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
            <div className="flex items-center space-x-3">
              <Download size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Download My Data</span>
                <span className="text-xs text-gray-400">Request archive of your posts and whispers</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>

          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
            <div className="flex items-center space-x-3">
              <Shield size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Data & Privacy Information</span>
                <span className="text-xs text-gray-400">How your data is protected and encrypted</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>
        </div>
      </section>

      {/* ── 8. INVITE FRIENDS ── */}
      <section className="card p-6 space-y-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">
          Invite Friends
        </h2>
        <Link
          href="/invite"
          className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors text-sm"
        >
          <div className="flex items-center space-x-3">
            <UserPlus size={18} className="text-brand-600" />
            <div>
              <span className="font-semibold text-gray-800 block">Invite Friends</span>
              <span className="text-xs text-gray-400">Bring your friends to Private Voices</span>
            </div>
          </div>
          <ChevronRight size={16} className="text-gray-400" />
        </Link>
      </section>

      {/* ── 9. ABOUT ── */}
      <section className="card p-6 space-y-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">
          About
        </h2>
        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
            <div className="flex items-center space-x-3">
              <BookOpen size={18} className="text-gray-500" />
              <span className="font-semibold text-gray-800">Community Guidelines</span>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>

          <Link
            href="/terms"
            className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
          >
            <div className="flex items-center space-x-3">
              <FileText size={18} className="text-gray-500" />
              <span className="font-semibold text-gray-800">Terms & Conditions</span>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </Link>

          <Link
            href="/privacy"
            className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
          >
            <div className="flex items-center space-x-3">
              <Shield size={18} className="text-gray-500" />
              <span className="font-semibold text-gray-800">Privacy Policy</span>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </Link>

          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
            <div className="flex items-center space-x-3">
              <HelpCircle size={18} className="text-gray-500" />
              <span className="font-semibold text-gray-800">Help & Support</span>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>

          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
            <div className="flex items-center space-x-3">
              <Info size={18} className="text-gray-500" />
              <span className="font-semibold text-gray-800">About Private Voices</span>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>

          <Link
            href="/preview"
            className="flex items-center justify-between p-2 hover:bg-purple-50/60 dark:hover:bg-purple-950/30 rounded-lg cursor-pointer transition-colors text-purple-700 dark:text-purple-300 font-semibold"
          >
            <div className="flex items-center space-x-3">
              <Sparkles size={18} className="text-purple-600 dark:text-purple-400" />
              <div>
                <span className="block text-gray-900 dark:text-gray-100">App Preview</span>
                <span className="text-xs text-purple-600/80 dark:text-purple-400/80 font-normal">
                  Explore upcoming features and join testing program
                </span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </Link>

          <Link
            href="/rate"
            className="flex items-center justify-between p-2 hover:bg-amber-50/60 dark:hover:bg-amber-950/30 rounded-lg cursor-pointer transition-colors text-amber-700 dark:text-amber-300 font-semibold"
          >
            <div className="flex items-center space-x-3">
              <Star size={18} className="fill-amber-400 text-amber-500" />
              <div>
                <span className="block text-gray-900 dark:text-gray-100">Rate Private Voices</span>
                <span className="text-xs text-gray-400 font-normal">
                  Share your experience with 5-star rating and review
                </span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </Link>

          <div
            onClick={() => setShowReportBugModal(true)}
            className="flex items-center justify-between p-2 hover:bg-red-50/50 rounded-lg cursor-pointer transition-colors text-red-700 font-semibold"
          >
            <div className="flex items-center space-x-3">
              <Bug size={18} className="text-red-500" />
              <div>
                <span className="block text-gray-900">Report a Bug</span>
                <span className="text-xs text-gray-400 font-normal">Send feedback, glitch, or issue report</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>

          <div className="flex items-center justify-between p-2 pt-3 border-t border-gray-100 text-xs text-gray-400">
            <span>App Version</span>
            <span className="font-mono">v1.0.4 (Production)</span>
          </div>
        </div>
      </section>

      {/* ── 10. BOTTOM ACTIONS (SEPARATED AT ABSOLUTE BOTTOM) ── */}
      <section className="pt-6 border-t border-gray-200 space-y-3">
        {/* Log out of all devices (Immediately above Delete Account) */}
        <div
          onClick={() => setShowLogoutAllConfirm(true)}
          className="card p-4 flex items-center justify-between cursor-pointer hover:bg-amber-50 border-amber-200 transition-colors text-amber-800"
        >
          <div className="flex items-center space-x-3">
            <LogOut size={18} className="text-amber-600" />
            <div>
              <span className="font-bold text-sm block">Log out of all devices</span>
              <span className="text-xs text-amber-600">Invalidate all active sessions across all devices</span>
            </div>
          </div>
          <ChevronRight size={16} className="text-amber-500" />
        </div>

        {/* Delete Account (Absolute Last Item) */}
        <div
          onClick={() => setDeleteStep(1)}
          className="card p-4 flex items-center justify-between cursor-pointer hover:bg-red-50 border-red-200 transition-colors text-red-600"
        >
          <div className="flex items-center space-x-3">
            <Trash2 size={18} className="text-red-600" />
            <div>
              <span className="font-bold text-sm block">Delete Account</span>
              <span className="text-xs text-red-400">Permanently delete account and all data</span>
            </div>
          </div>
          <ChevronRight size={16} className="text-red-400" />
        </div>
      </section>

      {/* ── ACTIVE SESSIONS & DEVICE MANAGER MODAL ── */}
      {showSessionsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-gray-100 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-full bg-brand-50 dark:bg-brand-950/60 flex items-center justify-center text-brand-600">
                  <Laptop size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base">Active Devices & Sessions</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Manage where your account is signed in</p>
                </div>
              </div>
              <button
                onClick={() => setShowSessionsModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            {signOutOthersSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center space-x-2">
                <Check size={16} />
                <span>Successfully signed out of all other devices and sessions.</span>
              </div>
            )}

            <div className="space-y-3">
              {/* Current Device Session */}
              <div className="p-4 rounded-2xl bg-brand-50/40 dark:bg-brand-950/20 border border-brand-200/80 dark:border-brand-800/40 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-600">
                      <Monitor size={20} />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-gray-900 dark:text-gray-100">
                          {currentSessionInfo?.browser || 'Web Browser'}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                          This device
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {currentSessionInfo?.os || 'Desktop OS'} • {currentSessionInfo?.deviceType || 'Web Client'}
                      </p>
                    </div>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-900/30"></span>
                </div>
                <div className="text-[11px] text-gray-400 dark:text-gray-500 pl-13 pt-1">
                  Active now • Supabase Session JWT authenticated
                </div>
              </div>

              {/* Security info card */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 text-xs text-gray-600 dark:text-gray-400 space-y-2">
                <div className="flex items-center space-x-2 font-semibold text-gray-800 dark:text-gray-200">
                  <Shield size={15} className="text-brand-600" />
                  <span>Session Security</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  If you see an unfamiliar login or left your account logged in on a public computer, you can revoke access for all other sessions immediately.
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleSignOutOtherDevices}
                disabled={signingOutOthers}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800/50 transition-colors disabled:opacity-50"
              >
                {signingOutOthers ? 'Revoking sessions...' : 'Sign out other devices'}
              </button>

              <button
                type="button"
                onClick={() => setShowSessionsModal(false)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LOGOUT ALL DEVICES CONFIRMATION MODAL ── */}
      {showLogoutAllConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-amber-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center space-x-2 text-amber-600 font-bold text-lg">
                <LogOut size={22} />
                <span>Log out of all devices?</span>
              </div>
              <button onClick={() => setShowLogoutAllConfirm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-gray-600">
              This will invalidate all active login sessions on all your devices. You will need to log in again on every device.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowLogoutAllConfirm(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={loggingOutAll}
                onClick={handleLogoutAllDevices}
                className="px-4 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors disabled:opacity-50"
              >
                {loggingOutAll ? 'Logging out...' : 'Confirm Log Out All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE ACCOUNT MODAL DIALOGS ── */}
      {deleteStep > 0 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-red-100">
            {deleteStep === 1 && (
              <>
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center space-x-2 text-red-600 font-bold text-lg">
                    <AlertTriangle size={22} />
                    <span>Delete Account Confirmation</span>
                  </div>
                  <button onClick={() => setDeleteStep(0)} className="text-gray-400 hover:text-gray-600">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-3 text-sm text-gray-600">
                  <p className="font-semibold text-gray-900">Are you sure you want to delete your account?</p>
                  <p>Deleting your account will result in:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs text-red-700 bg-red-50 p-3 rounded-lg border border-red-100">
                    <li>Permanent removal of your profile (@{profile?.username})</li>
                    <li>Deletion of all published Voices, posts, and stories</li>
                    <li>Deletion of all direct chat messages and history</li>
                    <li>Deletion of received Anonymous Whispers</li>
                  </ul>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    onClick={() => setDeleteStep(0)}
                    className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setDeleteStep(2)}
                    className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors"
                  >
                    Proceed to Final Confirmation
                  </button>
                </div>
              </>
            )}

            {deleteStep === 2 && (
              <>
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center space-x-2 text-red-600 font-bold text-lg">
                    <Trash2 size={22} />
                    <span>Final Confirmation</span>
                  </div>
                  <button onClick={() => setDeleteStep(0)} className="text-gray-400 hover:text-gray-600">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-3 text-sm text-gray-600">
                  <p className="font-bold text-red-600">This action CANNOT be undone.</p>
                  <p className="text-xs text-gray-500">
                    To confirm permanent deletion, please type <span className="font-mono font-bold text-gray-900">DELETE</span> below:
                  </p>
                  <input
                    type="text"
                    value={deleteInputText}
                    onChange={(e) => setDeleteInputText(e.target.value)}
                    placeholder="Type DELETE"
                    className="input-field text-sm font-mono tracking-widest text-center"
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    onClick={() => setDeleteStep(0)}
                    className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={deleteInputText !== 'DELETE' || deleting}
                    onClick={handleDeleteAccount}
                    className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors"
                  >
                    {deleting ? 'Deleting...' : 'Permanently Delete My Account'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── REPORT BUGS MODAL ── */}
      {showReportBugModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center space-x-2 text-red-600 font-bold text-lg">
                <Bug size={22} />
                <span>Report a Bug</span>
              </div>
              <button
                onClick={() => setShowReportBugModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {bugSubmitted ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl">
                  <Check size={32} />
                </div>
                <h3 className="font-bold text-lg text-gray-900">Report Submitted!</h3>
                <p className="text-xs text-gray-500">
                  Thank you for helping us improve Private Voices. Our team has received your report.
                </p>
              </div>
            ) : (
              <form onSubmit={handleReportBugSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Issue Category</label>
                  <select
                    value={bugCategory}
                    onChange={(e) => setBugCategory(e.target.value)}
                    className="input-field text-xs py-2 w-full"
                  >
                    <option value="ui_glitch">Visual / UI Glitch</option>
                    <option value="feed_loading">Feed or Post Issue</option>
                    <option value="whisper_sharing">Anonymous Whisper Problem</option>
                    <option value="chat_messaging">Direct Messaging Issue</option>
                    <option value="notifications">Notification Glitch</option>
                    <option value="other">Other Technical Problem</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Description of Issue</label>
                  <textarea
                    rows={4}
                    required
                    value={bugDescription}
                    onChange={(e) => setBugDescription(e.target.value)}
                    placeholder="Describe what happened and how to reproduce it..."
                    className="input-field text-xs py-2.5 w-full resize-none"
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowReportBugModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingBug || !bugDescription.trim()}
                    className="btn-primary text-xs py-2 px-4 flex items-center space-x-1.5"
                  >
                    <Send size={14} />
                    <span>{submittingBug ? 'Sending...' : 'Send Bug Report'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── BLOCKED ACCOUNTS MODAL ── */}
      {showBlockedModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center space-x-2 text-gray-900 font-bold text-base">
                <Ban size={20} className="text-red-500" />
                <span>Blocked Accounts</span>
              </div>
              <button
                onClick={() => setShowBlockedModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {loadingSafetyLists ? (
              <div className="py-8 text-center text-xs text-gray-400">Loading blocked list...</div>
            ) : blockedUsers.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-500">
                You haven't blocked any accounts.
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2 divide-y divide-gray-50">
                {blockedUsers.map((item) => (
                  <div key={item.blocked_id} className="flex items-center justify-between pt-2">
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">
                        {item.profile?.display_name || 'User'}
                      </span>
                      <span className="text-[11px] text-purple-600 font-mono">
                        @{item.profile?.username || 'user'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleUnblock(item.blocked_id)}
                      className="px-3 py-1 bg-gray-100 hover:bg-red-50 hover:text-red-600 text-xs font-semibold text-gray-700 rounded-lg transition-colors"
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MUTED ACCOUNTS MODAL ── */}
      {showMutedModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center space-x-2 text-gray-900 font-bold text-base">
                <VolumeX size={20} className="text-amber-500" />
                <span>Muted Accounts</span>
              </div>
              <button
                onClick={() => setShowMutedModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {loadingSafetyLists ? (
              <div className="py-8 text-center text-xs text-gray-400">Loading muted list...</div>
            ) : mutedUsers.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-500">
                You haven't muted any accounts.
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2 divide-y divide-gray-50">
                {mutedUsers.map((item) => (
                  <div key={item.muted_id} className="flex items-center justify-between pt-2">
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">
                        {item.profile?.display_name || 'User'}
                      </span>
                      <span className="text-[11px] text-purple-600 font-mono">
                        @{item.profile?.username || 'user'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleUnmute(item.muted_id)}
                      className="px-3 py-1 bg-gray-100 hover:bg-amber-50 hover:text-amber-600 text-xs font-semibold text-gray-700 rounded-lg transition-colors"
                    >
                      Unmute
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CHANGE PASSWORD MODAL ── */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center space-x-2 text-gray-900 font-bold text-base">
                <KeyRound size={20} className="text-brand-600" />
                <span>Change Password</span>
              </div>
              <button
                onClick={() => setShowChangePasswordModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {changePasswordSuccess ? (
              <div className="text-center py-6 space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <Check size={24} />
                </div>
                <h4 className="font-bold text-sm text-gray-900">Password Changed</h4>
                <p className="text-xs text-gray-500">
                  Your password has been successfully updated.
                </p>
                <button
                  onClick={() => setShowChangePasswordModal(false)}
                  className="btn-primary text-xs py-2 px-5 mt-2"
                >
                  Done
                </button>
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  setChangePasswordError(null)

                  if (newPassword.length < 8) {
                    setChangePasswordError('Password must be at least 8 characters long.')
                    return
                  }

                  if (newPassword !== confirmNewPassword) {
                    setChangePasswordError('Passwords do not match.')
                    return
                  }

                  setUpdatingPassword(true)
                  const { error } = await supabase.auth.updateUser({
                    password: newPassword,
                  })
                  setUpdatingPassword(false)

                  if (error) {
                    setChangePasswordError(error.message)
                  } else {
                    setChangePasswordSuccess(true)
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="input-field text-xs pr-9"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNewPassword ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmNewPassword ? 'text' : 'password'}
                      required
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="input-field text-xs pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmNewPassword ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                  </div>
                </div>

                {changePasswordError && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
                    {changePasswordError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowChangePasswordModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingPassword || !newPassword || !confirmNewPassword}
                    className="btn-primary text-xs py-2 px-4 rounded-xl disabled:opacity-50"
                  >
                    {updatingPassword ? 'Updating…' : 'Update Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── EDIT PROFILE MODAL ── */}
      {showEditProfileModal && profile && (
        <EditProfileModal
          initialProfile={{
            displayName: profile.display_name,
            bio: profile.bio,
            isPrivate: profile.is_private,
            avatarUrl: profile.avatar_url,
          }}
          onClose={() => setShowEditProfileModal(false)}
          onUpdated={fetchSettings}
        />
      )}

      {/* ── CHANGE USERNAME MODAL ── */}
      {showChangeUsernameModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-gray-100">
            <div className="flex items-center space-x-2 text-brand-600">
              <AtSign size={22} />
              <h3 className="font-bold text-gray-900 text-base">Change Username</h3>
            </div>

            <p className="text-xs text-gray-500">
              Usernames must be unique and can contain letters, numbers, and underscores (min 3 chars). You can change your username only once every 60 days.
            </p>

            {usernameCooldown && !usernameCooldown.can_change && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-xs space-y-1">
                <div className="font-semibold flex items-center space-x-1">
                  <span>⏳ Cooldown Active</span>
                </div>
                <p>
                  You can change your username again on{' '}
                  <span className="font-bold">
                    {usernameCooldown.eligible_at
                      ? new Date(usernameCooldown.eligible_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : 'in 60 days'}
                  </span>{' '}
                  ({usernameCooldown.days_remaining} {usernameCooldown.days_remaining === 1 ? 'day' : 'days'} remaining).
                </p>
              </div>
            )}

            {changeUsernameSuccess ? (
              <div className="text-center py-4 space-y-3">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <Check size={24} />
                </div>
                <p className="text-sm font-semibold text-gray-900">Username Updated!</p>
                <p className="text-xs text-gray-500">Your profile handle is now @{newUsername}.</p>
                <button
                  type="button"
                  onClick={() => setShowChangeUsernameModal(false)}
                  className="btn-primary text-xs py-2 px-5 rounded-xl w-full"
                >
                  Done
                </button>
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  setChangeUsernameError(null)
                  const trimmed = newUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
                  if (trimmed.length < 3) {
                    setChangeUsernameError('Username must be at least 3 characters (letters, numbers, underscores).')
                    return
                  }
                  if (trimmed === profile?.username?.toLowerCase()) {
                    setShowChangeUsernameModal(false)
                    return
                  }

                  setUpdatingUsername(true)
                  const { data: result, error } = await supabase.rpc('change_username', {
                    p_user_id: userId,
                    p_new_username: trimmed,
                  })

                  setUpdatingUsername(false)
                  if (error) {
                    setChangeUsernameError(error.message)
                    return
                  }

                  if (!result?.success) {
                    if (result?.code === 'COOLDOWN_ACTIVE') {
                      const eligibleDate = result.eligible_at
                        ? new Date(result.eligible_at).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })
                        : 'in 60 days'
                      setChangeUsernameError(
                        `You can only change your username once every 60 days. You will be eligible again on ${eligibleDate} (${result.days_remaining} days remaining).`
                      )
                    } else if (result?.code === 'USERNAME_TAKEN' || result?.code === 'USERNAME_RESERVED') {
                      setChangeUsernameError('This username is unavailable or reserved. Please choose another.')
                    } else {
                      setChangeUsernameError(result?.message || 'Failed to update username.')
                    }
                    return
                  }

                  setProfile((prev: any) => ({ ...prev, username: trimmed }))
                  setUsernameCooldown({
                    can_change: false,
                    days_remaining: 60,
                    eligible_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
                    username_changed_at: new Date().toISOString(),
                  })
                  setChangeUsernameSuccess(true)
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    New Username
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">@</span>
                    <input
                      type="text"
                      required
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
                      placeholder="username"
                      disabled={Boolean(usernameCooldown && !usernameCooldown.can_change)}
                      className="input-field text-xs pl-7 disabled:opacity-60 disabled:cursor-not-allowed"
                      autoFocus
                      autoCapitalize="none"
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">Letters, numbers, and underscores only.</p>
                </div>

                {changeUsernameError && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
                    {changeUsernameError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowChangeUsernameModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={Boolean(updatingUsername || !newUsername.trim() || (usernameCooldown && !usernameCooldown.can_change))}
                    className="btn-primary text-xs py-2 px-4 rounded-xl disabled:opacity-50"
                  >
                    {updatingUsername ? 'Saving…' : 'Save Username'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── CHANGE EMAIL MODAL ── */}
      {showChangeEmailModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-gray-100">
            <div className="flex items-center space-x-2 text-brand-600">
              <Mail size={22} />
              <h3 className="font-bold text-gray-900 text-base">Change Email</h3>
            </div>

            {changeEmailSuccess ? (
              <div className="text-center py-4 space-y-3">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <Check size={24} />
                </div>
                <p className="text-sm font-semibold text-gray-900">Verification Link Sent</p>
                <p className="text-xs text-gray-500">
                  Please check your inbox at <span className="font-medium text-gray-800">{newEmail}</span> to confirm your new email.
                </p>
                <button
                  type="button"
                  onClick={() => setShowChangeEmailModal(false)}
                  className="btn-primary text-xs py-2 px-5 rounded-xl w-full"
                >
                  Done
                </button>
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  setChangeEmailError(null)
                  const trimmed = newEmail.trim()
                  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                  if (!emailRegex.test(trimmed)) {
                    setChangeEmailError('Please enter a valid email address.')
                    return
                  }

                  setUpdatingEmail(true)

                  // Pre-validate that new email is not in email_registry
                  try {
                    const { data: availRes } = await supabase.rpc('check_email_change_availability', {
                      p_user_id: userId,
                      p_new_email: trimmed,
                    })

                    if (availRes && !availRes.available) {
                      setUpdatingEmail(false)
                      setChangeEmailError(availRes.message || 'This email address is already reserved.')
                      return
                    }
                  } catch {
                    // ignore and proceed
                  }

                  const { error } = await supabase.auth.updateUser({
                    email: trimmed,
                  })
                  setUpdatingEmail(false)

                  if (error) {
                    setChangeEmailError(error.message)
                  } else {
                    setChangeEmailSuccess(true)
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    New Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="new.email@example.com"
                    className="input-field text-xs"
                    autoFocus
                  />
                  <p className="text-[11px] text-gray-400 mt-1">We will send a confirmation link to this address.</p>
                </div>

                {changeEmailError && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
                    {changeEmailError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowChangeEmailModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingEmail || !newEmail.trim()}
                    className="btn-primary text-xs py-2 px-4 rounded-xl disabled:opacity-50"
                  >
                    {updatingEmail ? 'Sending…' : 'Send Link'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── SAVED POSTS (BOOKMARKS) MODAL ── */}
      {showSavedPostsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-xl border border-gray-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center space-x-2 text-brand-600">
                <Bookmark size={22} />
                <h3 className="font-bold text-gray-900 text-base">Saved Voices</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSavedPostsModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {loadingSaved ? (
                <div className="py-12 text-center text-gray-400">
                  <p className="text-sm">Loading saved voices…</p>
                </div>
              ) : savedPosts.length === 0 ? (
                <div className="py-12 text-center text-gray-400 space-y-2 flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 mb-2">
                    <Bookmark size={22} />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">No saved Voices yet</p>
                  <p className="text-xs text-gray-500 max-w-sm">
                    Bookmark interesting voices by clicking the bookmark icon on any post to read them anytime.
                  </p>
                </div>
              ) : (
                savedPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={userId || undefined}
                    onDelete={(id) => setSavedPosts((prev) => prev.filter((p) => p.id !== id))}
                    onToggleSave={(id, isSaved) => {
                      if (!isSaved) {
                        setSavedPosts((prev) => prev.filter((p) => p.id !== id))
                      }
                    }}
                  />
                ))
              )}
            </div>

            <div className="pt-2 flex justify-end border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowSavedPostsModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


