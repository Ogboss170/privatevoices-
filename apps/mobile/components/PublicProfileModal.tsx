import React, { useState, useEffect } from 'react'
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, Lock, UserPlus, UserCheck, MessageSquare, Send } from 'lucide-react-native'
import { Image } from 'expo-image'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'
import { FollowListModal } from './FollowListModal'
import { SendWhisperModal } from './SendWhisperModal'
import { ChatModal } from './ChatModal'
import { MobilePostCard } from './MobilePostCard'
import type { Post } from '@private-voices/shared'

interface PublicProfileModalProps {
  visible: boolean
  userId?: string
  username?: string
  currentUserId?: string | null
  onClose: () => void
}

export function PublicProfileModal({
  visible,
  userId,
  username,
  currentUserId,
  onClose,
}: PublicProfileModalProps) {
  const [profile, setProfile] = useState<any | null>(null)
  const [stats, setStats] = useState({ followerCount: 0, followingCount: 0, postCount: 0 })
  const [isFollowing, setIsFollowing] = useState(false)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  // Sub-modal states
  const [followModalVisible, setFollowModalVisible] = useState(false)
  const [followModalTab, setFollowModalTab] = useState<'followers' | 'following'>('followers')
  const [whisperModalVisible, setWhisperModalVisible] = useState(false)
  const [chatModalVisible, setChatModalVisible] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)

  const [activeTarget, setActiveTarget] = useState<{ userId?: string; username?: string }>({ userId, username })

  useEffect(() => {
    setActiveTarget({ userId, username })
  }, [userId, username, visible])

  const effectiveUserId = profile?.id || activeTarget.userId || userId
  const isSelf = !!currentUserId && currentUserId === effectiveUserId

  useEffect(() => {
    if (!visible || (!activeTarget.userId && !activeTarget.username)) return

    async function loadProfile() {
      setLoading(true)
      try {
        // 1. Fetch Profile
        const query = supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, bio, is_private')

        const { data: prof, error } = activeTarget.userId
          ? await query.eq('id', activeTarget.userId).single()
          : await query.ilike('username', (activeTarget.username || '').replace(/^@/, '')).single()

        if (error || !prof) {
          console.error('Error fetching user profile:', error)
          setLoading(false)
          return
        }

        setProfile(prof)
        const targetId = prof.id

        // 2. Fetch stats & follow status
        const [
          { count: followerCount },
          { count: followingCount },
          { count: postCount },
          { count: isFollowingCount },
        ] = await Promise.all([
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', targetId),
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', targetId),
          supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', targetId),
          currentUserId
            ? supabase
                .from('follows')
                .select('*', { count: 'exact', head: true })
                .match({ follower_id: currentUserId, following_id: targetId })
            : Promise.resolve({ count: 0 }),
        ])

        const followingStatus = (isFollowingCount ?? 0) > 0
        setIsFollowing(followingStatus)
        setStats({
          followerCount: followerCount ?? 0,
          followingCount: followingCount ?? 0,
          postCount: postCount ?? 0,
        })

        // 3. Privacy check for posts
        const canViewContent = !prof.is_private || followingStatus || (currentUserId === targetId)

        if (canViewContent) {
          const { data: userPosts } = await supabase
            .from('posts')
            .select('*, author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url)')
            .eq('author_id', targetId)
            .order('created_at', { ascending: false })
            .limit(20)

          if (userPosts) {
            const formatted: Post[] = await Promise.all(
              userPosts.map(async (p) => {
                let lCount = 0
                let cCount = 0
                try {
                  const [{ count: likes }, { count: comments }] = await Promise.all([
                    supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
                    supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
                  ])
                  lCount = likes ?? 0
                  cCount = comments ?? 0
                } catch {
                  // ignore
                }

                return {
                  id: p.id,
                  authorId: p.author_id,
                  author: {
                    id: prof.id,
                    username: prof.username,
                    displayName: prof.display_name,
                    avatarUrl: prof.avatar_url,
                  },
                  content: p.content,
                  imageUrls: p.image_urls ?? [],
                  hashtags: [],
                  likeCount: lCount,
                  commentCount: cCount,
                  repostCount: 0,
                  isLikedByMe: false,
                  isSavedByMe: false,
                  isRepostedByMe: false,
                  createdAt: p.created_at,
                  updatedAt: p.updated_at,
                }
              })
            )
            setPosts(formatted)
          }
        } else {
          setPosts([])
        }
      } catch (err) {
        console.error('Error loading public profile data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [visible, activeTarget, currentUserId])

  async function handleToggleFollow() {
    if (!currentUserId) {
      Alert.alert('Login Required', 'Please log in to follow this user.')
      return
    }

    const targetId = profile?.id || userId
    if (!targetId) return

    const nextState = !isFollowing
    setIsFollowing(nextState)
    setStats((prev) => ({
      ...prev,
      followerCount: nextState ? prev.followerCount + 1 : Math.max(0, prev.followerCount - 1),
    }))

    try {
      if (nextState) {
        await supabase.from('follows').insert({
          follower_id: currentUserId,
          following_id: targetId,
        })
      } else {
        await supabase
          .from('follows')
          .delete()
          .match({ follower_id: currentUserId, following_id: targetId })
      }
    } catch {
      // Revert on error
      setIsFollowing(!nextState)
      setStats((prev) => ({
        ...prev,
        followerCount: !nextState ? prev.followerCount + 1 : Math.max(0, prev.followerCount - 1),
      }))
    }
  }

  async function handleStartChat() {
    if (!currentUserId) {
      Alert.alert('Login Required', 'Please log in to start a direct message.')
      return
    }

    const targetId = profile?.id || userId
    if (!targetId) return

    try {
      const [userA, userB] = currentUserId < targetId ? [currentUserId, targetId] : [targetId, currentUserId]
      const { data, error } = await supabase
        .from('conversations')
        .upsert({ user_a_id: userA, user_b_id: userB }, { onConflict: 'user_a_id,user_b_id' })
        .select('id')
        .single()

      if (error) {
        Alert.alert('Chat Error', error.message || 'Could not start conversation.')
        return
      }

      if (data) {
        setConversationId(data.id)
        setChatModalVisible(true)
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to start conversation.')
    }
  }

  function openFollowModal(tab: 'followers' | 'following') {
    setFollowModalTab(tab)
    setFollowModalVisible(true)
  }

  // Privacy Rule: Can view followers/following if NOT private OR already following OR viewing own profile
  const canViewFollows = !profile?.is_private || isFollowing || isSelf

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={22} color={colors.gray700} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {profile?.username ? `@${profile.username}` : 'Profile'}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        ) : !profile ? (
          <View style={styles.centerBox}>
            <Text style={styles.emptyTitle}>User Not Found</Text>
            <Text style={styles.emptyDesc}>This user account may have been deleted or deactivated.</Text>
          </View>
        ) : (
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {/* Profile Info Header Card */}
            <View style={styles.profileCard}>
              <View style={styles.avatarRow}>
                <View style={styles.avatarCircle}>
                  {profile.avatar_url ? (
                    <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
                  ) : (
                    <Text style={styles.avatarLetter}>
                      {(profile.display_name || profile.username || '?').charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>

                <View style={styles.nameBlock}>
                  <Text style={styles.displayName}>{profile.display_name || profile.username}</Text>
                  <Text style={styles.username}>@{profile.username}</Text>

                  {profile.is_private && (
                    <View style={styles.privateTag}>
                      <Lock size={12} color={colors.brand} />
                      <Text style={styles.privateTagText}>Private Account</Text>
                    </View>
                  )}
                </View>
              </View>

              {!!profile.bio && <Text style={styles.bioText}>{profile.bio}</Text>}

              {/* Stats Row */}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statCount}>{stats.postCount}</Text>
                  <Text style={styles.statLabel}>Voices</Text>
                </View>

                <TouchableOpacity
                  style={styles.statItem}
                  onPress={() => openFollowModal('followers')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.statCount}>{stats.followerCount}</Text>
                  <Text style={styles.statLabel}>
                    Followers {!canViewFollows && <Lock size={10} color={colors.gray400} />}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.statItem}
                  onPress={() => openFollowModal('following')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.statCount}>{stats.followingCount}</Text>
                  <Text style={styles.statLabel}>
                    Following {!canViewFollows && <Lock size={10} color={colors.gray400} />}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Action Buttons (Follow / Whisper / Message) */}
              {!isSelf && (
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.followBtn, isFollowing && styles.followingBtn]}
                    onPress={handleToggleFollow}
                  >
                    {isFollowing ? (
                      <>
                        <UserCheck size={16} color={colors.gray700} />
                        <Text style={styles.followingBtnText}>Following</Text>
                      </>
                    ) : (
                      <>
                        <UserPlus size={16} color="#ffffff" />
                        <Text style={styles.followBtnText}>Follow</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.whisperBtn}
                    onPress={() => setWhisperModalVisible(true)}
                  >
                    <MessageSquare size={16} color={colors.brand} />
                    <Text style={styles.whisperBtnText}>Whisper</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.messageBtn} onPress={handleStartChat}>
                    <Send size={16} color={colors.gray700} />
                    <Text style={styles.messageBtnText}>Message</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Posts / Privacy lock section */}
            {!canViewFollows ? (
              <View style={styles.privateLockedCard}>
                <View style={styles.lockIconBox}>
                  <Lock size={32} color={colors.brand} />
                </View>
                <Text style={styles.lockTitle}>This Account is Private</Text>
                <Text style={styles.lockDesc}>
                  Follow @{profile.username} to view their Voices, followers, and social activity.
                </Text>
              </View>
            ) : posts.length === 0 ? (
              <View style={styles.emptyPostsBox}>
                <Text style={styles.emptyEmoji}>💭</Text>
                <Text style={styles.emptyTitle}>No Voices Yet</Text>
                <Text style={styles.emptyDesc}>
                  @{profile.username} has not shared any public voices yet.
                </Text>
              </View>
            ) : (
              <View style={styles.postsList}>
                <Text style={styles.postsHeaderTitle}>Voices ({posts.length})</Text>
                {posts.map((post) => (
                  <MobilePostCard
                    key={post.id}
                    post={post}
                    currentUserId={currentUserId || undefined}
                    onPressAuthor={(authorId) => setActiveTarget({ userId: authorId })}
                    onPressMention={(u) => setActiveTarget({ username: u })}
                  />
                ))}
              </View>
            )}
          </ScrollView>
        )}

        {/* Follow / Following Modal */}
        <FollowListModal
          visible={followModalVisible}
          onClose={() => setFollowModalVisible(false)}
          targetUserId={profile?.id || userId || ''}
          targetUsername={profile?.username || 'user'}
          initialTab={followModalTab}
          canView={canViewFollows}
          currentUserId={currentUserId}
        />

        {/* Anonymous Whisper Modal */}
        <SendWhisperModal
          visible={whisperModalVisible}
          recipientId={profile?.id || userId || ''}
          recipientUsername={profile?.username || 'user'}
          recipientDisplayName={profile?.display_name || profile?.username || 'User'}
          onClose={() => setWhisperModalVisible(false)}
        />

        {/* 1-on-1 Direct Message Modal */}
        {conversationId && (
          <ChatModal
            visible={chatModalVisible}
            conversationId={conversationId}
            partner={profile}
            currentUserId={currentUserId || ''}
            onClose={() => setChatModalVisible(false)}
          />
        )}
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray900,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.gray100,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: colors.gray500,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray800,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.gray500,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.gray200,
    gap: 14,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 64,
    height: 64,
  },
  avatarLetter: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.brand,
  },
  nameBlock: {
    flex: 1,
    gap: 2,
  },
  displayName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray900,
  },
  username: {
    fontSize: 13,
    color: colors.gray500,
  },
  privateTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  privateTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.brand,
  },
  bioText: {
    fontSize: 14,
    color: colors.gray700,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.gray100,
    paddingVertical: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statCount: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray900,
  },
  statLabel: {
    fontSize: 12,
    color: colors.gray500,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  followBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.brand,
    paddingVertical: 10,
    borderRadius: 10,
  },
  followBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  followingBtn: {
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.gray300,
  },
  followingBtnText: {
    color: colors.gray800,
    fontSize: 13,
    fontWeight: '600',
  },
  whisperBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.brandLight,
    paddingVertical: 10,
    borderRadius: 10,
  },
  whisperBtnText: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: '700',
  },
  messageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.gray100,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  messageBtnText: {
    color: colors.gray800,
    fontSize: 13,
    fontWeight: '600',
  },
  privateLockedCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  lockIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  lockTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: 6,
  },
  lockDesc: {
    fontSize: 13,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },
  emptyPostsBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  emptyEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  postsList: {
    gap: 12,
  },
  postsHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.gray900,
    marginLeft: 4,
  },
})
