import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native'
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
  AlertTriangle,
  UserPlus,
  Bug,
  Check,
  EyeOff,
  Bookmark,
  Search,
  X,
  Laptop,
  Sparkles,
  Star,
} from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'
import { useTheme, LANGUAGE_OPTIONS } from '../context/ThemeContext'
import { EditProfileModal } from '../components/EditProfileModal'
import { MobilePostCard } from '../components/MobilePostCard'
import type { Post } from '@private-voices/shared'
import { extractPostMediaAndCleanContent } from '@private-voices/shared'

export default function SettingsScreen() {
  const router = useRouter()
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
    colors: themeColors,
  } = useTheme()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [privacy, setPrivacy] = useState<any>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // Blocked and Muted user modal states
  const [showBlockedModal, setShowBlockedModal] = useState(false)
  const [showMutedModal, setShowMutedModal] = useState(false)
  const [blockedUsers, setBlockedUsers] = useState<any[]>([])
  const [mutedUsers, setMutedUsers] = useState<any[]>([])
  const [loadingSafetyLists, setLoadingSafetyLists] = useState(false)

  // Report Bug Modal state
  const [showBugModal, setShowBugModal] = useState(false)
  const [bugCategory, setBugCategory] = useState('ui_glitch')
  const [bugDesc, setBugDesc] = useState('')
  const [submittingBug, setSubmittingBug] = useState(false)

  // Preference states
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system')
  const [appLock, setAppLock] = useState(false)
  const [pushNotifs, setPushNotifs] = useState(true)
  const [commentsNotifs, setCommentsNotifs] = useState(true)
  const [mentionNotifs, setMentionNotifs] = useState(true)
  const [messageNotifs, setMessageNotifs] = useState(true)
  const [whisperNotifs, setWhisperNotifs] = useState(true)
  const [likeCommentNotifs, setLikeCommentNotifs] = useState(true)
  const [followerNotifs, setFollowerNotifs] = useState(true)
  const [communityNotifs, setCommunityNotifs] = useState(true)
  const [storyNotifs, setStoryNotifs] = useState(true)

  // Delete account confirmation modal step (0=hidden, 1=explanation, 2=type DELETE)
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Account Modals State
  const [showEditProfileModal, setShowEditProfileModal] = useState(false)
  const [showChangeUsernameModal, setShowChangeUsernameModal] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [updatingUsername, setUpdatingUsername] = useState(false)
  const [usernameCooldown, setUsernameCooldown] = useState<{
    can_change: boolean
    eligible_at?: string
    days_remaining?: number
  } | null>(null)

  const [showChangeEmailModal, setShowChangeEmailModal] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [updatingEmail, setUpdatingEmail] = useState(false)

  // Change Password Modal State
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false)
  const [updatingPassword, setUpdatingPassword] = useState(false)

  // Saved Posts (Bookmarks) State
  const [showSavedPostsModal, setShowSavedPostsModal] = useState(false)
  const [savedPosts, setSavedPosts] = useState<Post[]>([])
  const [loadingSaved, setLoadingSaved] = useState(false)

  // Search & Navigation State
  const [searchQuery, setSearchQuery] = useState('')

  // Active Sessions & Device Manager State
  const [showSessionsModal, setShowSessionsModal] = useState(false)
  const [signingOutOthers, setSigningOutOthers] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id)
        setUserEmail(data.user.email ?? null)
        fetchSettings(data.user.id)
      }
    })
  }, [])

  async function fetchSettings(uId: string) {
    const [{ data: prof }, { data: priv }, { data: notifPrefs }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uId).single(),
      supabase.from('privacy_settings').select('*').eq('user_id', uId).maybeSingle(),
      supabase.from('notification_preferences').select('*').eq('user_id', uId).maybeSingle(),
    ])

    setProfile(prof)
    setPrivacy(priv || { whisper_visibility: 'anyone', who_can_message: 'anyone', show_in_recommendations: true })

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

    setLoading(false)
    fetchSavedPosts(uId)
  }

  async function handleUpdateNotifPref(key: string, value: boolean) {
    if (!userId) return
    await supabase
      .from('notification_preferences')
      .upsert(
        { user_id: userId, [key]: value, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
  }

  async function fetchSavedPosts(uId: string) {
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
  }

  async function handleUpdateProfile(updates: Partial<any>) {
    if (!userId) return
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId)
    if (!error) {
      setProfile((prev: any) => ({ ...prev, ...updates }))
    }
  }

  async function handleUpdatePrivacy(key: string, value: any) {
    if (!userId) return

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
    }
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

  async function handleRevokeOtherSessions() {
    setSigningOutOthers(true)
    try {
      await supabase.auth.signOut({ scope: 'others' })
      Alert.alert('Sessions Revoked', 'All other devices and active sessions have been signed out.')
      setShowSessionsModal(false)
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to revoke other sessions.')
    } finally {
      setSigningOutOthers(false)
    }
  }

  function handleLogoutAllDevices() {
    Alert.alert(
      'Log out of all devices?',
      'This will invalidate all active login sessions on all your devices. You will need to log in again on every device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Log Out All',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut({ scope: 'global' })
            router.push('/login')
          },
        },
      ]
    )
  }

  async function handleSendBugReport() {
    if (!bugDesc.trim() || !userId) return
    setSubmittingBug(true)

    const { error } = await supabase.from('content_reports').insert({
      reporter_id: userId,
      target_type: 'bug_report',
      target_id: userId,
      reason: `Bug Report: ${bugCategory}`,
      details: bugDesc.trim(),
    })

    setSubmittingBug(false)
    if (!error) {
      Alert.alert('Report Submitted', 'Thank you for helping us improve Private Voices! Our team has received your report.')
      setShowBugModal(false)
      setBugDesc('')
    } else {
      Alert.alert('Submission Error', error.message)
    }
  }

  async function handlePermanentDelete() {
    if (!userId) return
    setDeleting(true)
    await supabase.from('profiles').delete().eq('id', userId)
    await supabase.auth.signOut()
    setDeleting(false)
    setDeleteStep(0)
    router.push('/login')
  }

  async function handleChangePassword() {
    if (newPassword.length < 8) {
      Alert.alert('Password too short', 'Your new password must be at least 8 characters long.')
      return
    }

    if (newPassword !== confirmNewPassword) {
      Alert.alert('Passwords mismatch', 'New passwords do not match. Please verify both fields.')
      return
    }

    setUpdatingPassword(true)
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })
    setUpdatingPassword(false)

    if (error) {
      Alert.alert('Update Failed', error.message)
    } else {
      Alert.alert('Password Updated', 'Your account password has been changed successfully.')
      setShowChangePasswordModal(false)
      setNewPassword('')
      setConfirmNewPassword('')
    }
  }

  async function fetchUsernameCooldown(uId: string) {
    try {
      const { data } = await supabase.rpc('get_username_cooldown_status', {
        p_user_id: uId,
      })
      if (data) {
        setUsernameCooldown(data)
      }
    } catch {
      // fallback
    }
  }

  async function handleChangeUsername() {
    const trimmed = newUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    if (trimmed.length < 3) {
      Alert.alert('Invalid Username', 'Username must be at least 3 characters and contain only letters, numbers, and underscores.')
      return
    }

    if (trimmed === profile?.username?.toLowerCase()) {
      setShowChangeUsernameModal(false)
      return
    }

    setUpdatingUsername(true)

    // Call atomic stored procedure enforcing 60-day cooldown and permanent reservation
    const { data: result, error } = await supabase.rpc('change_username', {
      p_user_id: userId,
      p_new_username: trimmed,
    })

    setUpdatingUsername(false)

    if (error) {
      Alert.alert('Update Failed', error.message)
      return
    }

    if (!result?.success) {
      if (result?.code === 'COOLDOWN_ACTIVE') {
        const eligibleDate = result.eligible_at ? new Date(result.eligible_at).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }) : 'in 60 days'
        Alert.alert(
          'Username Cooldown Active',
          `You can change your username only once every 60 days. You will be eligible again on ${eligibleDate}. (${result.days_remaining} days remaining)`
        )
      } else {
        Alert.alert('Username Unavailable', result?.message || 'Could not change username.')
      }
      return
    }

    setProfile((prev: any) => ({ ...prev, username: trimmed }))
    Alert.alert('Username Updated', `Your username has been changed to @${trimmed}. Your 60-day cooldown is now active.`)
    setShowChangeUsernameModal(false)
    setNewUsername('')
    if (userId) fetchUsernameCooldown(userId)
  }

  async function handleChangeEmail() {
    const trimmed = newEmail.trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmed)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.')
      return
    }

    setUpdatingEmail(true)

    // Pre-validate that new email is not in permanent email_registry
    try {
      const { data: availRes } = await supabase.rpc('check_email_change_availability', {
        p_user_id: userId,
        p_new_email: trimmed,
      })

      if (availRes && !availRes.available) {
        setUpdatingEmail(false)
        Alert.alert('Email Unavailable', availRes.message || 'This email address is already reserved.')
        return
      }
    } catch {
      // ignore
    }

    const { error } = await supabase.auth.updateUser({
      email: trimmed,
    })
    setUpdatingEmail(false)

    if (error) {
      Alert.alert('Update Failed', error.message)
    } else {
      Alert.alert(
        'Confirmation Link Sent',
        `A verification link has been sent to ${trimmed}. Please check your inbox to confirm the update.`
      )
      setShowChangeEmailModal(false)
      setNewEmail('')
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={colors.gray800} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.settings}</Text>
      </View>

      {/* ── Search Bar ── */}
      <View style={styles.searchBarWrapper}>
        <Search size={18} color={colors.gray400} style={styles.searchIcon} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search settings..."
          placeholderTextColor={colors.gray400}
          style={styles.searchInput}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
            <X size={16} color={colors.gray400} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Hub Category Pills ── */}
      {!searchQuery && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.hubScroll}
          contentContainerStyle={styles.hubScrollContent}
        >
          {[
            { id: 'account', label: 'Account', icon: User, color: '#3b82f6', bg: '#eff6ff' },
            { id: 'privacy', label: 'Privacy', icon: Lock, color: '#10b981', bg: '#ecfdf5' },
            { id: 'notifications', label: 'Alerts', icon: Bell, color: '#f59e0b', bg: '#fffbeb' },
            { id: 'appearance', label: 'Theme', icon: SunMoon, color: '#8b5cf6', bg: '#f5f3ff' },
            { id: 'security', label: 'Security', icon: Shield, color: '#ef4444', bg: '#fef2f2' },
          ].map((pill) => {
            const Icon = pill.icon
            return (
              <View key={pill.id} style={styles.hubPillItem}>
                <View style={[styles.hubPillIconWrapper, { backgroundColor: pill.bg }]}>
                  <Icon size={14} color={pill.color} />
                </View>
                <Text style={styles.hubPillLabel}>{pill.label}</Text>
              </View>
            )
          })}
        </ScrollView>
      )}

      {/* ── 1. ACCOUNT ── */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionCategoryTitle}>{t.account.toUpperCase()}</Text>

        <TouchableOpacity
          style={styles.rowItem}
          activeOpacity={0.7}
          onPress={() => setShowEditProfileModal(true)}
        >
          <View style={styles.rowLeft}>
            <User size={18} color={colors.gray600} />
            <View>
              <Text style={styles.rowLabel}>Edit Profile</Text>
              <Text style={styles.rowSubLabel}>Display name, bio, avatar</Text>
            </View>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.rowItem}
          activeOpacity={0.7}
          onPress={() => {
            setNewUsername(profile?.username || '')
            if (userId) fetchUsernameCooldown(userId)
            setShowChangeUsernameModal(true)
          }}
        >
          <View style={styles.rowLeft}>
            <AtSign size={18} color={colors.gray600} />
            <View>
              <Text style={styles.rowLabel}>Change Username</Text>
              <Text style={styles.rowSubLabel}>@{profile?.username || 'username'}</Text>
            </View>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.rowItem}
          activeOpacity={0.7}
          onPress={() => {
            setNewEmail(userEmail || '')
            setShowChangeEmailModal(true)
          }}
        >
          <View style={styles.rowLeft}>
            <Mail size={18} color={colors.gray600} />
            <View>
              <Text style={styles.rowLabel}>Change Email</Text>
              <Text style={styles.rowSubLabel}>{userEmail || 'Update account email address'}</Text>
            </View>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.rowItem}
          activeOpacity={0.7}
          onPress={() => setShowChangePasswordModal(true)}
        >
          <View style={styles.rowLeft}>
            <KeyRound size={18} color={colors.gray600} />
            <View>
              <Text style={styles.rowLabel}>Change Password</Text>
              <Text style={styles.rowSubLabel}>Update security password</Text>
            </View>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>
      </View>

      {/* ── 2. PRIVACY ── */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionCategoryTitle}>{t.privacy.toUpperCase()}</Text>

        <View style={styles.rowItemNoClick}>
          <View style={styles.rowLeft}>
            <MessageSquare size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>{t.anonymousWhispers}</Text>
          </View>
        </View>
        <View style={styles.optionsGroup}>
          {(['anyone', 'followers', 'nobody'] as const).map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[
                styles.optionBtn,
                privacy?.whisper_visibility === opt && styles.optionBtnActive,
              ]}
              onPress={() => handleUpdatePrivacy('whisper_visibility', opt)}
            >
              <Text
                style={[
                  styles.optionText,
                  privacy?.whisper_visibility === opt && styles.optionTextActive,
                ]}
              >
                {opt === 'anyone' ? 'Everyone' : opt === 'followers' ? 'Followers' : 'Nobody'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <Users size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Who can follow me</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <Shield size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Who can message me</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <View style={styles.rowItemNoClick}>
          <View style={styles.rowLeft}>
            <Lock size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Private Account</Text>
          </View>
          <Switch
            value={profile?.is_private || false}
            onValueChange={(val) => handleUpdateProfile({ is_private: val })}
            trackColor={{ false: '#e2e8f0', true: colors.brand }}
          />
        </View>

        <TouchableOpacity
          style={styles.rowItem}
          activeOpacity={0.7}
          onPress={() => {
            setShowBlockedModal(true)
            fetchBlockedUsers()
          }}
        >
          <View style={styles.rowLeft}>
            <Ban size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Blocked Accounts</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>
      </View>

      {/* ── 2.5 SOCIAL ── */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionCategoryTitle}>SOCIAL</Text>

        <TouchableOpacity
          style={styles.rowItem}
          activeOpacity={0.7}
          onPress={() => {
            if (userId) fetchSavedPosts(userId)
            setShowSavedPostsModal(true)
          }}
        >
          <View style={styles.rowLeft}>
            <Bookmark size={18} color={colors.brand} />
            <View>
              <Text style={styles.rowLabel}>Saved</Text>
              <Text style={styles.rowSubLabel}>Voices and posts you bookmarked ({savedPosts.length})</Text>
            </View>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.rowItem}
          activeOpacity={0.7}
          onPress={() => router.push('/communities' as any)}
        >
          <View style={styles.rowLeft}>
            <Users size={18} color={colors.gray600} />
            <View>
              <Text style={styles.rowLabel}>Communities</Text>
              <Text style={styles.rowSubLabel}>Explore and join groups</Text>
            </View>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.rowItem}
          activeOpacity={0.7}
          onPress={() => router.push('/invite' as any)}
        >
          <View style={styles.rowLeft}>
            <UserPlus size={18} color={colors.gray600} />
            <View>
              <Text style={styles.rowLabel}>Invite Friends</Text>
              <Text style={styles.rowSubLabel}>Share your invite link</Text>
            </View>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>
      </View>

      {/* ── 3. CONTENT & SAFETY ── */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionCategoryTitle}>CONTENT & SAFETY</Text>

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <Eye size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Sensitive Content</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <Sliders size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Content Preferences</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.rowItem}
          activeOpacity={0.7}
          onPress={() => {
            setShowMutedModal(true)
            fetchMutedUsers()
          }}
        >
          <View style={styles.rowLeft}>
            <VolumeX size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Muted Accounts</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <FileText size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Reports & Appeals</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>
      </View>

      {/* ── 4. SECURITY ── */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionCategoryTitle}>SECURITY</Text>

        <View style={styles.rowItemNoClick}>
          <View style={styles.rowLeft}>
            <Smartphone size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>App Lock / Face ID / Fingerprint</Text>
          </View>
          <Switch
            value={appLock}
            onValueChange={setAppLock}
            trackColor={{ false: '#e2e8f0', true: colors.brand }}
          />
        </View>

        <TouchableOpacity
          style={styles.rowItem}
          activeOpacity={0.7}
          onPress={() => setShowSessionsModal(true)}
        >
          <View style={styles.rowLeft}>
            <History size={18} color={colors.gray600} />
            <View>
              <Text style={styles.rowLabel}>Login Sessions & Devices</Text>
              <Text style={styles.rowSubLabel}>Manage active logins across devices</Text>
            </View>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>
      </View>

      {/* ── 5. NOTIFICATIONS ── */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRowFlex}>
          <Text style={styles.sectionCategoryTitle}>NOTIFICATIONS & ALERTS</Text>
          <View style={styles.badgePillSmall}>
            <Text style={styles.badgePillTextSmall}>Granular</Text>
          </View>
        </View>

        {/* Master Switch */}
        <View style={styles.masterNotifCard}>
          <View style={styles.rowLeft}>
            <View style={styles.iconCircleBrand}>
              <Bell size={18} color="#fff" />
            </View>
            <View>
              <Text style={styles.rowLabel}>Allow Push Notifications</Text>
              <Text style={styles.rowSubLabel}>Master alert switch for this device</Text>
            </View>
          </View>
          <Switch
            value={pushNotifs}
            onValueChange={(val) => {
              setPushNotifs(val)
              handleUpdateNotifPref('push_enabled', val)
            }}
            trackColor={{ false: '#e2e8f0', true: colors.brand }}
          />
        </View>

        <View style={{ opacity: pushNotifs ? 1 : 0.5, pointerEvents: pushNotifs ? 'auto' : 'none' }}>
          {/* Group 1: Activity */}
          <Text style={styles.subGroupHeading}>ACTIVITY & INTERACTIONS</Text>
          <View style={styles.subGroupCard}>
            <View style={styles.rowItemNoClickSub}>
              <View>
                <Text style={styles.rowSubLabelTitle}>Comments & Replies</Text>
                <Text style={styles.rowSubLabelMuted}>When someone comments on your Voices</Text>
              </View>
              <Switch
                value={commentsNotifs}
                onValueChange={(val) => {
                  setCommentsNotifs(val)
                  handleUpdateNotifPref('comments_enabled', val)
                }}
                trackColor={{ false: '#e2e8f0', true: colors.brand }}
              />
            </View>

            <View style={styles.rowItemNoClickSub}>
              <View>
                <Text style={styles.rowSubLabelTitle}>Mentions (@you)</Text>
                <Text style={styles.rowSubLabelMuted}>When someone tags your handle</Text>
              </View>
              <Switch
                value={mentionNotifs}
                onValueChange={(val) => {
                  setMentionNotifs(val)
                  handleUpdateNotifPref('mentions_enabled', val)
                }}
                trackColor={{ false: '#e2e8f0', true: colors.brand }}
              />
            </View>

            <View style={styles.rowItemNoClickSub}>
              <View>
                <Text style={styles.rowSubLabelTitle}>Likes & Reactions</Text>
                <Text style={styles.rowSubLabelMuted}>When someone likes your posts</Text>
              </View>
              <Switch
                value={likeCommentNotifs}
                onValueChange={(val) => {
                  setLikeCommentNotifs(val)
                  handleUpdateNotifPref('likes_enabled', val)
                }}
                trackColor={{ false: '#e2e8f0', true: colors.brand }}
              />
            </View>
          </View>

          {/* Group 2: Direct & Social */}
          <Text style={styles.subGroupHeading}>DIRECT & SOCIAL</Text>
          <View style={styles.subGroupCard}>
            <View style={styles.rowItemNoClickSub}>
              <View>
                <Text style={styles.rowSubLabelTitle}>Direct Messages</Text>
                <Text style={styles.rowSubLabelMuted}>1-on-1 private conversations</Text>
              </View>
              <Switch
                value={messageNotifs}
                onValueChange={(val) => {
                  setMessageNotifs(val)
                  handleUpdateNotifPref('direct_messages_enabled', val)
                }}
                trackColor={{ false: '#e2e8f0', true: colors.brand }}
              />
            </View>

            <View style={styles.rowItemNoClickSub}>
              <View>
                <Text style={styles.rowSubLabelTitle}>Anonymous Whispers</Text>
                <Text style={styles.rowSubLabelMuted}>Secret whispers from other users</Text>
              </View>
              <Switch
                value={whisperNotifs}
                onValueChange={(val) => {
                  setWhisperNotifs(val)
                  handleUpdateNotifPref('whispers_enabled', val)
                }}
                trackColor={{ false: '#e2e8f0', true: colors.brand }}
              />
            </View>

            <View style={styles.rowItemNoClickSub}>
              <View>
                <Text style={styles.rowSubLabelTitle}>New Followers</Text>
                <Text style={styles.rowSubLabelMuted}>When someone follows your profile</Text>
              </View>
              <Switch
                value={followerNotifs}
                onValueChange={(val) => {
                  setFollowerNotifs(val)
                  handleUpdateNotifPref('followers_enabled', val)
                }}
                trackColor={{ false: '#e2e8f0', true: colors.brand }}
              />
            </View>
          </View>

          {/* Group 3: Communities */}
          <Text style={styles.subGroupHeading}>COMMUNITIES</Text>
          <View style={styles.subGroupCard}>
            <View style={styles.rowItemNoClickSub}>
              <View>
                <Text style={styles.rowSubLabelTitle}>Community Announcements</Text>
                <Text style={styles.rowSubLabelMuted}>Broadcasts from joined groups</Text>
              </View>
              <Switch
                value={communityNotifs}
                onValueChange={(val) => {
                  setCommunityNotifs(val)
                  handleUpdateNotifPref('community_announcements_enabled', val)
                }}
                trackColor={{ false: '#e2e8f0', true: colors.brand }}
              />
            </View>
          </View>
        </View>
      </View>

      {/* ── 6. APPEARANCE ── */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionCategoryTitle}>{t.appearance.toUpperCase()}</Text>

        {/* Theme: System | Light | Dark */}
        <View style={styles.rowItemNoClick}>
          <View style={styles.rowLeft}>
            <SunMoon size={18} color={themeColors.textSecondary} />
            <Text style={[styles.rowLabel, { color: themeColors.textPrimary }]}>{t.theme}</Text>
          </View>
        </View>
        {/* Instagram-style Visual Theme Preview Selector */}
        <View style={styles.themeCardsRow}>
          {/* Light Theme Card */}
          <TouchableOpacity
            style={[
              styles.themeCard,
              {
                backgroundColor: themeColors.surface,
                borderColor: themeMode === 'light' ? colors.brand : themeColors.surfaceBorder,
              },
              themeMode === 'light' && styles.themeCardActive,
            ]}
            onPress={() => setThemeMode('light')}
            activeOpacity={0.75}
            accessibilityRole="radio"
            accessibilityLabel={t.themeLight}
            accessibilityState={{ selected: themeMode === 'light' }}
          >
            {/* Visual mini-mockup */}
            <View style={[styles.themePreviewBox, { backgroundColor: '#fafafa', borderColor: '#e5e7eb' }]}>
              <View style={styles.previewHeaderBar}>
                <View style={[styles.previewDotMini, { backgroundColor: '#d1d5db' }]} />
                <View style={[styles.previewPillMini, { backgroundColor: colors.brand }]} />
              </View>
              <View style={[styles.previewLineMini, { backgroundColor: '#e5e7eb' }]} />
              <View style={[styles.previewLineMini, { backgroundColor: '#e5e7eb', width: '60%' }]} />
              <View style={[styles.previewActionMini, { backgroundColor: 'rgba(124, 58, 237, 0.15)' }]} />
            </View>
            <View style={styles.themeCardFooter}>
              <Text
                style={[
                  styles.themeCardLabel,
                  { color: themeColors.textPrimary },
                  themeMode === 'light' && { color: colors.brand, fontWeight: '700' },
                ]}
              >
                {t.themeLight}
              </Text>
              <View
                style={[
                  styles.radioIndicator,
                  { borderColor: themeMode === 'light' ? colors.brand : themeColors.textMuted },
                  themeMode === 'light' && { backgroundColor: colors.brand },
                ]}
              >
                {themeMode === 'light' && <View style={styles.radioIndicatorInner} />}
              </View>
            </View>
          </TouchableOpacity>

          {/* Dark Theme Card */}
          <TouchableOpacity
            style={[
              styles.themeCard,
              {
                backgroundColor: themeColors.surface,
                borderColor: themeMode === 'dark' ? colors.brand : themeColors.surfaceBorder,
              },
              themeMode === 'dark' && styles.themeCardActive,
            ]}
            onPress={() => setThemeMode('dark')}
            activeOpacity={0.75}
            accessibilityRole="radio"
            accessibilityLabel={t.themeDark}
            accessibilityState={{ selected: themeMode === 'dark' }}
          >
            {/* Visual mini-mockup */}
            <View style={[styles.themePreviewBox, { backgroundColor: '#121212', borderColor: '#262626' }]}>
              <View style={styles.previewHeaderBar}>
                <View style={[styles.previewDotMini, { backgroundColor: '#404040' }]} />
                <View style={[styles.previewPillMini, { backgroundColor: colors.brand }]} />
              </View>
              <View style={[styles.previewLineMini, { backgroundColor: '#262626' }]} />
              <View style={[styles.previewLineMini, { backgroundColor: '#262626', width: '60%' }]} />
              <View style={[styles.previewActionMini, { backgroundColor: 'rgba(139, 92, 246, 0.25)' }]} />
            </View>
            <View style={styles.themeCardFooter}>
              <Text
                style={[
                  styles.themeCardLabel,
                  { color: themeColors.textPrimary },
                  themeMode === 'dark' && { color: colors.brand, fontWeight: '700' },
                ]}
              >
                {t.themeDark}
              </Text>
              <View
                style={[
                  styles.radioIndicator,
                  { borderColor: themeMode === 'dark' ? colors.brand : themeColors.textMuted },
                  themeMode === 'dark' && { backgroundColor: colors.brand },
                ]}
              >
                {themeMode === 'dark' && <View style={styles.radioIndicatorInner} />}
              </View>
            </View>
          </TouchableOpacity>

          {/* System Theme Card */}
          <TouchableOpacity
            style={[
              styles.themeCard,
              {
                backgroundColor: themeColors.surface,
                borderColor: themeMode === 'system' ? colors.brand : themeColors.surfaceBorder,
              },
              themeMode === 'system' && styles.themeCardActive,
            ]}
            onPress={() => setThemeMode('system')}
            activeOpacity={0.75}
            accessibilityRole="radio"
            accessibilityLabel={t.themeSystem}
            accessibilityState={{ selected: themeMode === 'system' }}
          >
            {/* Split visual mini-mockup */}
            <View style={[styles.themePreviewBox, styles.splitPreviewBox, { borderColor: themeColors.surfaceBorder }]}>
              {/* Left light half */}
              <View style={[styles.splitHalf, { backgroundColor: '#fafafa', borderRightWidth: 1, borderRightColor: '#e5e7eb' }]}>
                <View style={[styles.previewDotMini, { backgroundColor: '#d1d5db', marginBottom: 6 }]} />
                <View style={[styles.previewLineMini, { backgroundColor: '#e5e7eb' }]} />
                <View style={[styles.previewActionMini, { backgroundColor: 'rgba(124, 58, 237, 0.15)' }]} />
              </View>
              {/* Right dark half */}
              <View style={[styles.splitHalf, { backgroundColor: '#121212' }]}>
                <View style={[styles.previewDotMini, { backgroundColor: '#404040', marginBottom: 6, alignSelf: 'flex-end' }]} />
                <View style={[styles.previewLineMini, { backgroundColor: '#262626' }]} />
                <View style={[styles.previewActionMini, { backgroundColor: 'rgba(139, 92, 246, 0.25)', alignSelf: 'flex-end' }]} />
              </View>
            </View>
            <View style={styles.themeCardFooter}>
              <Text
                style={[
                  styles.themeCardLabel,
                  { color: themeColors.textPrimary },
                  themeMode === 'system' && { color: colors.brand, fontWeight: '700' },
                ]}
              >
                {t.themeSystem}
              </Text>
              <View
                style={[
                  styles.radioIndicator,
                  { borderColor: themeMode === 'system' ? colors.brand : themeColors.textMuted },
                  themeMode === 'system' && { backgroundColor: colors.brand },
                ]}
              >
                {themeMode === 'system' && <View style={styles.radioIndicatorInner} />}
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Language Picker */}
        <TouchableOpacity
          style={styles.rowItem}
          onPress={() => {
            Alert.alert(
              t.language,
              t.languageDesc,
              [
                ...LANGUAGE_OPTIONS.map((opt) => ({
                  text: `${opt.nativeName} (${opt.label})`,
                  onPress: () => setLanguage(opt.code),
                })),
                { text: t.cancel, style: 'cancel' as const },
              ]
            )
          }}
          activeOpacity={0.7}
        >
          <View style={styles.rowLeft}>
            <Globe size={18} color={themeColors.textSecondary} />
            <View>
              <Text style={[styles.rowLabel, { color: themeColors.textPrimary }]}>{t.language}</Text>
              <Text style={[styles.rowSubLabel, { color: themeColors.textMuted }]}>{t.languageDesc}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.valueText, { color: colors.brand, fontWeight: '600' }]}>
              {LANGUAGE_OPTIONS.find((opt) => opt.code === language)?.nativeName || 'English (US)'}
            </Text>
            <ChevronRight size={16} color={themeColors.textMuted} />
          </View>
        </TouchableOpacity>

        {/* Reduce Motion */}
        <View style={styles.rowItemNoClick}>
          <View style={styles.rowLeft}>
            <Sliders size={18} color={themeColors.textSecondary} />
            <View>
              <Text style={[styles.rowLabel, { color: themeColors.textPrimary }]}>{t.reduceMotion}</Text>
              <Text style={[styles.rowSubLabel, { color: themeColors.textMuted }]}>{t.reduceMotionDesc}</Text>
            </View>
          </View>
          <Switch
            value={reduceMotion}
            onValueChange={setReduceMotion}
            trackColor={{ false: '#e2e8f0', true: colors.brand }}
          />
        </View>

        {/* High Contrast */}
        <View style={styles.rowItemNoClick}>
          <View style={styles.rowLeft}>
            <Eye size={18} color={themeColors.textSecondary} />
            <View>
              <Text style={[styles.rowLabel, { color: themeColors.textPrimary }]}>{t.highContrast}</Text>
              <Text style={[styles.rowSubLabel, { color: themeColors.textMuted }]}>{t.highContrastDesc}</Text>
            </View>
          </View>
          <Switch
            value={highContrast}
            onValueChange={setHighContrast}
            trackColor={{ false: '#e2e8f0', true: colors.brand }}
          />
        </View>

        {/* Compact Mode */}
        <View style={styles.rowItemNoClick}>
          <View style={styles.rowLeft}>
            <Smartphone size={18} color={themeColors.textSecondary} />
            <View>
              <Text style={[styles.rowLabel, { color: themeColors.textPrimary }]}>{t.compactMode}</Text>
              <Text style={[styles.rowSubLabel, { color: themeColors.textMuted }]}>{t.compactModeDesc}</Text>
            </View>
          </View>
          <Switch
            value={compactMode}
            onValueChange={setCompactMode}
            trackColor={{ false: '#e2e8f0', true: colors.brand }}
          />
        </View>
      </View>

      {/* ── 7. DATA & PRIVACY ── */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionCategoryTitle}>DATA & PRIVACY</Text>

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <Download size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Download My Data</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <Shield size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Data & Privacy</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>
      </View>

      {/* ── 8. INVITE FRIENDS ── */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionCategoryTitle}>INVITE FRIENDS</Text>

        <TouchableOpacity
          style={styles.rowItem}
          onPress={() => router.push('/invite' as any)}
          activeOpacity={0.7}
        >
          <View style={styles.rowLeft}>
            <UserPlus size={18} color={colors.brand} />
            <Text style={styles.rowLabel}>Invite Friends</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>
      </View>

      {/* ── 9. ABOUT ── */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionCategoryTitle}>ABOUT</Text>

        <TouchableOpacity
          style={styles.rowItem}
          onPress={() => router.push('/preview')}
          activeOpacity={0.7}
        >
          <View style={styles.rowLeft}>
            <Sparkles size={18} color="#6366f1" />
            <View>
              <Text style={styles.rowLabel}>App Preview</Text>
              <Text style={styles.rowSub}>Roadmap, early access & tester tasks</Text>
            </View>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.rowItem}
          onPress={() => router.push('/rate')}
          activeOpacity={0.7}
        >
          <View style={styles.rowLeft}>
            <Star size={18} color="#eab308" />
            <View>
              <Text style={styles.rowLabel}>Rate Private Voices</Text>
              <Text style={styles.rowSub}>Share your experience & feedback</Text>
            </View>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <BookOpen size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Community Guidelines</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <FileText size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Terms & Conditions</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <Shield size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Privacy Policy</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <HelpCircle size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Help & Support</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <Info size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>About Private Voices</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.rowItem}
          onPress={() => setShowBugModal(true)}
          activeOpacity={0.7}
        >
          <View style={styles.rowLeft}>
            <Bug size={18} color="#ef4444" />
            <Text style={[styles.rowLabel, { color: '#dc2626', fontWeight: '700' }]}>Report a Bug</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <View style={styles.versionRow}>
          <Text style={styles.versionLabel}>App Version</Text>
          <Text style={styles.versionVal}>v1.0.4 (Production)</Text>
        </View>
      </View>

      {/* ── 10. BOTTOM ACTIONS (SEPARATED AT ABSOLUTE BOTTOM) ── */}
      <View style={styles.bottomActionsContainer}>
        {/* Log out of all devices (Immediately above Delete Account) */}
        <TouchableOpacity style={styles.logoutAllBtn} onPress={handleLogoutAllDevices}>
          <LogOut size={18} color="#d97706" />
          <Text style={styles.logoutAllText}>Log out of all devices</Text>
        </TouchableOpacity>

        {/* Delete Account (Absolute Last Item) */}
        <TouchableOpacity style={styles.deleteAccountBtn} onPress={() => setDeleteStep(1)}>
          <Trash2 size={18} color="#ef4444" />
          <Text style={styles.deleteAccountText}>Delete Account</Text>
        </TouchableOpacity>
      </View>

      {/* Delete Account Step 1 Modal */}
      <Modal visible={deleteStep === 1} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <AlertTriangle size={22} color="#ef4444" />
              <Text style={styles.modalTitleRed}>Delete Account</Text>
            </View>
            <Text style={styles.modalBodyText}>
              Are you sure you want to delete your account? This will permanently erase your profile, posts, messages, stories, and received Whispers.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setDeleteStep(0)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDangerBtn}
                onPress={() => setDeleteStep(2)}
              >
                <Text style={styles.modalDangerText}>Proceed</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Account Step 2 Modal */}
      <Modal visible={deleteStep === 2} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Trash2 size={22} color="#ef4444" />
              <Text style={styles.modalTitleRed}>Final Confirmation</Text>
            </View>
            <Text style={styles.modalBodyText}>
              This action CANNOT be undone. Type <Text style={styles.boldMono}>DELETE</Text> to confirm:
            </Text>
            <TextInput
              style={styles.deleteInput}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="Type DELETE"
              placeholderTextColor={colors.gray400}
              autoCapitalize="characters"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setDeleteStep(0)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalDangerBtn,
                  (deleteConfirmText !== 'DELETE' || deleting) && styles.disabledBtn,
                ]}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
                onPress={handlePermanentDelete}
              >
                <Text style={styles.modalDangerText}>
                  {deleting ? 'Deleting...' : 'Delete Permanently'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Active Sessions & Devices Modal ── */}
      <Modal visible={showSessionsModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={[styles.hubPillIconWrapper, { backgroundColor: '#eff6ff', marginRight: 8 }]}>
                <Laptop size={18} color="#3b82f6" />
              </View>
              <Text style={[styles.modalTitleRed, { color: colors.gray900 }]}>Active Sessions</Text>
            </View>

            <Text style={styles.modalBodyText}>
              Manage devices currently logged into your Private Voices account.
            </Text>

            {/* Current Device Item */}
            <View style={styles.currentDeviceCard}>
              <View style={styles.rowLeft}>
                <View style={styles.deviceIconCircle}>
                  <Smartphone size={18} color="#10b981" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.sessionDeviceName}>Mobile App</Text>
                    <View style={styles.thisDeviceBadge}>
                      <Text style={styles.thisDeviceBadgeText}>This device</Text>
                    </View>
                  </View>
                  <Text style={styles.sessionDeviceSub}>Active Now • Expo / React Native</Text>
                </View>
              </View>
              <View style={styles.onlineDot} />
            </View>

            {/* Security Explanation */}
            <View style={styles.sessionSecurityCard}>
              <Shield size={14} color="#6366f1" style={{ marginTop: 2 }} />
              <Text style={styles.sessionSecurityText}>
                If you suspect unauthorized access or logged in on another phone/browser, you can revoke all other active sessions right now.
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalActionBtn, { backgroundColor: '#fef3c7', borderColor: '#fde68a', borderWidth: 1 }]}
                disabled={signingOutOthers}
                onPress={handleRevokeOtherSessions}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#b45309' }}>
                  {signingOutOthers ? 'Revoking...' : 'Sign out other devices'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowSessionsModal(false)}
              >
                <Text style={styles.modalCancelText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Report Bug Modal */}
      <Modal visible={showBugModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Bug size={22} color="#ef4444" />
              <Text style={styles.modalTitleRed}>Report a Bug</Text>
            </View>

            <Text style={styles.modalBodyText}>
              Category:
            </Text>
            <View style={styles.categoryRow}>
              <TouchableOpacity
                style={[styles.categoryChip, bugCategory === 'ui_glitch' && styles.categoryChipActive]}
                onPress={() => setBugCategory('ui_glitch')}
              >
                <Text style={[styles.categoryChipText, bugCategory === 'ui_glitch' && styles.categoryChipTextActive]}>UI Glitch</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.categoryChip, bugCategory === 'feed_loading' && styles.categoryChipActive]}
                onPress={() => setBugCategory('feed_loading')}
              >
                <Text style={[styles.categoryChipText, bugCategory === 'feed_loading' && styles.categoryChipTextActive]}>Feed/Posts</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.categoryChip, bugCategory === 'whisper' && styles.categoryChipActive]}
                onPress={() => setBugCategory('whisper')}
              >
                <Text style={[styles.categoryChipText, bugCategory === 'whisper' && styles.categoryChipTextActive]}>Whispers</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.bugTextArea}
              multiline
              numberOfLines={4}
              placeholder="Describe what happened and how to reproduce it..."
              placeholderTextColor={colors.gray400}
              value={bugDesc}
              onChangeText={setBugDesc}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowBugModal(false)
                  setBugDesc('')
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.bugSubmitBtn, (!bugDesc.trim() || submittingBug) && styles.disabledBtn]}
                disabled={!bugDesc.trim() || submittingBug}
                onPress={handleSendBugReport}
              >
                <Text style={styles.bugSubmitText}>{submittingBug ? 'Sending...' : 'Send Report'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Blocked Accounts Modal */}
      <Modal visible={showBlockedModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Ban size={20} color="#ef4444" />
              <Text style={[styles.modalTitleRed, { color: colors.gray900 }]}>Blocked Accounts</Text>
            </View>

            {loadingSafetyLists ? (
              <ActivityIndicator color={colors.brand} style={{ marginVertical: 16 }} />
            ) : blockedUsers.length === 0 ? (
              <Text style={styles.modalBodyText}>You haven't blocked any accounts.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 240 }}>
                {blockedUsers.map((item) => (
                  <View key={item.blocked_id} style={styles.listUserRow}>
                    <View>
                      <Text style={styles.listUserName}>{item.profile?.display_name || 'User'}</Text>
                      <Text style={styles.listUserHandle}>@{item.profile?.username || 'user'}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.unblockBtn}
                      onPress={() => handleUnblock(item.blocked_id)}
                    >
                      <Text style={styles.unblockBtnText}>Unblock</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[styles.modalCancelBtn, { alignSelf: 'flex-end' }]}
              onPress={() => setShowBlockedModal(false)}
            >
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Muted Accounts Modal */}
      <Modal visible={showMutedModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <VolumeX size={20} color="#d97706" />
              <Text style={[styles.modalTitleRed, { color: colors.gray900 }]}>Muted Accounts</Text>
            </View>

            {loadingSafetyLists ? (
              <ActivityIndicator color={colors.brand} style={{ marginVertical: 16 }} />
            ) : mutedUsers.length === 0 ? (
              <Text style={styles.modalBodyText}>You haven't muted any accounts.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 240 }}>
                {mutedUsers.map((item) => (
                  <View key={item.muted_id} style={styles.listUserRow}>
                    <View>
                      <Text style={styles.listUserName}>{item.profile?.display_name || 'User'}</Text>
                      <Text style={styles.listUserHandle}>@{item.profile?.username || 'user'}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.unmuteBtn}
                      onPress={() => handleUnmute(item.muted_id)}
                    >
                      <Text style={styles.unmuteBtnText}>Unmute</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[styles.modalCancelBtn, { alignSelf: 'flex-end' }]}
              onPress={() => setShowMutedModal(false)}
            >
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── CHANGE PASSWORD MODAL ── */}
      <Modal visible={showChangePasswordModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
            <View style={styles.modalHeaderRow}>
              <KeyRound size={20} color={colors.brand} />
              <Text style={[styles.modalTitleRed, { color: themeColors.text }]}>Change Password</Text>
            </View>

            <Text style={[styles.modalBodyText, { color: themeColors.textSecondary }]}>
              Enter and confirm your new password. It must be at least 8 characters long.
            </Text>

            <View style={{ gap: 10, marginVertical: 8 }}>
              <View style={[styles.changePasswordInputRow, { backgroundColor: themeColors.surfaceBorder, borderColor: themeColors.surfaceBorder }]}>
                <TextInput
                  style={[styles.changePasswordInput, { color: themeColors.text }]}
                  placeholder="New password (8+ chars)"
                  placeholderTextColor={themeColors.textSecondary}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  {showNewPassword ? <EyeOff size={18} color={themeColors.textSecondary} /> : <Eye size={18} color={themeColors.textSecondary} />}
                </TouchableOpacity>
              </View>

              <View style={[styles.changePasswordInputRow, { backgroundColor: themeColors.surfaceBorder, borderColor: themeColors.surfaceBorder }]}>
                <TextInput
                  style={[styles.changePasswordInput, { color: themeColors.text }]}
                  placeholder="Confirm new password"
                  placeholderTextColor={themeColors.textSecondary}
                  value={confirmNewPassword}
                  onChangeText={setConfirmNewPassword}
                  secureTextEntry={!showConfirmNewPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowConfirmNewPassword(!showConfirmNewPassword)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  {showConfirmNewPassword ? <EyeOff size={18} color={themeColors.textSecondary} /> : <Eye size={18} color={themeColors.textSecondary} />}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowChangePasswordModal(false)
                  setNewPassword('')
                  setConfirmNewPassword('')
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.savePasswordBtn,
                  (!newPassword || !confirmNewPassword || updatingPassword) && styles.disabledBtn,
                ]}
                onPress={handleChangePassword}
                disabled={!newPassword || !confirmNewPassword || updatingPassword}
              >
                {updatingPassword ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.savePasswordBtnText}>Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── EDIT PROFILE MODAL ── */}
      {profile && (
        <EditProfileModal
          visible={showEditProfileModal}
          initialProfile={{
            displayName: profile.display_name,
            bio: profile.bio,
            isPrivate: profile.is_private,
            avatarUrl: profile.avatar_url,
          }}
          onClose={() => setShowEditProfileModal(false)}
          onUpdated={() => {
            if (userId) fetchSettings(userId)
          }}
        />
      )}

      {/* ── CHANGE USERNAME MODAL ── */}
      <Modal visible={showChangeUsernameModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
            <View style={styles.modalHeaderRow}>
              <AtSign size={20} color={colors.brand} />
              <Text style={[styles.modalTitleRed, { color: themeColors.text }]}>Change Username</Text>
            </View>

            <Text style={[styles.modalBodyText, { color: themeColors.textSecondary }]}>
              Enter a unique username using letters, numbers, and underscores (min 3 chars). You can only change your username once every 60 days.
            </Text>

            {usernameCooldown && !usernameCooldown.can_change && (
              <View style={{
                backgroundColor: '#fffbeb',
                borderColor: '#fef3c7',
                borderWidth: 1,
                borderRadius: 12,
                padding: 10,
                marginVertical: 6,
              }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#b45309' }}>
                  ⏳ Cooldown Active
                </Text>
                <Text style={{ fontSize: 11, color: '#92400e', marginTop: 2 }}>
                  You can change your username again on {usernameCooldown.eligible_at ? new Date(usernameCooldown.eligible_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'in 60 days'} ({usernameCooldown.days_remaining} {usernameCooldown.days_remaining === 1 ? 'day' : 'days'} remaining).
                </Text>
              </View>
            )}

            <View style={{ marginVertical: 10 }}>
              <View style={[
                styles.changePasswordInputRow,
                { backgroundColor: themeColors.surfaceBorder, borderColor: themeColors.surfaceBorder },
                usernameCooldown && !usernameCooldown.can_change && { opacity: 0.6 }
              ]}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.brand, marginRight: 4 }}>@</Text>
                <TextInput
                  style={[styles.changePasswordInput, { color: themeColors.text }]}
                  placeholder="new_username"
                  placeholderTextColor={themeColors.textSecondary}
                  value={newUsername}
                  onChangeText={(val) => setNewUsername(val.toLowerCase())}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!usernameCooldown || usernameCooldown.can_change}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowChangeUsernameModal(false)
                  setNewUsername('')
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.savePasswordBtn,
                  (!newUsername.trim() || updatingUsername || (usernameCooldown && !usernameCooldown.can_change)) && styles.disabledBtn,
                ]}
                onPress={handleChangeUsername}
                disabled={Boolean(!newUsername.trim() || updatingUsername || (usernameCooldown && !usernameCooldown.can_change))}
              >
                {updatingUsername ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.savePasswordBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── CHANGE EMAIL MODAL ── */}
      <Modal visible={showChangeEmailModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
            <View style={styles.modalHeaderRow}>
              <Mail size={20} color={colors.brand} />
              <Text style={[styles.modalTitleRed, { color: themeColors.text }]}>Change Email</Text>
            </View>

            <Text style={[styles.modalBodyText, { color: themeColors.textSecondary }]}>
              Update your account email address. A confirmation link will be sent to the new email.
            </Text>

            <View style={{ marginVertical: 10 }}>
              <View style={[styles.changePasswordInputRow, { backgroundColor: themeColors.surfaceBorder, borderColor: themeColors.surfaceBorder }]}>
                <TextInput
                  style={[styles.changePasswordInput, { color: themeColors.text }]}
                  placeholder="new.email@example.com"
                  placeholderTextColor={themeColors.textSecondary}
                  value={newEmail}
                  onChangeText={setNewEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowChangeEmailModal(false)
                  setNewEmail('')
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.savePasswordBtn,
                  (!newEmail.trim() || updatingEmail) && styles.disabledBtn,
                ]}
                onPress={handleChangeEmail}
                disabled={!newEmail.trim() || updatingEmail}
              >
                {updatingEmail ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.savePasswordBtnText}>Send Link</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── SAVED POSTS (BOOKMARKS) MODAL ── */}
      <Modal visible={showSavedPostsModal} animationType="slide">
        <View style={[styles.container, { backgroundColor: themeColors.background }]}>
          <View style={[styles.header, { paddingHorizontal: 20, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: themeColors.surfaceBorder, paddingBottom: 14 }]}>
            <TouchableOpacity
              onPress={() => setShowSavedPostsModal(false)}
              style={[styles.backBtn, { backgroundColor: themeColors.surface }]}
            >
              <ArrowLeft size={22} color={themeColors.text} />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Bookmark size={20} color={colors.brand} />
              <Text style={[styles.headerTitle, { color: themeColors.text }]}>Saved Voices</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 80 }}>
            {loadingSaved ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.brand} />
                <Text style={{ marginTop: 12, fontSize: 13, color: themeColors.textSecondary }}>Loading saved voices…</Text>
              </View>
            ) : savedPosts.length === 0 ? (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 24 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Bookmark size={28} color={colors.brand} />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: themeColors.text, marginBottom: 6 }}>No Saved Voices</Text>
                <Text style={{ fontSize: 13, color: themeColors.textSecondary, textAlign: 'center', lineHeight: 18 }}>
                  Tap the bookmark icon on any voice or post to save it here for later.
                </Text>
              </View>
            ) : (
              savedPosts.map((item) => (
                <MobilePostCard
                  key={item.id}
                  post={item}
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
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  content: { padding: 20, paddingBottom: 100, gap: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, marginTop: 12 },
  backBtn: { padding: 8, borderRadius: 20, backgroundColor: '#ffffff' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.gray900 },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.gray200,
    gap: 12,
  },
  sectionCategoryTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gray400,
    letterSpacing: 0.8,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
    paddingBottom: 6,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  rowItemNoClick: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  rowItemNoClickSub: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingLeft: 26,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray800,
  },
  rowSubLabel: {
    fontSize: 11,
    color: colors.gray400,
    marginTop: 1,
  },
  valueText: {
    fontSize: 13,
    color: colors.gray500,
    fontWeight: '500',
  },
  themeCardsRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 6,
  },
  themeCard: {
    flex: 1,
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  themeCardActive: {
    borderWidth: 2,
  },
  themePreviewBox: {
    width: '100%',
    height: 60,
    borderRadius: 10,
    borderWidth: 1,
    padding: 6,
    justifyContent: 'space-between',
    marginBottom: 8,
    overflow: 'hidden',
  },
  splitPreviewBox: {
    flexDirection: 'row',
    padding: 0,
  },
  splitHalf: {
    flex: 1,
    height: '100%',
    padding: 6,
    justifyContent: 'space-between',
  },
  previewHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  previewDotMini: {
    width: 14,
    height: 4,
    borderRadius: 2,
  },
  previewPillMini: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  previewLineMini: {
    width: '100%',
    height: 3,
    borderRadius: 1.5,
    marginVertical: 1.5,
  },
  previewActionMini: {
    width: 18,
    height: 5,
    borderRadius: 2.5,
  },
  themeCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeCardLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  radioIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioIndicatorInner: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#ffffff',
  },
  optionsGroup: { flexDirection: 'row', gap: 8, marginVertical: 4 },
  optionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 8,
    alignItems: 'center',
  },
  optionBtnActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  optionText: { fontSize: 12, fontWeight: '600', color: colors.gray700 },
  optionTextActive: { color: '#ffffff' },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    paddingTop: 10,
    marginTop: 4,
  },
  versionLabel: { fontSize: 12, color: colors.gray400 },
  versionVal: { fontSize: 12, color: colors.gray500, fontFamily: 'monospace' },
  bottomActionsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    gap: 12,
  },
  logoutAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fffbe6',
    borderWidth: 1,
    borderColor: '#fef08a',
    borderRadius: 14,
    paddingVertical: 14,
  },
  logoutAllText: { fontSize: 14, fontWeight: '700', color: '#d97706' },
  deleteAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 14,
    paddingVertical: 14,
  },
  deleteAccountText: { fontSize: 14, fontWeight: '700', color: '#ef4444' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitleRed: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ef4444',
  },
  modalBodyText: {
    fontSize: 13,
    color: colors.gray600,
    lineHeight: 18,
  },
  boldMono: {
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: colors.gray900,
  },
  deleteInput: {
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    textAlign: 'center',
    letterSpacing: 2,
    fontWeight: 'bold',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray600,
  },
  modalDangerBtn: {
    backgroundColor: '#ef4444',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  disabledBtn: {
    opacity: 0.4,
  },
  modalDangerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  categoryRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  categoryChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: colors.gray100, borderWidth: 1, borderColor: colors.gray200 },
  categoryChipActive: { backgroundColor: colors.brandLight, borderColor: colors.brand },
  categoryChipText: { fontSize: 12, color: colors.gray700, fontWeight: '500' },
  categoryChipTextActive: { color: colors.brand, fontWeight: '700' },
  bugTextArea: { borderWidth: 1, borderColor: colors.gray300, borderRadius: 12, padding: 12, fontSize: 13, minHeight: 90, textAlignVertical: 'top' },
  bugSubmitBtn: { backgroundColor: colors.brand, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 },
  bugSubmitText: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
  listUserRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  listUserName: { fontSize: 13, fontWeight: '700', color: colors.gray900 },
  listUserHandle: { fontSize: 11, color: colors.brand, fontFamily: 'monospace' },
  unblockBtn: { backgroundColor: '#fef2f2', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#fca5a5' },
  unblockBtnText: { fontSize: 12, fontWeight: '700', color: '#ef4444' },
  unmuteBtn: { backgroundColor: '#fffbe6', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#fca5a5' },
  unmuteBtnText: { fontSize: 12, fontWeight: '700', color: '#d97706' },
  changePasswordInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  changePasswordInput: {
    flex: 1,
    fontSize: 14,
  },
  savePasswordBtn: {
    backgroundColor: colors.brand,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savePasswordBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  // Search Bar styles
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.gray900,
  },
  clearSearchBtn: {
    padding: 4,
  },
  // Hub Category Pills styles
  hubScroll: {
    marginHorizontal: -4,
  },
  hubScrollContent: {
    gap: 8,
    paddingVertical: 2,
  },
  hubPillItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 6,
  },
  hubPillIconWrapper: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubPillLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray700,
  },
  // Granular Notifications styles
  sectionHeaderRowFlex: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
    paddingBottom: 6,
  },
  badgePillSmall: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgePillTextSmall: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3b82f6',
  },
  masterNotifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  iconCircleBrand: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subGroupHeading: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gray400,
    letterSpacing: 0.6,
    marginTop: 10,
    marginBottom: 4,
  },
  subGroupCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 6,
    gap: 4,
  },
  rowSubLabelTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray800,
  },
  rowSubLabelMuted: {
    fontSize: 11,
    color: colors.gray400,
  },
  // Active Sessions styles
  currentDeviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 14,
    padding: 12,
    marginVertical: 10,
  },
  deviceIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionDeviceName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gray900,
  },
  thisDeviceBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  thisDeviceBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
  },
  sessionDeviceSub: {
    fontSize: 11,
    color: colors.gray500,
    marginTop: 2,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  sessionSecurityCard: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  sessionSecurityText: {
    flex: 1,
    fontSize: 11,
    color: colors.gray600,
    lineHeight: 16,
  },
  modalActionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
})


