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
import { Edit3, Lock, LogOut, Settings, Bookmark } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { colors } from '../../constants/colors'
import { EditProfileModal } from '../../components/EditProfileModal'
import { FollowListModal } from '../../components/FollowListModal'
import { MobilePostCard } from '../../components/MobilePostCard'
import { PublicProfileModal } from '../../components/PublicProfileModal'
import type { Post } from '@private-voices/shared'
import { extractPostMediaAndCleanContent } from '@private-voices/shared'
import type { User } from '@supabase/supabase-js'
import { useTheme } from '../../context/ThemeContext'

export default function ProfileScreen() {
  const router = useRouter()
  const { colors: themeColors } = useTheme()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<{
    display_name: string
    username: string
    bio: string | null
    avatar_url: string | null
    is_private: boolean
  } | null>(null)
  const [stats, setStats] = useState({ followerCount: 0, followingCount: 0, postCount: 0 })
  const [activeTab, setActiveTab] = useState<'posts' | 'saved'>('posts')
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
      <View style={styles.topHeaderBar}>
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
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarLetter}>
          {profile?.display_name?.charAt(0)?.toUpperCase() ?? '?'}
        </Text>
      </View>

      {/* Name & Username */}
      <View style={styles.nameGroup}>
        <View style={styles.row}>
          <Text style={[styles.displayName, { color: themeColors.textPrimary }]}>{profile?.display_name}</Text>
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

      {/* Segmented Tabs: My Voices vs Saved */}
      <View style={[styles.tabBar, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'posts' && styles.tabButtonActive]}
          onPress={() => setActiveTab('posts')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>
            My Voices ({posts.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'saved' && styles.tabButtonActive]}
          onPress={() => setActiveTab('saved')}
          activeOpacity={0.7}
        >
          <Bookmark
            size={14}
            color={activeTab === 'saved' ? colors.brand : colors.gray500}
            fill={activeTab === 'saved' ? colors.brand : 'none'}
          />
          <Text style={[styles.tabText, activeTab === 'saved' && styles.tabTextActive]}>
            Saved ({savedPosts.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'posts' ? (
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
      ) : (
        savedPosts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>🔖</Text>
            <Text style={styles.emptyTitle}>No Saved Voices</Text>
            <Text style={styles.emptyText}>
              Bookmark voices you want to revisit later by tapping the bookmark icon on any post.
            </Text>
          </View>
        ) : (
          <View style={styles.postsList}>
            {savedPosts.map((item) => (
              <MobilePostCard
                key={item.id}
                post={item}
                currentUserId={user?.id}
                onDelete={(id) => setSavedPosts((prev) => prev.filter((p) => p.id !== id))}
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
      )}

      {/* Edit Profile Modal */}
      {profile && (
        <EditProfileModal
          visible={editModalVisible}
          initialProfile={{
            displayName: profile.display_name,
            bio: profile.bio,
            isPrivate: profile.is_private,
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
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 4,
    marginTop: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: colors.brandLight,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray500,
  },
  tabTextActive: {
    color: colors.brand,
    fontWeight: '700',
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
