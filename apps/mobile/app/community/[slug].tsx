import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  ArrowLeft,
  Users,
  Lock,
  Globe,
  Share2,
  Check,
  Plus,
  BookOpen,
  Settings,
} from 'lucide-react-native'
import { supabase } from '../../lib/supabase'
import { colors } from '../../constants/colors'
import { MobilePostCard } from '../../components/MobilePostCard'
import type { Post } from '@private-voices/shared'

export default function CommunityDetailScreen() {
  const params = useLocalSearchParams()
  const slug = params.slug as string
  const router = useRouter()

  const [community, setCommunity] = useState<any | null>(null)
  const [activeTab, setActiveTab] = useState<'posts' | 'about' | 'members'>('posts')
  const [members, setMembers] = useState<any[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [membershipStatus, setMembershipStatus] = useState<'none' | 'pending' | 'member'>('none')
  const [userRole, setUserRole] = useState<'owner' | 'moderator' | 'member' | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const fetchCommunityData = useCallback(async () => {
    setLoading(true)
    const { data: userRes } = await supabase.auth.getUser()
    const uId = userRes?.user?.id || null
    setCurrentUserId(uId)

    const { data: comm } = await supabase
      .from('communities')
      .select('*')
      .eq('slug', slug)
      .single()

    if (!comm) {
      setLoading(false)
      return
    }

    setCommunity(comm)

    if (uId) {
      const { data: member } = await supabase
        .from('community_members')
        .select('*')
        .match({ community_id: comm.id, user_id: uId })
        .maybeSingle()

      if (member) {
        setMembershipStatus(member.status === 'pending' ? 'pending' : 'member')
        setUserRole(member.role)
      }
    }

    const { data: mems } = await supabase
      .from('community_members')
      .select('*, user:profiles!community_members_user_id_fkey(id, username, display_name, avatar_url)')
      .eq('community_id', comm.id)

    setMembers(mems || [])

    const { data: rawPosts } = await supabase
      .from('posts')
      .select('*, author:profiles(id, username, display_name, avatar_url)')
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
  }, [slug])

  useEffect(() => {
    fetchCommunityData()
  }, [fetchCommunityData])

  async function handleJoinLeave() {
    if (!currentUserId || !community) return

    if (membershipStatus === 'member' || membershipStatus === 'pending') {
      await supabase
        .from('community_members')
        .delete()
        .match({ community_id: community.id, user_id: currentUserId })

      setMembershipStatus('none')
      setUserRole(null)
    } else {
      const status = community.privacy === 'private' ? 'pending' : 'member'
      await supabase
        .from('community_members')
        .insert({ community_id: community.id, user_id: currentUserId, role: 'member', status })

      setMembershipStatus(status === 'pending' ? 'pending' : 'member')
      if (status === 'member') setUserRole('member')
    }
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
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Community Not Found</Text>
        <TouchableOpacity style={styles.backBtnAction} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft size={22} color={colors.gray800} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{community.name}</Text>
      </View>

      {/* Community Banner */}
      <View style={styles.banner}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{community.name.charAt(0).toUpperCase()}</Text>
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
          <Text style={styles.slug}>@{community.slug}</Text>
          {community.description && <Text style={styles.desc}>{community.description}</Text>}

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{members.length} Members</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.joinBtn, membershipStatus === 'member' && styles.joinedBtn]}
          onPress={handleJoinLeave}
        >
          <Text style={[styles.joinBtnText, membershipStatus === 'member' && styles.joinedBtnText]}>
            {membershipStatus === 'member' ? 'Joined' : 'Join Community'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
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
          <Text style={[styles.tabText, activeTab === 'members' && styles.tabTextActive]}>Members</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'posts' && (
        posts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No conversations yet.</Text>
            <Text style={styles.emptyBody}>Be the first to post in this community.</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {posts.map((post) => (
              <MobilePostCard key={post.id} post={post} currentUserId={currentUserId || undefined} />
            ))}
          </View>
        )
      )}

      {activeTab === 'about' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Community Rules</Text>
          <Text style={styles.ruleItem}>1. Be respectful to all members.</Text>
          <Text style={styles.ruleItem}>2. No harassment or hate speech.</Text>
          <Text style={styles.ruleItem}>3. Keep posts on topic.</Text>
          <Text style={styles.ruleItem}>4. No spam or unauthorized promotion.</Text>
        </View>
      )}

      {activeTab === 'members' && (
        <View style={styles.card}>
          {members.map((m) => (
            <View key={m.id} style={styles.memberRow}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>
                  {m.user?.display_name?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{m.user?.display_name}</Text>
                <Text style={styles.memberHandle}>@{m.user?.username}</Text>
              </View>
              <Text style={styles.roleTag}>{m.role}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  content: { padding: 16, paddingBottom: 100, gap: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { padding: 4 },
  topBarTitle: { fontSize: 18, fontWeight: '700', color: colors.gray900 },
  banner: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.gray200, gap: 12 },
  avatarCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24, fontWeight: '700', color: colors.brand },
  infoGroup: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 20, fontWeight: '700', color: colors.gray900 },
  slug: { fontSize: 13, color: colors.gray500, fontFamily: 'monospace' },
  desc: { fontSize: 13, color: colors.gray700, marginTop: 4 },
  metaRow: { flexDirection: 'row', gap: 12, marginTop: 6 },
  metaText: { fontSize: 12, fontWeight: '600', color: colors.gray600 },
  joinBtn: { backgroundColor: colors.brand, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  joinedBtn: { backgroundColor: colors.gray100 },
  joinBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  joinedBtnText: { color: colors.gray700, fontWeight: '600' },
  tabRow: { flexDirection: 'row', backgroundColor: '#ffffff', borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: colors.brand },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.gray600 },
  tabTextActive: { color: '#ffffff' },
  emptyCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: colors.gray200, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.gray900 },
  emptyBody: { fontSize: 13, color: colors.gray500 },
  card: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.gray200, gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.gray900, marginBottom: 4 },
  ruleItem: { fontSize: 13, color: colors.gray700, paddingVertical: 4 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { fontSize: 15, fontWeight: '700', color: colors.brand },
  memberName: { fontSize: 14, fontWeight: '700', color: colors.gray900 },
  memberHandle: { fontSize: 12, color: colors.gray500 },
  roleTag: { fontSize: 11, fontWeight: '600', color: colors.gray500, backgroundColor: colors.gray100, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, textTransform: 'capitalize' },
  backBtnAction: { marginTop: 12, backgroundColor: colors.brand, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  backBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
})
