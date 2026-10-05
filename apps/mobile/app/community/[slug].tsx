import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  ArrowLeft,
  Users,
  Lock,
  Globe,
  Check,
  Plus,
  Settings,
  Shield,
  UserCheck,
  X,
  Send,
} from 'lucide-react-native'
import { Image } from 'expo-image'
import { supabase } from '../../lib/supabase'
import { colors } from '../../constants/colors'
import { MobilePostCard } from '../../components/MobilePostCard'
import { PublicProfileModal } from '../../components/PublicProfileModal'
import type { Post } from '@private-voices/shared'

export default function CommunityDetailScreen() {
  const params = useLocalSearchParams()
  const slug = params.slug as string
  const router = useRouter()

  const [community, setCommunity] = useState<any | null>(null)
  const [activeTab, setActiveTab] = useState<'posts' | 'about' | 'members' | 'manage'>('posts')
  const [members, setMembers] = useState<any[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [membershipStatus, setMembershipStatus] = useState<'none' | 'pending' | 'member'>('none')
  const [userRole, setUserRole] = useState<'owner' | 'moderator' | 'member' | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Post composer state inside community
  const [newPostContent, setNewPostContent] = useState('')
  const [posting, setPosting] = useState(false)

  // Edit settings state
  const [editDesc, setEditDesc] = useState('')
  const [editCoverUrl, setEditCoverUrl] = useState('')
  const [editPrivacy, setEditPrivacy] = useState<'public' | 'private'>('public')
  const [savingSettings, setSavingSettings] = useState(false)

  // Public Profile Modal State
  const [selectedProfileTarget, setSelectedProfileTarget] = useState<{ userId?: string; username?: string } | null>(null)

  const fetchCommunityData = useCallback(async () => {
    setLoading(true)
    const { data: userRes } = await supabase.auth.getUser()
    const uId = userRes?.user?.id || null
    setCurrentUserId(uId)

    // 1. Fetch Community
    const { data: comm, error: commErr } = await supabase
      .from('communities')
      .select('*')
      .eq('slug', slug)
      .single()

    if (commErr || !comm) {
      console.error('Error fetching community:', commErr)
      setLoading(false)
      return
    }

    setCommunity(comm)
    setEditDesc(comm.description || '')
    setEditCoverUrl(comm.avatar_url || '')
    setEditPrivacy(comm.privacy || 'public')

    // 2. Fetch User Membership
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

    // 3. Fetch Members
    let { data: mems, error: memErr } = await supabase
      .from('community_members')
      .select('*, user:profiles!community_members_user_id_fkey(id, username, display_name, avatar_url)')
      .eq('community_id', comm.id)

    if (memErr || !mems) {
      const fallbackMems = await supabase
        .from('community_members')
        .select('*')
        .eq('community_id', comm.id)

      if (fallbackMems.data && fallbackMems.data.length > 0) {
        const uIds = fallbackMems.data.map((m) => m.user_id)
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', uIds)

        const pMap = new Map((profs ?? []).map((p) => [p.id, p]))
        setMembers(fallbackMems.data.map((m) => ({ ...m, user: pMap.get(m.user_id) })))
      } else {
        setMembers([])
      }
    } else {
      setMembers(mems)
    }

    // 4. Fetch Community Posts
    let { data: rawPosts, error: postErr } = await supabase
      .from('posts')
      .select('*, author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url)')
      .eq('community_id', comm.id)
      .order('created_at', { ascending: false })

    if (postErr || !rawPosts) {
      const fallbackRes = await supabase
        .from('posts')
        .select('*')
        .eq('community_id', comm.id)
        .order('created_at', { ascending: false })
      rawPosts = fallbackRes.data
    }

    if (rawPosts && rawPosts.length > 0) {
      const authorIds = Array.from(new Set(rawPosts.map((p) => p.author_id)))
      const { data: profList } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', authorIds)

      const profileMap = new Map((profList ?? []).map((prof) => [prof.id, prof]))

      const formatted: Post[] = await Promise.all(
        rawPosts.map(async (p: any) => {
          let likeCount = 0
          let commentCount = 0
          try {
            const [{ count: lCount }, { count: cCount }] = await Promise.all([
              supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
              supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
            ])
            likeCount = lCount ?? 0
            commentCount = cCount ?? 0
          } catch {
            // ignore
          }

          const authorData = p.author || profileMap.get(p.author_id)
          return {
            id: p.id,
            authorId: p.author_id,
            author: {
              id: authorData?.id || p.author_id,
              username: authorData?.username || 'user',
              displayName: authorData?.display_name || 'User',
              avatarUrl: authorData?.avatar_url || null,
            },
            content: p.content,
            imageUrls: p.image_urls ?? [],
            hashtags: [],
            likeCount,
            commentCount,
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
    } else {
      setPosts([])
    }

    setLoading(false)
  }, [slug])

  useEffect(() => {
    fetchCommunityData()
  }, [fetchCommunityData])

  async function handleJoinLeave() {
    if (!currentUserId) {
      Alert.alert('Login Required', 'Please log in to join communities.')
      return
    }
    if (!community) return

    if (membershipStatus === 'member' || membershipStatus === 'pending') {
      await supabase
        .from('community_members')
        .delete()
        .match({ community_id: community.id, user_id: currentUserId })

      setMembershipStatus('none')
      setUserRole(null)
      fetchCommunityData()
    } else {
      const status = community.privacy === 'private' ? 'pending' : 'member'
      await supabase
        .from('community_members')
        .insert({ community_id: community.id, user_id: currentUserId, role: 'member', status })

      setMembershipStatus(status === 'pending' ? 'pending' : 'member')
      if (status === 'member') setUserRole('member')
      fetchCommunityData()
    }
  }

  function handleOpenAuthorProfile(authorId: string) {
    setSelectedProfileTarget({ userId: authorId })
  }

  function handleOpenMentionProfile(username: string) {
    setSelectedProfileTarget({ username })
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    )
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
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Top Header Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <ArrowLeft size={22} color={colors.gray800} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle} numberOfLines={1}>{community.name}</Text>
        </View>

        {/* Community Info Banner */}
        <View style={styles.banner}>
          <View style={styles.avatarCircle}>
            {community.avatar_url ? (
              <Image source={{ uri: community.avatar_url }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarText}>{community.name.charAt(0).toUpperCase()}</Text>
            )}
          </View>

          <View style={styles.infoGroup}>
            <View style={styles.row}>
              <Text style={styles.name}>{community.name}</Text>
              {community.privacy === 'private' ? (
                <Lock size={16} color="#d97706" />
              ) : (
                <Globe size={16} color="#059669" />
              )}
            </View>
            <Text style={styles.slug}>c/{community.slug}</Text>
            {community.description && <Text style={styles.desc}>{community.description}</Text>}

            <View style={styles.metaRow}>
              <Users size={14} color={colors.gray500} />
              <Text style={styles.metaText}>{members.length} Members</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.joinBtn, membershipStatus === 'member' && styles.joinedBtn]}
            onPress={handleJoinLeave}
          >
            {membershipStatus === 'member' ? (
              <View style={styles.btnRow}>
                <Check size={16} color={colors.gray700} />
                <Text style={styles.joinedBtnText}>Joined</Text>
              </View>
            ) : (
              <View style={styles.btnRow}>
                <Plus size={16} color="#ffffff" />
                <Text style={styles.joinBtnText}>Join Community</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Tabs Row */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
            onPress={() => setActiveTab('posts')}
          >
            <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>Posts</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'about' && styles.tabActive]}
            onPress={() => setActiveTab('about')}
          >
            <Text style={[styles.tabText, activeTab === 'about' && styles.tabTextActive]}>About</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'members' && styles.tabActive]}
            onPress={() => setActiveTab('members')}
          >
            <Text style={[styles.tabText, activeTab === 'members' && styles.tabTextActive]}>
              Members ({members.length})
            </Text>
          </TouchableOpacity>
          {(userRole === 'owner' || userRole === 'moderator') && (
            <TouchableOpacity
              style={[styles.tab, activeTab === 'manage' && styles.tabActive]}
              onPress={() => setActiveTab('manage')}
            >
              <Text style={[styles.tabText, activeTab === 'manage' && styles.tabTextActive]}>
                Manage
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tab 1: Posts */}
        {activeTab === 'posts' && (
          <View style={{ gap: 12 }}>
            {/* Inline Community Post Composer */}
            {membershipStatus === 'member' && (
              <View style={styles.card}>
                <TextInput
                  style={[styles.descText, { backgroundColor: colors.gray50, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.gray200, minHeight: 70, textAlignVertical: 'top' }]}
                  multiline
                  placeholder={`Share something with c/${community.slug}...`}
                  placeholderTextColor={colors.gray400}
                  value={newPostContent}
                  onChangeText={setNewPostContent}
                />
                <View style={{ alignItems: 'flex-end', marginTop: 10 }}>
                  <TouchableOpacity
                    style={[styles.joinBtn, (!newPostContent.trim() || posting) && { opacity: 0.5 }]}
                    disabled={!newPostContent.trim() || posting}
                    onPress={async () => {
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
                      } else {
                        Alert.alert('Post Failed', error.message)
                      }
                      setPosting(false)
                    }}
                  >
                    <View style={styles.btnRow}>
                      <Send size={14} color="#ffffff" />
                      <Text style={styles.joinBtnText}>{posting ? 'Posting...' : 'Post to Community'}</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {posts.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No community voices yet</Text>
                <Text style={styles.emptyBody}>Be the first to share a post in this community.</Text>
              </View>
            ) : (
              posts.map((post) => (
                <MobilePostCard
                  key={post.id}
                  post={post}
                  currentUserId={currentUserId || undefined}
                  onPressAuthor={handleOpenAuthorProfile}
                  onPressMention={handleOpenMentionProfile}
                />
              ))
            )}
          </View>
        )}

        {/* Tab 2: About */}
        {activeTab === 'about' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>About {community.name}</Text>
            <Text style={styles.descText}>
              {community.description || 'Welcome to this community! Share posts, discuss ideas, and connect.'}
            </Text>

            <Text style={[styles.cardTitle, { marginTop: 14 }]}>Community Guidelines</Text>
            <Text style={styles.ruleItem}>1. Be respectful to all fellow members.</Text>
            <Text style={styles.ruleItem}>2. No harassment, hate speech, or abuse.</Text>
            <Text style={styles.ruleItem}>3. Keep posts and discussions on topic.</Text>
            <Text style={styles.ruleItem}>4. No spam, link farming, or unauthorized promos.</Text>
          </View>
        )}

        {/* Tab 3: Members */}
        {activeTab === 'members' && (
          <View style={styles.card}>
            {members.length === 0 ? (
              <Text style={styles.emptyBody}>No members listed yet.</Text>
            ) : (
              members.map((m) => {
                const u = m.user
                const displayName = u?.display_name || u?.username || 'Member'
                const username = u?.username || 'user'
                const memberId = u?.id || m.user_id

                return (
                  <TouchableOpacity
                    key={m.id || memberId}
                    style={styles.memberRow}
                    onPress={() => memberId && handleOpenAuthorProfile(memberId)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.memberAvatar}>
                      {u?.avatar_url ? (
                        <Image source={{ uri: u.avatar_url }} style={styles.memberAvatarImg} />
                      ) : (
                        <Text style={styles.memberAvatarText}>
                          {displayName.charAt(0).toUpperCase()}
                        </Text>
                      )}
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

        {/* Tab 4: Manage (Owner / Moderator Only) */}
        {activeTab === 'manage' && (userRole === 'owner' || userRole === 'moderator') && (
          <View style={{ gap: 14 }}>
            {/* 1. Settings Card */}
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Settings size={18} color={colors.brand} />
                <Text style={styles.cardTitle}>Community Settings</Text>
              </View>

              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.gray700, marginBottom: 4 }}>Description</Text>
              <TextInput
                style={[styles.descText, { backgroundColor: colors.gray50, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: colors.gray200, minHeight: 60, marginBottom: 12 }]}
                multiline
                value={editDesc}
                onChangeText={setEditDesc}
                placeholder="Describe your community..."
              />

              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.gray700, marginBottom: 4 }}>Cover / Avatar Image URL</Text>
              <TextInput
                style={[styles.descText, { backgroundColor: colors.gray50, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: colors.gray200, marginBottom: 12 }]}
                value={editCoverUrl}
                onChangeText={setEditCoverUrl}
                placeholder="https://..."
              />

              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.gray700, marginBottom: 4 }}>Privacy</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                <TouchableOpacity
                  style={[styles.joinBtn, editPrivacy === 'public' ? styles.joinedBtn : { backgroundColor: colors.gray100 }]}
                  onPress={() => setEditPrivacy('public')}
                >
                  <Text style={[styles.joinBtnText, editPrivacy === 'public' ? { color: colors.brand } : { color: colors.gray700 }]}>🌐 Public</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.joinBtn, editPrivacy === 'private' ? styles.joinedBtn : { backgroundColor: colors.gray100 }]}
                  onPress={() => setEditPrivacy('private')}
                >
                  <Text style={[styles.joinBtnText, editPrivacy === 'private' ? { color: colors.brand } : { color: colors.gray700 }]}>🔒 Private</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.joinBtn, savingSettings && { opacity: 0.5 }]}
                disabled={savingSettings}
                onPress={async () => {
                  if (!community) return
                  setSavingSettings(true)
                  const { error } = await supabase
                    .from('communities')
                    .update({
                      description: editDesc.trim(),
                      avatar_url: editCoverUrl.trim() || null,
                      privacy: editPrivacy,
                    })
                    .eq('id', community.id)

                  setSavingSettings(false)
                  if (error) {
                    Alert.alert('Update Failed', error.message)
                  } else {
                    Alert.alert('Success', 'Community settings updated successfully!')
                    fetchCommunityData()
                  }
                }}
              >
                <Text style={styles.joinBtnText}>{savingSettings ? 'Saving...' : 'Save Settings'}</Text>
              </TouchableOpacity>
            </View>

            {/* 2. Role Management & Moderation Panel */}
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Shield size={18} color={colors.brand} />
                <Text style={styles.cardTitle}>Member Roles & Moderation</Text>
              </View>
              <Text style={[styles.descText, { marginBottom: 12 }]}>Promote members to Moderator or remove them.</Text>

              {members
                .filter((m) => m.role !== 'owner')
                .map((m) => {
                  const u = m.user
                  const displayName = u?.display_name || u?.username || 'Member'
                  const username = u?.username || 'user'

                  return (
                    <View key={m.id || m.user_id} style={[styles.memberRow, { paddingVertical: 8 }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberName}>{displayName}</Text>
                        <Text style={styles.memberHandle}>@{username} • {m.role}</Text>
                      </View>

                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {userRole === 'owner' && (
                          <TouchableOpacity
                            style={[styles.joinBtn, { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: m.role === 'moderator' ? colors.gray200 : '#f3e8ff' }]}
                            onPress={async () => {
                              const newRole = m.role === 'moderator' ? 'member' : 'moderator'
                              await supabase
                                .from('community_members')
                                .update({ role: newRole })
                                .match({ community_id: community.id, user_id: m.user_id })
                              fetchCommunityData()
                            }}
                          >
                            <Text style={[styles.joinBtnText, { fontSize: 11, color: m.role === 'moderator' ? colors.gray800 : '#7e22ce' }]}>
                              {m.role === 'moderator' ? 'Demote' : 'Make Mod'}
                            </Text>
                          </TouchableOpacity>
                        )}

                        {(userRole === 'owner' || (userRole === 'moderator' && m.role === 'member')) && (
                          <TouchableOpacity
                            style={{ padding: 6, backgroundColor: '#fef2f2', borderRadius: 8 }}
                            onPress={async () => {
                              Alert.alert('Remove Member', `Remove @${username} from this community?`, [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Remove',
                                  style: 'destructive',
                                  onPress: async () => {
                                    await supabase
                                      .from('community_members')
                                      .delete()
                                      .match({ community_id: community.id, user_id: m.user_id })
                                    fetchCommunityData()
                                  },
                                },
                              ])
                            }}
                          >
                            <X size={14} color="#ef4444" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )
                })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Public Profile Modal */}
      {selectedProfileTarget && (
        <PublicProfileModal
          visible={!!selectedProfileTarget}
          userId={selectedProfileTarget.userId}
          username={selectedProfileTarget.username}
          currentUserId={currentUserId}
          onClose={() => setSelectedProfileTarget(null)}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
    gap: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  iconBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.gray100,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray900,
    flex: 1,
  },
  banner: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.gray200,
    gap: 12,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 60,
    height: 60,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.brand,
  },
  infoGroup: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.gray900,
  },
  slug: {
    fontSize: 13,
    color: colors.brand,
    fontWeight: '600',
  },
  desc: {
    fontSize: 13,
    color: colors.gray700,
    marginTop: 4,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray600,
  },
  joinBtn: {
    backgroundColor: colors.brand,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinedBtn: {
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.gray300,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  joinBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  joinedBtnText: {
    color: colors.gray700,
    fontWeight: '600',
    fontSize: 14,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: colors.brand,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray600,
  },
  tabTextActive: {
    color: '#ffffff',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray200,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray900,
  },
  emptyBody: {
    fontSize: 13,
    color: colors.gray500,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.gray200,
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: 4,
  },
  descText: {
    fontSize: 13,
    color: colors.gray600,
    lineHeight: 18,
  },
  ruleItem: {
    fontSize: 13,
    color: colors.gray700,
    paddingVertical: 3,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  memberAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  memberAvatarImg: {
    width: 38,
    height: 38,
  },
  memberAvatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.brand,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gray900,
  },
  memberHandle: {
    fontSize: 12,
    color: colors.gray500,
  },
  roleTag: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.brand,
    backgroundColor: colors.brandLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    textTransform: 'capitalize',
  },
  backBtnAction: {
    marginTop: 12,
    backgroundColor: colors.brand,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },
})
