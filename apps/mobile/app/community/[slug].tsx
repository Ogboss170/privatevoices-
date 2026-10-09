import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Share,
  Animated as RNAnimated,
  Image,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  ArrowLeft,
  Search,
  Settings2,
  Users,
  Lock,
  Globe,
  Check,
  Plus,
  Settings,
  Shield,
  X,
  Send,
  Pin,
  Share2,
  Flag,
  Bell,
  BellOff,
  UserMinus,
  LogOut,
  FileText,
  BarChart2,
  ImageIcon,
  ChevronDown,
  VolumeX,
} from 'lucide-react-native'
import { Image as ExpoImage } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../../lib/supabase'
import { colors } from '../../constants/colors'
import { MobilePostCard } from '../../components/MobilePostCard'
import { PublicProfileModal } from '../../components/PublicProfileModal'
import type { Post } from '@private-voices/shared'

// ─── Settings sheet options ──────────────────────────────────────────────────
const MEMBER_SETTINGS = [
  { id: 'my_posts',     Icon: FileText,   label: 'My Posts',           sub: 'Manage posts you made in this group', color: '#3b82f6' },
  { id: 'pending',      Icon: Settings,   label: 'Pending Posts',      sub: 'View posts awaiting approval',        color: '#f59e0b' },
  { id: 'pin',          Icon: Pin,        label: 'Pin Community',      sub: 'Pin to top of your community list',   color: '#8b5cf6' },
  { id: 'share',        Icon: Share2,     label: 'Share Community',    sub: 'Invite friends to this group',        color: '#10b981' },
  { id: 'notifications',Icon: Bell,       label: 'Manage Notifications',sub: 'Control what alerts you receive',    color: '#06b6d4' },
  { id: 'report',       Icon: Flag,       label: 'Report Community',   sub: 'Report rule violations',              color: '#ef4444', danger: true },
  { id: 'unfollow',     Icon: UserMinus,  label: 'Unfollow Group',     sub: 'Stop seeing this group in your feed',color: '#f97316', danger: true },
  { id: 'leave',        Icon: LogOut,     label: 'Leave Community',    sub: 'You can rejoin later',                color: '#ef4444', danger: true },
]

export default function CommunityDetailScreen() {
  const params = useLocalSearchParams()
  const slug   = params.slug as string
  const router = useRouter()

  const [community, setCommunity]           = useState<any | null>(null)
  const [activeTab, setActiveTab]           = useState<'posts' | 'about' | 'members' | 'manage'>('posts')
  const [members, setMembers]               = useState<any[]>([])
  const [posts, setPosts]                   = useState<Post[]>([])
  const [loading, setLoading]               = useState(true)
  const [membershipStatus, setMembershipStatus] = useState<'none' | 'pending' | 'member'>('none')
  const [userRole, setUserRole]             = useState<'owner' | 'moderator' | 'member' | null>(null)
  const [currentUserId, setCurrentUserId]   = useState<string | null>(null)
  const [isPinned, setIsPinned]             = useState(false)
  const [notifEnabled, setNotifEnabled]     = useState(true)

  // Search
  const [searchQuery, setSearchQuery]       = useState('')
  const [searchActive, setSearchActive]     = useState(false)

  // Settings sheet
  const [settingsVisible, setSettingsVisible] = useState(false)
  const sheetAnim = useRef(new RNAnimated.Value(400)).current

  // Post composer
  const [newPostContent, setNewPostContent] = useState('')
  const [posting, setPosting]               = useState(false)
  const [composerImages, setComposerImages] = useState<string[]>([])
  const [showPoll, setShowPoll]             = useState(false)
  const [pollOptions, setPollOptions]       = useState(['', ''])

  // Edit settings (owner/mod)
  const [editDesc, setEditDesc]             = useState('')
  const [editCoverUrl, setEditCoverUrl]     = useState('')
  const [editPrivacy, setEditPrivacy]       = useState<'public' | 'private'>('public')
  const [savingSettings, setSavingSettings] = useState(false)

  // Public Profile Modal
  const [selectedProfileTarget, setSelectedProfileTarget] = useState<{ userId?: string; username?: string } | null>(null)

  // Rules state
  const [rules, setRules] = useState<any[]>([])
  const [editingRules, setEditingRules] = useState<any[]>([])
  const [savingRules, setSavingRules] = useState(false)

  // Mutes state
  const [mutes, setMutes] = useState<any[]>([])
  const [isMuted, setIsMuted] = useState(false)
  const [muteTargetMember, setMuteTargetMember] = useState<any | null>(null)
  const [muteReason, setMuteReason] = useState('')
  const [muteDuration, setMuteDuration] = useState<'1_day' | '7_days' | '30_days' | 'indefinite'>('7_days')
  const [mutingBusy, setMutingBusy] = useState(false)

  // ── Settings sheet animation ─────────────────────────────────────────────────
  function openSettings() {
    setSettingsVisible(true)
    RNAnimated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 180 }).start()
  }
  function closeSettings() {
    RNAnimated.timing(sheetAnim, { toValue: 400, duration: 220, useNativeDriver: true }).start(() =>
      setSettingsVisible(false)
    )
  }

  // ── Data fetching ─────────────────────────────────────────────────────────────
  const fetchCommunityData = useCallback(async () => {
    setLoading(true)
    const { data: userRes } = await supabase.auth.getUser()
    const uId = userRes?.user?.id || null
    setCurrentUserId(uId)

    const { data: comm, error: commErr } = await supabase
      .from('communities')
      .select('*')
      .eq('slug', slug)
      .single()

    if (commErr || !comm) { setLoading(false); return }

    setCommunity(comm)
    setEditDesc(comm.description || '')
    setEditCoverUrl(comm.avatar_url || '')
    setEditPrivacy(comm.privacy || 'public')

    const customRules = Array.isArray(comm.rules) && comm.rules.length > 0 ? comm.rules : [
      { id: 1, title: 'Be respectful', desc: 'Treat all members with courtesy and kindness.' },
      { id: 2, title: 'No harassment or hate speech', desc: 'Bullying, discrimination, and hate speech are strictly prohibited.' },
      { id: 3, title: 'Stay on topic', desc: 'Keep posts relevant to the community category and purpose.' },
      { id: 4, title: 'No spam or self-promotion', desc: 'Avoid unauthorized advertising or duplicate postings.' },
    ]
    setRules(customRules)
    setEditingRules(customRules)

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

    // Members
    let { data: mems } = await supabase
      .from('community_members')
      .select('*, user:profiles!community_members_user_id_fkey(id, username, display_name, avatar_url)')
      .eq('community_id', comm.id)

    if (!mems || mems.length === 0) {
      const fallback = await supabase.from('community_members').select('*').eq('community_id', comm.id)
      if (fallback.data?.length) {
        const uIds = fallback.data.map((m: any) => m.user_id)
        const { data: profs } = await supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', uIds)
        const pMap = new Map((profs ?? []).map((p: any) => [p.id, p]))
        setMembers(fallback.data.map((m: any) => ({ ...m, user: pMap.get(m.user_id) })))
      } else {
        setMembers([])
      }
    } else {
      setMembers(mems)
    }

    // Mutes
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

    // Posts (pinned posts stay at top)
    let { data: rawPosts } = await supabase
      .from('posts')
      .select('*, author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url)')
      .eq('community_id', comm.id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (!rawPosts) {
      const fb = await supabase.from('posts').select('*').eq('community_id', comm.id).order('is_pinned', { ascending: false }).order('created_at', { ascending: false })
      rawPosts = fb.data
    }

    if (rawPosts && rawPosts.length > 0) {
      const authorIds = Array.from(new Set(rawPosts.map((p: any) => p.author_id)))
      const { data: profList } = await supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', authorIds)
      const profileMap = new Map((profList ?? []).map((prof: any) => [prof.id, prof]))

      const formatted: Post[] = await Promise.all(
        rawPosts.map(async (p: any) => {
          let likeCount = 0, commentCount = 0
          try {
            const [{ count: lc }, { count: cc }] = await Promise.all([
              supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
              supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
            ])
            likeCount    = lc ?? 0
            commentCount = cc ?? 0
          } catch {}
          const ad = p.author || profileMap.get(p.author_id)
          return {
            id: p.id, authorId: p.author_id,
            author: { id: ad?.id || p.author_id, username: ad?.username || 'user', displayName: ad?.display_name || 'User', avatarUrl: ad?.avatar_url || null },
            content: p.content, imageUrls: p.image_urls ?? [], hashtags: [],
            likeCount, commentCount, repostCount: 0,
            isLikedByMe: false, isSavedByMe: false, isRepostedByMe: false,
            isPinned: p.is_pinned || false,
            pinnedAt: p.pinned_at || null,
            pinnedBy: p.pinned_by || null,
            createdAt: p.created_at, updatedAt: p.updated_at,
          }
        })
      )
      setPosts(formatted)
    } else {
      setPosts([])
    }

    setLoading(false)
  }, [slug])

  useEffect(() => { fetchCommunityData() }, [fetchCommunityData])

  // ── Join / Leave ──────────────────────────────────────────────────────────────
  async function handleJoinLeave() {
    if (!currentUserId) { Alert.alert('Login Required', 'Please log in to join communities.'); return }
    if (!community) return

    if (membershipStatus === 'member' || membershipStatus === 'pending') {
      await supabase.from('community_members').delete().match({ community_id: community.id, user_id: currentUserId })
      setMembershipStatus('none'); setUserRole(null)
      fetchCommunityData()
    } else {
      const status = community.privacy === 'private' ? 'pending' : 'member'
      const { error } = await supabase.from('community_members')
        .insert({ community_id: community.id, user_id: currentUserId, role: 'member', status })

      if (!error && community.creator_id && community.creator_id !== currentUserId) {
        await supabase.from('notifications').insert({
          recipient_id: community.creator_id, actor_id: currentUserId,
          type: 'community_join', title: 'New Community Member 📌',
          message: `joined ${community.name}.`, entity_type: 'community',
          entity_id: community.id, is_read: false,
        })
      }

      setMembershipStatus(status === 'pending' ? 'pending' : 'member')
      if (status === 'member') setUserRole('member')
      fetchCommunityData()
    }
  }

  // ── Settings sheet actions ───────────────────────────────────────────────────
  async function handleSettingsOption(id: string) {
    closeSettings()
    await new Promise((r) => setTimeout(r, 250))

    switch (id) {
      case 'my_posts':
        Alert.alert('My Posts', 'Showing posts you created in this community.')
        break
      case 'pending':
        Alert.alert('Pending Posts', 'No posts pending approval right now.')
        break
      case 'pin':
        setIsPinned((v) => !v)
        Alert.alert(isPinned ? 'Unpinned' : 'Pinned', isPinned ? 'Community removed from pinned.' : 'Community pinned to top of your list.')
        break
      case 'share':
        await Share.share({ message: `Join me in the ${community?.name} community on Private Voices!\n\nhttps://privatevoices.app/community/${community?.slug}` })
        break
      case 'notifications':
        setNotifEnabled((v) => !v)
        Alert.alert('Notifications', notifEnabled ? 'Notifications turned off for this community.' : 'Notifications turned on.')
        break
      case 'report':
        Alert.alert('Report Community', 'Why are you reporting this community?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Spam', onPress: () => Alert.alert('Reported', 'Thank you. We will review this community.') },
          { text: 'Hateful content', onPress: () => Alert.alert('Reported', 'Thank you. We will review this community.') },
          { text: 'Other', onPress: () => Alert.alert('Reported', 'Thank you. We will review this community.') },
        ])
        break
      case 'unfollow':
        Alert.alert('Unfollow Group', `Stop seeing ${community?.name} posts in your feed?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Unfollow', style: 'destructive', onPress: () => Alert.alert('Done', 'You will no longer see posts from this group in your feed.') },
        ])
        break
      case 'leave':
        Alert.alert('Leave Community', `Leave ${community?.name}? You can rejoin later.`, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Leave', style: 'destructive',
            onPress: async () => {
              if (!currentUserId || !community) return
              await supabase.from('community_members').delete().match({ community_id: community.id, user_id: currentUserId })
              setMembershipStatus('none'); setUserRole(null)
              router.back()
            },
          },
        ])
        break
    }
  }

  // ── Composer: image picker ────────────────────────────────────────────────────
  async function pickComposerImage() {
    if (composerImages.length >= 4) { Alert.alert('Limit', 'Max 4 images per post.'); return }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) { Alert.alert('Permission required', 'Allow access to your photo library.'); return }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.8 })
    if (!result.canceled) {
      setComposerImages((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, 4))
    }
  }

  // ── Composer: post ───────────────────────────────────────────────────────────
  async function handlePost() {
    if (!newPostContent.trim() && composerImages.length === 0) return
    if (!currentUserId || !community) return

    if (isMuted) {
      Alert.alert('Posting Restricted', 'You are currently muted in this community and cannot share new posts.')
      return
    }

    setPosting(true)

    let finalContent = newPostContent.trim()
    const validPollOpts = pollOptions.filter((o) => o.trim())
    if (showPoll && validPollOpts.length >= 2) {
      finalContent += '\n\n📊 Poll:\n' + validPollOpts.map((o, i) => `${i + 1}. ${o.trim()}`).join('\n')
    }

    // Upload images
    let uploadedUrls: string[] = []
    for (let i = 0; i < composerImages.length; i++) {
      try {
        const uri = composerImages[i]
        const ext = uri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg'
        const fileName = `${currentUserId}/${Date.now()}_${i}.${ext}`
        const response = await fetch(uri)
        const blob = await response.blob()
        const buf = await new Response(blob).arrayBuffer()
        const { error: upErr } = await supabase.storage.from('post-media').upload(fileName, buf, {
          contentType: `image/${ext === 'png' ? 'png' : ext === 'webp' ? 'webp' : 'jpeg'}`, upsert: true,
        })
        if (!upErr) {
          const { data: pub } = supabase.storage.from('post-media').getPublicUrl(fileName)
          uploadedUrls.push(pub.publicUrl)
        }
      } catch {}
    }

    const { data: newPost, error } = await supabase.from('posts')
      .insert({ author_id: currentUserId, community_id: community.id, content: finalContent || 'Voice attachment', image_urls: uploadedUrls })
      .select('id').single()

    if (!error && newPost && showPoll && validPollOpts.length >= 2) {
      const { data: newPoll } = await supabase.from('polls')
        .insert({ post_id: newPost.id, question: newPostContent.trim() || 'Community Poll' })
        .select('id').single()
      if (newPoll) {
        await supabase.from('poll_options').insert(validPollOpts.map((opt, idx) => ({ poll_id: newPoll.id, option_text: opt.trim(), option_order: idx, vote_count: 0 })))
      }
    }

    setPosting(false)
    if (error) { Alert.alert('Post Failed', error.message) } else {
      setNewPostContent(''); setComposerImages([]); setShowPoll(false); setPollOptions(['', ''])
      fetchCommunityData()
    }
  }

  // ── Filtered posts ───────────────────────────────────────────────────────────
  const filteredPosts = searchQuery.trim()
    ? posts.filter((p) => p.content?.toLowerCase().includes(searchQuery.toLowerCase()) || p.author?.displayName?.toLowerCase().includes(searchQuery.toLowerCase()))
    : posts

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={colors.brand} /></View>
  }
  if (!community) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Community Not Found</Text>
          <TouchableOpacity style={styles.backBtnAction} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* ── Top Bar ─────────────────────────────────────────────────────── */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <ArrowLeft size={20} color={colors.gray800} />
          </TouchableOpacity>

          {searchActive ? (
            <View style={styles.searchBar}>
              <Search size={15} color={colors.gray400} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search posts..."
                placeholderTextColor={colors.gray400}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchActive(false) }}>
                <X size={15} color={colors.gray500} />
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.topBarTitle} numberOfLines={1}>{community.name}</Text>
          )}

          <View style={styles.topBarRight}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setSearchActive((v) => !v)}>
              <Search size={20} color={colors.gray700} />
            </TouchableOpacity>
            {membershipStatus === 'member' && (
              <TouchableOpacity style={styles.iconBtn} onPress={openSettings}>
                <Settings2 size={20} color={colors.gray700} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Facebook-style community header ─────────────────────────────── */}
        <View style={styles.fbHeaderCard}>
          <View style={styles.coverWrapper}>
            {community.cover_url ? (
              <ExpoImage source={{ uri: community.cover_url }} style={styles.coverImg} contentFit="cover" />
            ) : (
              <View style={styles.defaultCoverBanner}>
                <Text style={styles.defaultCoverText}>{community.name}</Text>
              </View>
            )}
            <View style={styles.avatarOverlapping}>
              {community.avatar_url ? (
                <ExpoImage source={{ uri: community.avatar_url }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarText}>{community.name.charAt(0).toUpperCase()}</Text>
              )}
            </View>
          </View>

          <View style={styles.fbHeaderBody}>
            <View style={styles.row}>
              <Text style={styles.name}>{community.name}</Text>
              {community.privacy === 'private'
                ? <Lock size={16} color="#d97706" />
                : <Globe size={16} color="#059669" />}
              {isPinned && <Pin size={14} color={colors.brand} />}
            </View>
            <Text style={styles.slug}>
              {community.privacy === 'private' ? 'Private Group' : 'Public Group'} • {members.length} members
            </Text>
            {community.description && <Text style={styles.desc}>{community.description}</Text>}

            {/* Action Bar */}
            <View style={styles.fbActionGroup}>
              <TouchableOpacity
                style={[styles.joinBtn, membershipStatus === 'member' && styles.joinedBtn, { flex: 1 }]}
                onPress={handleJoinLeave}
              >
                {membershipStatus === 'member' ? (
                  <View style={styles.btnRow}><Check size={16} color={colors.gray700} /><Text style={styles.joinedBtnText}>Joined</Text></View>
                ) : (
                  <View style={styles.btnRow}><Plus size={16} color="#ffffff" /><Text style={styles.joinBtnText}>+ Join Group</Text></View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.inviteBtn}
                onPress={() => Share.share({ message: `Join ${community.name} on Private Voices!\nhttps://privatevoices.app/community/${community.slug}` })}
              >
                <Share2 size={14} color={colors.gray800} />
                <Text style={styles.inviteBtnText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Tab row ─────────────────────────────────────────────────────── */}
        <View style={styles.tabRow}>
          {(['posts', 'about', 'members'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'members' ? `Members (${members.length})` : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
          {(userRole === 'owner' || userRole === 'moderator') && (
            <TouchableOpacity
              style={[styles.tab, activeTab === 'manage' && styles.tabActive]}
              onPress={() => setActiveTab('manage')}
            >
              <Text style={[styles.tabText, activeTab === 'manage' && styles.tabTextActive]}>Manage</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Tab: Posts ──────────────────────────────────────────────────── */}
        {activeTab === 'posts' && (
          <View style={{ gap: 12 }}>
            {/* Search result banner */}
            {searchQuery.trim() !== '' && (
              <View style={styles.searchBanner}>
                <Search size={13} color={colors.brand} />
                <Text style={styles.searchBannerText}>{filteredPosts.length} result{filteredPosts.length !== 1 ? 's' : ''} for "{searchQuery}"</Text>
              </View>
            )}

            {/* Inline composer for members */}
            {membershipStatus === 'member' && (
              isMuted ? (
                <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
                  <VolumeX size={20} color="#b45309" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#92400e' }}>Posting Restricted</Text>
                    <Text style={{ fontSize: 11, color: '#b45309', marginTop: 2 }}>You are currently muted in this community by a moderator.</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.card}>
                  <TextInput
                    style={styles.composerInput}
                    multiline
                    placeholder={`Share something in ${community.name}...`}
                    placeholderTextColor={colors.gray400}
                    value={newPostContent}
                    onChangeText={setNewPostContent}
                  />

                  {/* Image previews */}
                  {composerImages.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                      {composerImages.map((uri, idx) => (
                        <View key={idx} style={styles.imgPreviewWrap}>
                          <Image source={{ uri }} style={styles.imgPreview} />
                          <TouchableOpacity style={styles.imgRemoveBtn} onPress={() => setComposerImages((prev) => prev.filter((_, i) => i !== idx))}>
                            <X size={11} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  )}

                  {/* Poll inputs */}
                  {showPoll && (
                    <View style={styles.pollCard}>
                      <View style={styles.pollHeader}>
                        <Text style={styles.pollTitle}>📊 Poll</Text>
                        <TouchableOpacity onPress={() => { setShowPoll(false); setPollOptions(['', '']) }}>
                          <X size={14} color={colors.gray500} />
                        </TouchableOpacity>
                      </View>
                      {pollOptions.map((opt, idx) => (
                        <TextInput
                          key={idx}
                          style={styles.pollInput}
                          placeholder={`Option ${idx + 1}`}
                          placeholderTextColor={colors.gray400}
                          value={opt}
                          onChangeText={(v) => {
                            const next = [...pollOptions]; next[idx] = v; setPollOptions(next)
                          }}
                        />
                      ))}
                      {pollOptions.length < 4 && (
                        <TouchableOpacity onPress={() => setPollOptions([...pollOptions, ''])}>
                          <Text style={styles.addPollOption}>+ Add option</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* Composer toolbar */}
                  <View style={styles.composerToolbar}>
                    <TouchableOpacity style={styles.toolBtn} onPress={pickComposerImage}>
                      <ImageIcon size={19} color={colors.gray500} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.toolBtn} onPress={() => setShowPoll((v) => !v)}>
                      <BarChart2 size={19} color={showPoll ? colors.brand : colors.gray500} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.postBtn, (!newPostContent.trim() && composerImages.length === 0) || posting ? { opacity: 0.45 } : null]}
                      disabled={(!newPostContent.trim() && composerImages.length === 0) || posting}
                      onPress={handlePost}
                    >
                      {posting
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <View style={styles.btnRow}><Send size={13} color="#fff" /><Text style={styles.postBtnText}>Post</Text></View>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              )
            )}

            {filteredPosts.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>{searchQuery.trim() ? 'No matching posts' : 'No community voices yet'}</Text>
                <Text style={styles.emptyBody}>{searchQuery.trim() ? 'Try a different search term.' : 'Be the first to share a post here.'}</Text>
              </View>
            ) : (
              filteredPosts.map((post) => (
                <MobilePostCard
                  key={post.id}
                  post={post}
                  currentUserId={currentUserId || undefined}
                  communityRole={userRole}
                  onTogglePin={() => {
                    fetchCommunityData()
                  }}
                  onPressAuthor={(id) => setSelectedProfileTarget({ userId: id })}
                  onPressMention={(u) => setSelectedProfileTarget({ username: u })}
                />
              ))
            )}
          </View>
        )}

        {/* ── Tab: About ──────────────────────────────────────────────────── */}
        {activeTab === 'about' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>About {community.name}</Text>
            <Text style={styles.descText}>{community.description || 'Welcome to this community! Share posts, discuss ideas, and connect.'}</Text>

            <Text style={[styles.cardTitle, { marginTop: 14 }]}>Community Guidelines</Text>
            {rules.map((rule, i) => (
              <View key={rule.id || i} style={{ marginBottom: 10 }}>
                <Text style={styles.ruleItem}>{i + 1}. {rule.title}</Text>
                {rule.desc ? <Text style={[styles.descText, { marginLeft: 16, marginTop: 2, fontSize: 13 }]}>{rule.desc}</Text> : null}
              </View>
            ))}
          </View>
        )}

        {/* ── Tab: Members ────────────────────────────────────────────────── */}
        {activeTab === 'members' && (
          <View style={styles.card}>
            {members.length === 0 ? (
              <Text style={styles.emptyBody}>No members listed yet.</Text>
            ) : (
              members.map((m) => {
                const u = m.user
                const displayName = u?.display_name || u?.username || 'Member'
                const username    = u?.username || 'user'
                const memberId    = u?.id || m.user_id
                return (
                  <TouchableOpacity key={m.id || memberId} style={styles.memberRow} onPress={() => memberId && setSelectedProfileTarget({ userId: memberId })} activeOpacity={0.7}>
                    <View style={styles.memberAvatar}>
                      {u?.avatar_url
                        ? <ExpoImage source={{ uri: u.avatar_url }} style={styles.memberAvatarImg} />
                        : <Text style={styles.memberAvatarText}>{displayName.charAt(0).toUpperCase()}</Text>
                      }
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{displayName}</Text>
                      <Text style={styles.memberHandle}>@{username}</Text>
                    </View>
                    <Text style={styles.roleTag}>{m.role || 'Member'}</Text>
                  </TouchableOpacity>
                )
              })
            )}
          </View>
        )}

        {/* ── Tab: Manage (owner/mod) ──────────────────────────────────────── */}
        {activeTab === 'manage' && (userRole === 'owner' || userRole === 'moderator') && (
          <View style={{ gap: 14 }}>
            {/* Settings card */}
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Settings size={18} color={colors.brand} />
                <Text style={styles.cardTitle}>Community Settings</Text>
              </View>

              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput style={[styles.fieldInput, { minHeight: 60 }]} multiline value={editDesc} onChangeText={setEditDesc} placeholder="Describe your community..." placeholderTextColor={colors.gray400} />

              <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Cover / Avatar URL</Text>
              <TextInput style={styles.fieldInput} value={editCoverUrl} onChangeText={setEditCoverUrl} placeholder="https://..." placeholderTextColor={colors.gray400} />

              <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Privacy</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                {(['public', 'private'] as const).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.privacyBtn, editPrivacy === p && styles.privacyBtnActive]}
                    onPress={() => setEditPrivacy(p)}
                  >
                    <Text style={[styles.privacyBtnText, editPrivacy === p && styles.privacyBtnTextActive]}>
                      {p === 'public' ? '🌐 Public' : '🔒 Private'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={[styles.joinBtn, savingSettings && { opacity: 0.5 }]} disabled={savingSettings} onPress={async () => {
                if (!community) return
                setSavingSettings(true)
                const { error } = await supabase.from('communities').update({ description: editDesc.trim(), avatar_url: editCoverUrl.trim() || null, privacy: editPrivacy }).eq('id', community.id)
                setSavingSettings(false)
                error ? Alert.alert('Update Failed', error.message) : Alert.alert('Saved', 'Community settings updated.') ; fetchCommunityData()
              }}>
                <Text style={styles.joinBtnText}>{savingSettings ? 'Saving...' : 'Save Settings'}</Text>
              </TouchableOpacity>
            </View>

            {/* Role management */}
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Shield size={18} color={colors.brand} />
                <Text style={styles.cardTitle}>Member Roles & Moderation</Text>
              </View>
              <Text style={[styles.descText, { marginBottom: 12 }]}>Promote members to Moderator or remove them.</Text>

              {members.filter((m) => m.role !== 'owner').map((m) => {
                const u = m.user
                const displayName = u?.display_name || u?.username || 'Member'
                const username    = u?.username || 'user'
                return (
                  <View key={m.id || m.user_id} style={[styles.memberRow, { paddingVertical: 8 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{displayName}</Text>
                      <Text style={styles.memberHandle}>@{username} • {m.role}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {userRole === 'owner' && (
                        <TouchableOpacity
                          style={[styles.modBtn, { backgroundColor: m.role === 'moderator' ? colors.gray200 : '#f3e8ff' }]}
                          onPress={async () => {
                            const newRole = m.role === 'moderator' ? 'member' : 'moderator'
                            await supabase.from('community_members').update({ role: newRole }).match({ community_id: community.id, user_id: m.user_id })
                            fetchCommunityData()
                          }}
                        >
                          <Text style={[styles.modBtnText, { color: m.role === 'moderator' ? colors.gray800 : '#7e22ce' }]}>
                            {m.role === 'moderator' ? 'Demote' : 'Make Mod'}
                          </Text>
                        </TouchableOpacity>
                      )}
                      {/* Mute / Unmute Button */}
                      {(userRole === 'owner' || userRole === 'moderator') && m.role === 'member' && (
                        (() => {
                          const isMemberMuted = mutes.some((mu) => mu.user_id === m.user_id)
                          return isMemberMuted ? (
                            <TouchableOpacity
                              style={[styles.modBtn, { backgroundColor: '#fef3c7' }]}
                              onPress={() => {
                                Alert.alert('Unmute Member', `Unmute @${username}?`, [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Unmute',
                                    onPress: async () => {
                                      await supabase
                                        .from('community_mutes')
                                        .delete()
                                        .match({ community_id: community.id, user_id: m.user_id })
                                      fetchCommunityData()
                                    },
                                  },
                                ])
                              }}
                            >
                              <Text style={[styles.modBtnText, { color: '#b45309' }]}>Unmute</Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              style={[styles.modBtn, { backgroundColor: colors.gray100 }]}
                              onPress={() => {
                                setMuteTargetMember(m)
                                setMuteReason('')
                              }}
                            >
                              <Text style={[styles.modBtnText, { color: colors.gray700 }]}>Mute</Text>
                            </TouchableOpacity>
                          )
                        })()
                      )}

                      {(userRole === 'owner' || (userRole === 'moderator' && m.role === 'member')) && (
                        <TouchableOpacity
                          style={{ padding: 6, backgroundColor: '#fef2f2', borderRadius: 8 }}
                          onPress={() => Alert.alert('Remove Member', `Remove @${username}?`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Remove', style: 'destructive', onPress: async () => {
                              await supabase.from('community_members').delete().match({ community_id: community.id, user_id: m.user_id })
                              fetchCommunityData()
                            }},
                          ])}
                        >
                          <X size={14} color="#ef4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )
              })}
            </View>

            {/* Rules Editor (Owner Only) */}
            {userRole === 'owner' && (
              <View style={styles.card}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Settings size={18} color={colors.brand} />
                    <Text style={styles.cardTitle}>Community Rules Editor</Text>
                  </View>
                  <TouchableOpacity
                    style={{ backgroundColor: '#f0fdf4', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}
                    onPress={() => {
                      const newId = editingRules.length > 0 ? Math.max(...editingRules.map((r: any) => Number(r.id) || 0)) + 1 : 1
                      setEditingRules([...editingRules, { id: newId, title: '', desc: '' }])
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#16a34a' }}>+ Add Rule</Text>
                  </TouchableOpacity>
                </View>

                {editingRules.map((rule, index) => (
                  <View key={index} style={{ backgroundColor: '#f9fafb', borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.gray700 }}>Rule #{index + 1}</Text>
                      <TouchableOpacity onPress={() => setEditingRules(editingRules.filter((_, i) => i !== index))}>
                        <X size={14} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={[styles.fieldInput, { marginBottom: 6, backgroundColor: '#fff' }]}
                      placeholder="Rule Title"
                      placeholderTextColor={colors.gray400}
                      value={rule.title}
                      onChangeText={(t) => {
                        const updated = [...editingRules]
                        updated[index] = { ...updated[index], title: t }
                        setEditingRules(updated)
                      }}
                    />
                    <TextInput
                      style={[styles.fieldInput, { minHeight: 45, backgroundColor: '#fff' }]}
                      placeholder="Rule Details"
                      placeholderTextColor={colors.gray400}
                      multiline
                      value={rule.desc}
                      onChangeText={(d) => {
                        const updated = [...editingRules]
                        updated[index] = { ...updated[index], desc: d }
                        setEditingRules(updated)
                      }}
                    />
                  </View>
                ))}

                <TouchableOpacity
                  style={[styles.joinBtn, savingRules && { opacity: 0.5 }]}
                  disabled={savingRules}
                  onPress={async () => {
                    if (!community) return
                    setSavingRules(true)
                    const cleaned = editingRules
                      .filter((r) => r.title.trim())
                      .map((r, i) => ({ id: i + 1, title: r.title.trim(), desc: (r.desc || '').trim() }))

                    const { error } = await supabase.from('communities').update({ rules: cleaned }).eq('id', community.id)
                    setSavingRules(false)
                    if (error) {
                      Alert.alert('Save Failed', error.message)
                    } else {
                      Alert.alert('Success', 'Community rules updated!')
                      fetchCommunityData()
                    }
                  }}
                >
                  <Text style={styles.joinBtnText}>{savingRules ? 'Saving Rules...' : 'Save Rules'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Settings bottom sheet ────────────────────────────────────────────── */}
      <Modal visible={settingsVisible} transparent animationType="fade" onRequestClose={closeSettings}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeSettings}>
          <RNAnimated.View style={[styles.settingsSheet, { transform: [{ translateY: sheetAnim }] }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{community.name}</Text>
              <TouchableOpacity onPress={closeSettings} style={styles.sheetCloseBtn}>
                <X size={16} color={colors.gray500} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {MEMBER_SETTINGS.map(({ id, Icon, label, sub, color, danger }) => (
                <TouchableOpacity key={id} style={styles.settingsOption} onPress={() => handleSettingsOption(id)} activeOpacity={0.7}>
                  <View style={[styles.settingsOptionIcon, { backgroundColor: color + '18' }]}>
                    <Icon size={20} color={color} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingsOptionLabel, danger && { color: '#ef4444' }]}>{label}</Text>
                    <Text style={styles.settingsOptionSub}>{sub}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </RNAnimated.View>
        </TouchableOpacity>
      </Modal>

      {/* ── Public Profile Modal ─────────────────────────────────────────────── */}
      {selectedProfileTarget && (
        <PublicProfileModal
          visible={!!selectedProfileTarget}
          userId={selectedProfileTarget.userId}
          username={selectedProfileTarget.username}
          currentUserId={currentUserId}
          onClose={() => setSelectedProfileTarget(null)}
        />
      )}

      {/* ── Mute Member Modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={!!muteTargetMember}
        transparent
        animationType="fade"
        onRequestClose={() => setMuteTargetMember(null)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}
          activeOpacity={1}
          onPress={() => setMuteTargetMember(null)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={{ backgroundColor: '#fff', borderRadius: 18, padding: 20, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 6 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <VolumeX size={20} color="#d97706" />
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.gray900 }}>
                  Mute @{muteTargetMember?.user?.username}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setMuteTargetMember(null)}>
                <X size={18} color={colors.gray400} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: colors.gray500, marginBottom: 14 }}>
              Muted members can read posts but cannot post or comment in this community.
            </Text>

            <Text style={[styles.fieldLabel, { marginBottom: 6 }]}>Duration</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {[
                { id: '1_day', label: '24 Hours' },
                { id: '7_days', label: '7 Days' },
                { id: '30_days', label: '30 Days' },
                { id: 'indefinite', label: 'Indefinite' },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.privacyBtn,
                    muteDuration === opt.id && styles.privacyBtnActive,
                    { paddingHorizontal: 12, paddingVertical: 8 },
                  ]}
                  onPress={() => setMuteDuration(opt.id as any)}
                >
                  <Text style={[styles.privacyBtnText, muteDuration === opt.id && styles.privacyBtnTextActive, { fontSize: 12 }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { marginBottom: 6 }]}>Reason (Optional)</Text>
            <TextInput
              style={[styles.fieldInput, { minHeight: 45, marginBottom: 16 }]}
              placeholder="e.g. Unwanted advertising or insults..."
              placeholderTextColor={colors.gray400}
              value={muteReason}
              onChangeText={setMuteReason}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[styles.joinBtn, { flex: 1, backgroundColor: colors.gray100 }]}
                onPress={() => setMuteTargetMember(null)}
              >
                <Text style={[styles.joinBtnText, { color: colors.gray700 }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.joinBtn, { flex: 1, backgroundColor: '#d97706' }, mutingBusy && { opacity: 0.6 }]}
                disabled={mutingBusy}
                onPress={async () => {
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
                    Alert.alert('Mute Failed', error.message)
                  } else {
                    Alert.alert('Member Muted', `@${muteTargetMember.user?.username} is now muted.`)
                    setMuteTargetMember(null)
                    fetchCommunityData()
                  }
                }}
              >
                <Text style={styles.joinBtnText}>{mutingBusy ? 'Saving...' : 'Mute Member'}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea:     { flex: 1, backgroundColor: '#ffffff' },
  container:    { flex: 1, backgroundColor: colors.gray50 },
  content:      { padding: 16, paddingBottom: 120, gap: 16 },
  centered:     { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },

  // ── Top bar ─────────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto' as any,
  },
  iconBtn: {
    padding: 7,
    borderRadius: 10,
    backgroundColor: colors.gray100,
  },
  topBarTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.gray900,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray100,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.gray900,
    padding: 0,
  },
  searchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.brandLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.brand + '30',
  },
  searchBannerText: {
    fontSize: 13,
    color: colors.brand,
    fontWeight: '500',
  },

  // ── Facebook header ─────────────────────────────────────────────────────────
  fbHeaderCard:      { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: colors.gray200, overflow: 'hidden' },
  coverWrapper:      { height: 120, backgroundColor: colors.brandLight, position: 'relative' },
  coverImg:          { width: '100%', height: 120 },
  defaultCoverBanner:{ width: '100%', height: 120, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  defaultCoverText:  { color: '#fff', fontSize: 22, fontWeight: '800', opacity: 0.9 },
  avatarOverlapping: { position: 'absolute', bottom: -24, left: 16, width: 68, height: 68, borderRadius: 34, backgroundColor: '#fff', borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6 },
  avatarImg:         { width: 60, height: 60 },
  avatarText:        { fontSize: 26, fontWeight: '700', color: colors.brand },
  fbHeaderBody:      { padding: 16, paddingTop: 32, gap: 6 },
  row:               { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name:              { fontSize: 20, fontWeight: '700', color: colors.gray900 },
  slug:              { fontSize: 13, color: colors.brand, fontWeight: '600' },
  desc:              { fontSize: 13, color: colors.gray700, marginTop: 4, lineHeight: 18 },
  fbActionGroup:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  inviteBtn:         { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.gray100, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.gray300 },
  inviteBtnText:     { color: colors.gray800, fontWeight: '700', fontSize: 13 },

  // ── Join button ──────────────────────────────────────────────────────────────
  joinBtn:      { backgroundColor: colors.brand, paddingVertical: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  joinedBtn:    { backgroundColor: colors.gray100, borderWidth: 1, borderColor: colors.gray300 },
  btnRow:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  joinBtnText:  { color: '#fff', fontWeight: '700', fontSize: 14 },
  joinedBtnText:{ color: colors.gray700, fontWeight: '600', fontSize: 14 },

  // ── Tabs ─────────────────────────────────────────────────────────────────────
  tabRow:       { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: colors.gray200 },
  tab:          { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabActive:    { backgroundColor: colors.brand },
  tabText:      { fontSize: 12, fontWeight: '600', color: colors.gray600 },
  tabTextActive:{ color: '#fff' },

  // ── Composer ─────────────────────────────────────────────────────────────────
  card:          { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.gray200, gap: 8 },
  composerInput: { fontSize: 14, color: colors.gray900, minHeight: 64, textAlignVertical: 'top', backgroundColor: colors.gray50, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: colors.gray200 },
  composerToolbar:{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
  toolBtn:       { padding: 7, borderRadius: 8, backgroundColor: colors.gray100 },
  postBtn:       { marginLeft: 'auto' as any, backgroundColor: colors.brand, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  postBtnText:   { color: '#fff', fontSize: 13, fontWeight: '700' },

  // ── Image preview ────────────────────────────────────────────────────────────
  imgPreviewWrap:{ position: 'relative', marginRight: 8 },
  imgPreview:    { width: 72, height: 72, borderRadius: 10 },
  imgRemoveBtn:  { position: 'absolute', top: 3, right: 3, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },

  // ── Poll ─────────────────────────────────────────────────────────────────────
  pollCard:      { backgroundColor: colors.gray50, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: colors.gray200 },
  pollHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  pollTitle:     { fontSize: 13, fontWeight: '600', color: colors.gray800 },
  pollInput:     { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.gray300, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13, color: colors.gray900, marginBottom: 6 },
  addPollOption: { color: colors.brand, fontSize: 12, fontWeight: '600', textAlign: 'center', paddingVertical: 4 },

  // ── Empty ────────────────────────────────────────────────────────────────────
  emptyCard:  { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: colors.gray200, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.gray900 },
  emptyBody:  { fontSize: 13, color: colors.gray500, textAlign: 'center' },

  // ── Cards / text ─────────────────────────────────────────────────────────────
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.gray900, marginBottom: 4 },
  descText:  { fontSize: 13, color: colors.gray600, lineHeight: 18 },
  ruleItem:  { fontSize: 13, color: colors.gray700, paddingVertical: 3 },

  // ── Members ──────────────────────────────────────────────────────────────────
  memberRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  memberAvatar:     { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  memberAvatarImg:  { width: 38, height: 38 },
  memberAvatarText: { fontSize: 15, fontWeight: '700', color: colors.brand },
  memberName:       { fontSize: 14, fontWeight: '700', color: colors.gray900 },
  memberHandle:     { fontSize: 12, color: colors.gray500 },
  roleTag:          { fontSize: 11, fontWeight: '600', color: colors.brand, backgroundColor: colors.brandLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, textTransform: 'capitalize' },

  // ── Manage tab ────────────────────────────────────────────────────────────────
  fieldLabel:       { fontSize: 12, fontWeight: '700', color: colors.gray700, marginBottom: 4 },
  fieldInput:       { backgroundColor: colors.gray50, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: colors.gray200, fontSize: 14, color: colors.gray900, marginBottom: 4 },
  privacyBtn:       { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.gray100, alignItems: 'center' },
  privacyBtnActive: { backgroundColor: colors.brandLight, borderWidth: 1, borderColor: colors.brand },
  privacyBtnText:   { fontSize: 13, fontWeight: '600', color: colors.gray700 },
  privacyBtnTextActive: { color: colors.brand },
  modBtn:           { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  modBtnText:       { fontSize: 11, fontWeight: '700' },

  // ── Settings sheet ────────────────────────────────────────────────────────────
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  settingsSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 20, paddingBottom: 36, maxHeight: '85%', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 24 },
  sheetHandle:   { width: 36, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb', alignSelf: 'center', marginBottom: 16 },
  sheetHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle:    { fontSize: 17, fontWeight: '700', color: colors.gray900 },
  sheetCloseBtn: { padding: 6, borderRadius: 10, backgroundColor: colors.gray100 },
  settingsOption:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f3f4f6' },
  settingsOptionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  settingsOptionLabel:{ fontSize: 15, fontWeight: '600', color: colors.gray900 },
  settingsOptionSub:  { fontSize: 12, color: colors.gray400, marginTop: 1 },

  // ── Back button ───────────────────────────────────────────────────────────────
  backBtnAction: { marginTop: 12, backgroundColor: colors.brand, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  backBtnText:   { color: '#fff', fontWeight: 'bold', fontSize: 13 },
})
