import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Share,
} from 'react-native'
import { Edit3, Lock, LogOut, Settings, Bookmark, LayoutGrid, Play, Repeat, UserCheck } from 'lucide-react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { colors } from '../../constants/colors'
import { EditProfileModal } from '../../components/EditProfileModal'
import { FollowListModal } from '../../components/FollowListModal'
import { MobilePostCard } from '../../components/MobilePostCard'
import { PublicProfileModal } from '../../components/PublicProfileModal'
import { UserBadgesRow } from '../../components/PlatformBadge'
import type { Post } from '@private-voices/shared'
import { extractPostMediaAndCleanContent } from '@private-voices/shared'
import type { User } from '@supabase/supabase-js'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../context/ThemeContext'

export default function ProfileScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { colors: themeColors } = useTheme()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<{
    display_name: string
    username: string
    bio: string | null
    avatar_url: string | null
    is_private: boolean
  } | null>(null)
  const [userBadges, setUserBadges] = useState<string[]>([])
  const [stats, setStats] = useState({ followerCount: 0, followingCount: 0, postCount: 0 })
  const [activeTab, setActiveTab] = useState<'posts' | 'voices' | 'reposts' | 'tagged'>('posts')
  const [posts, setPosts] = useState<Post[]>([])
  const [savedPosts, setSavedPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [followModalVisible, setFollowModalVisible] = useState(false)
  const [followModalTab, setFollowModalTab] = useState<'followers' | 'following'>('followers')
  const [selectedProfileTarget, setSelectedProfileTarget] = useState<{ userId?: string; username?: string } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) fetchProfileData(data.user.id)
    })
  }, [])

  async function fetchProfileData(userId: string) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('display_name, username, bio, avatar_url, is_private')
      .eq('id', userId)
      .single()

    const [{ count: followerCount }, { count: followingCount }, { count: postCount }] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', userId),
    ])

    setProfile(prof)
    setStats({
      followerCount: followerCount ?? 0,
      followingCount: followingCount ?? 0,
      postCount: postCount ?? 0,
    })

    try {
      const { data: bData } = await supabase
        .from('user_badges')
        .select('badge_id')
        .eq('user_id', userId)
        .is('revoked_at', null)

      if (bData) {
        setUserBadges(bData.map((b) => b.badge_id))
      }
    } catch {
      // Safe fallback
    }

    const { data: myPosts } = await supabase
      .from('posts')
      .select('*, author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url)')
      .eq('author_id', userId)
      .order('created_at', { ascending: false })

    if (myPosts) {
      const formatted: Post[] = await Promise.all(
        myPosts.map(async (p) => {
          let likeCount = 0
          let commentCount = 0
          let isLiked = false
          let isSaved = false
          try {
            const [{ count: lCount }, { count: cCount }, { data: myLike }, { data: mySave }] = await Promise.all([
              supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
              supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
              supabase.from('likes').select('user_id').match({ user_id: userId, post_id: p.id }).maybeSingle(),
              supabase.from('saved_posts').select('user_id').match({ user_id: userId, post_id: p.id }).maybeSingle(),
            ])
            likeCount = lCount ?? 0
            commentCount = cCount ?? 0
            isLiked = !!myLike
            isSaved = !!mySave
          } catch {
            // ignore
          }

          const { content: cleanContent, imageUrls } = extractPostMediaAndCleanContent(p.content, p.image_urls)
          return {
            id: p.id,
            authorId: p.author_id,
            author: {
              id: p.author?.id || p.author_id,
              username: p.author?.username || 'user',
              displayName: p.author?.display_name || 'User',
              avatarUrl: p.author?.avatar_url || null,
            },
            content: cleanContent,
            imageUrls,
            hashtags: [],
            likeCount,
            commentCount,
            repostCount: 0,
            isLikedByMe: isLiked,
            isSavedByMe: isSaved,
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
        const profileMap = new Map((profList ?? []).map((prof) => [prof.id, prof]))

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
                supabase.from('likes').select('user_id').match({ user_id: userId, post_id: p.id }).maybeSingle(),
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

    setLoading(false)
  }

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => supabase.auth.signOut(),
      },
    ])
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    )
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]} contentContainerStyle={styles.scrollContent}>
      {/* Top Header Bar with Settings Gear Icon */}
      <View style={[styles.topHeaderBar, { paddingTop: insets.top + 8 }]}>
        <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>Profile</Text>
        <TouchableOpacity
          style={[styles.settingsBtn, { backgroundColor: themeColors.surfaceBorder }]}
          onPress={() => router.push('/settings' as any)}
          accessibilityLabel="Settings"
          accessibilityRole="button"
        >
          <Settings size={22} color={themeColors.textPrimary} />
        </TouchableOpacity>
      </View>
      {/* Avatar */}
      <TouchableOpacity style={styles.avatarCircle} onPress={() => setEditModalVisible(true)} activeOpacity={0.85}>
        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
        ) : (
          <Text style={styles.avatarLetter}>
            {profile?.display_name?.charAt(0)?.toUpperCase() ?? '?'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Name & Username */}
      <View style={styles.nameGroup}>
        <View style={styles.row}>
          <Text style={[styles.displayName, { color: themeColors.textPrimary }]}>{profile?.display_name}</Text>
          <UserBadgesRow badges={userBadges} size={16} />
          {profile?.is_private && <Lock size={16} color={colors.brand} />}
        </View>
        <Text style={[styles.username, { color: themeColors.textMuted }]}>@{profile?.username}</Text>
      </View>

      {/* Bio */}
      {profile?.bio && <Text style={[styles.bio, { color: themeColors.textSecondary }]}>{profile.bio}</Text>}

      {/* Stats */}
      <View style={[styles.statsRow, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
        <View style={styles.stat}>
          <Text style={[styles.statNumber, { color: themeColors.textPrimary }]}>{stats.postCount}</Text>
          <Text style={[styles.statLabel, { color: themeColors.textMuted }]}>posts</Text>
        </View>
        <TouchableOpacity
          style={styles.stat}
          onPress={() => {
            setFollowModalTab('followers')
            setFollowModalVisible(true)
          }}
        >
          <Text style={[styles.statNumber, { color: themeColors.textPrimary }]}>{stats.followerCount}</Text>
          <Text style={[styles.statLabel, { color: themeColors.textMuted }]}>followers</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.stat}
          onPress={() => {
            setFollowModalTab('following')
            setFollowModalVisible(true)
          }}
        >
          <Text style={[styles.statNumber, { color: themeColors.textPrimary }]}>{stats.followingCount}</Text>
          <Text style={[styles.statLabel, { color: themeColors.textMuted }]}>following</Text>
        </TouchableOpacity>
      </View>

      {/* Anonymous Whisper Link Card */}
      {profile && (
        <View style={styles.whisperLinkCard}>
          <View style={styles.whisperLinkHeader}>
            <Text style={styles.whisperIcon}>🤫</Text>
            <Text style={styles.whisperTitle}>Your Anonymous Whisper Link</Text>
          </View>
          <Text style={styles.whisperSubtitle}>
            Let people send you anonymous messages. Share on WhatsApp, Instagram, X, or your bio.
          </Text>
          <View style={styles.whisperUrlRow}>
            <Text style={styles.whisperUrlText} numberOfLines={1}>
              privatevoices.app/w/@{profile.username}
            </Text>
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={() => {
                const url = `https://privatevoices.app/w/@${profile.username}`
                Share.share({
                  title: `Send an Anonymous Whisper to ${profile.display_name}`,
                  message: `Send me an anonymous Whisper on Private Voices: ${url}`,
                  url,
                })
              }}
            >
              <Text style={styles.shareBtnText}>Share Link</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 4-Tab Content Navigation: Posts | Voices | Reposts | Tagged */}
      <View style={[styles.tabBar, { borderBottomColor: themeColors.surfaceBorder }]}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'posts' && styles.tabButtonActive]}
          onPress={() => setActiveTab('posts')}
          activeOpacity={0.7}
          accessibilityLabel="Posts"
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'posts' }}
        >
          <LayoutGrid
            size={22}
            color={activeTab === 'posts' ? colors.brand : themeColors.textMuted}
            strokeWidth={activeTab === 'posts' ? 2.4 : 1.8}
          />
          {activeTab === 'posts' && <View style={styles.activeIndicator} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'voices' && styles.tabButtonActive]}
          onPress={() => setActiveTab('voices')}
          activeOpacity={0.7}
          accessibilityLabel="Voices"
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'voices' }}
        >
          <Play
            size={22}
            color={activeTab === 'voices' ? colors.brand : themeColors.textMuted}
            strokeWidth={activeTab === 'voices' ? 2.4 : 1.8}
            fill={activeTab === 'voices' ? colors.brand : 'none'}
          />
          {activeTab === 'voices' && <View style={styles.activeIndicator} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'reposts' && styles.tabButtonActive]}
          onPress={() => setActiveTab('reposts')}
          activeOpacity={0.7}
          accessibilityLabel="Reposts"
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'reposts' }}
        >
          <Repeat
            size={22}
            color={activeTab === 'reposts' ? colors.brand : themeColors.textMuted}
            strokeWidth={activeTab === 'reposts' ? 2.4 : 1.8}
          />
          {activeTab === 'reposts' && <View style={styles.activeIndicator} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'tagged' && styles.tabButtonActive]}
          onPress={() => setActiveTab('tagged')}
          activeOpacity={0.7}
          accessibilityLabel="Tagged"
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'tagged' }}
        >
          <UserCheck
            size={22}
            color={activeTab === 'tagged' ? colors.brand : themeColors.textMuted}
            strokeWidth={activeTab === 'tagged' ? 2.4 : 1.8}
          />
          {activeTab === 'tagged' && <View style={styles.activeIndicator} />}
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'posts' && (
        posts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No Voices Yet</Text>
            <Text style={styles.emptyText}>You haven't posted anything yet. Speak freely!</Text>
          </View>
        ) : (
          <View style={styles.postsList}>
            {posts.map((item) => (
              <MobilePostCard
                key={item.id}
                post={item}
                currentUserId={user?.id}
                onDelete={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
                onPressAuthor={(authorId) => setSelectedProfileTarget({ userId: authorId })}
                onPressMention={(username) => setSelectedProfileTarget({ username })}
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
          </View>
        )
      )}

      {activeTab === 'voices' && (() => {
        const voicePosts = posts.filter(
          (p) =>
            p.content?.includes('🎙️') ||
            p.content?.includes('audio') ||
            (p as any).audio_url ||
            (p as any).media_type === 'audio'
        )
        return voicePosts.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Play size={24} color={colors.brand} fill={colors.brand} />
            </View>
            <Text style={styles.emptyTitle}>No Voices Recorded</Text>
            <Text style={styles.emptyText}>Audio whispers and voice notes you record will appear here.</Text>
          </View>
        ) : (
          <View style={styles.postsList}>
            {voicePosts.map((item) => (
              <MobilePostCard
                key={item.id}
                post={item}
                currentUserId={user?.id}
                onDelete={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
                onPressAuthor={(authorId) => setSelectedProfileTarget({ userId: authorId })}
                onPressMention={(username) => setSelectedProfileTarget({ username })}
                onToggleSave={(id, isSaved) => {
                  if (!isSaved) {
                    setSavedPosts((prev) => prev.filter((p) => p.id !== id))
                  }
                }}
              />
            ))}
          </View>
        )
      })()}

      {activeTab === 'reposts' && (() => {
        const repostList = posts.filter((p) => p.isRepostedByMe)
        return repostList.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Repeat size={24} color={colors.brand} />
            </View>
            <Text style={styles.emptyTitle}>No Reposts Yet</Text>
            <Text style={styles.emptyText}>Voices and posts you repost will appear on your profile tab.</Text>
          </View>
        ) : (
          <View style={styles.postsList}>
            {repostList.map((item) => (
              <MobilePostCard
                key={item.id}
                post={item}
                currentUserId={user?.id}
                onDelete={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
                onPressAuthor={(authorId) => setSelectedProfileTarget({ userId: authorId })}
                onPressMention={(username) => setSelectedProfileTarget({ username })}
              />
            ))}
          </View>
        )
      })()}

      {activeTab === 'tagged' && (() => {
        const taggedPosts = posts.filter(
          (p) => profile?.username && p.content?.toLowerCase().includes(`@${profile.username.toLowerCase()}`)
        )
        return taggedPosts.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <UserCheck size={24} color={colors.brand} />
            </View>
            <Text style={styles.emptyTitle}>No Tagged Voices</Text>
            <Text style={styles.emptyText}>When someone tags you in a voice or whisper, it will show up here.</Text>
          </View>
        ) : (
          <View style={styles.postsList}>
            {taggedPosts.map((item) => (
              <MobilePostCard
                key={item.id}
                post={item}
                currentUserId={user?.id}
                onDelete={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
                onPressAuthor={(authorId) => setSelectedProfileTarget({ userId: authorId })}
                onPressMention={(username) => setSelectedProfileTarget({ username })}
              />
            ))}
          </View>
        )
      })()}

      {/* Edit Profile Modal */}
      {profile && (
        <EditProfileModal
          visible={editModalVisible}
          initialProfile={{
            displayName: profile.display_name,
            bio: profile.bio,
            isPrivate: profile.is_private,
            avatarUrl: profile.avatar_url,
          }}
          onClose={() => setEditModalVisible(false)}
          onUpdated={() => user && fetchProfileData(user.id)}
        />
      )}

      {/* Follow List Modal (Followers & Following) */}
      {user && profile && (
        <FollowListModal
          visible={followModalVisible}
          onClose={() => setFollowModalVisible(false)}
          targetUserId={user.id}
          targetUsername={profile.username}
          initialTab={followModalTab}
          canView={true}
          currentUserId={user.id}
        />
      )}

      {/* Public Profile Modal (when tapping mentions/authors) */}
      {selectedProfileTarget && (
        <PublicProfileModal
          visible={!!selectedProfileTarget}
          userId={selectedProfileTarget.userId}
          username={selectedProfileTarget.username}
          currentUserId={user?.id}
          onClose={() => setSelectedProfileTarget(null)}
        />
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  scrollContent: { alignItems: 'center', paddingTop: 16, paddingHorizontal: 24, paddingBottom: 100 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topHeaderBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.gray900 },
  settingsBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  avatarImg: {
    width: 88,
    height: 88,
  },
  avatarLetter: { fontSize: 36, fontWeight: '700', color: colors.brand },
  nameGroup: { alignItems: 'center', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  displayName: { fontSize: 22, fontWeight: '700', color: colors.gray900 },
  username: { fontSize: 14, color: colors.gray500, marginTop: 2 },
  bio: {
    fontSize: 14,
    color: colors.gray600,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 32,
    marginVertical: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gray200,
    width: '100%',
    justifyContent: 'space-around',
  },
  stat: { alignItems: 'center' },
  statNumber: { fontSize: 18, fontWeight: '700', color: colors.gray900 },
  statLabel: { fontSize: 12, color: colors.gray500, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 8 },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 12,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
  },
  editBtnText: { fontSize: 14, fontWeight: '600', color: colors.gray800 },
  signOutBtn: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
  },
  whisperLinkCard: {
    width: '100%',
    marginTop: 16,
    padding: 16,
    backgroundColor: colors.brand,
    borderRadius: 16,
    gap: 8,
  },
  whisperLinkHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  whisperIcon: { fontSize: 18 },
  whisperTitle: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  whisperSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 16 },
  whisperUrlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
    padding: 8,
    marginTop: 4,
  },
  whisperUrlText: { flex: 1, fontSize: 12, color: '#ffffff', fontFamily: 'monospace', marginRight: 8 },
  shareBtn: { backgroundColor: '#ffffff', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  shareBtnText: { fontSize: 12, fontWeight: '700', color: colors.brand },
  tabBar: {
    width: '100%',
    flexDirection: 'row',
    marginTop: 20,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  tabButtonActive: {},
  activeIndicator: {
    position: 'absolute',
    bottom: -1,
    left: '20%',
    right: '20%',
    height: 2.5,
    backgroundColor: colors.brand,
    borderRadius: 2,
  },
  postsSectionHeader: { width: '100%', marginTop: 24, marginBottom: 12 },
  postsSectionTitle: { fontSize: 16, fontWeight: '700', color: colors.gray900 },
  postsList: { width: '100%', gap: 12 },
  emptyCard: {
    width: '100%',
    padding: 32,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 18,
  },
})
