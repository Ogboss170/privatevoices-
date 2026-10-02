import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { colors } from '../../constants/colors'
import { MobilePostCard } from '../../components/MobilePostCard'
import type { Post } from '@private-voices/shared'

const TABS = [
  { id: 'for-you', label: 'For You' },
  { id: 'following', label: 'Following' },
  { id: 'latest', label: 'Latest' },
]

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState('for-you')
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | undefined>()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
  }, [])

  const fetchPosts = useCallback(async () => {
    let query = supabase
      .from('posts')
      .select('*, author:profiles(id, username, display_name, avatar_url)')
      .order('created_at', { ascending: false })

    if (activeTab === 'following' && currentUserId) {
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId)

      const followingIds = (follows ?? []).map((f) => f.following_id)
      followingIds.push(currentUserId)
      query = query.in('author_id', followingIds)
    }

    const { data, error } = await query

    if (!error && data) {
      const formatted: Post[] = await Promise.all(
        data.map(async (p) => {
          const [{ count: likeCount }, { count: commentCount }] = await Promise.all([
            supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
            supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
          ])

          let isLikedByMe = false
          let isSavedByMe = false

          if (currentUserId) {
            const [{ data: like }, { data: save }] = await Promise.all([
              supabase.from('likes').select('user_id').match({ user_id: currentUserId, post_id: p.id }).maybeSingle(),
              supabase.from('saved_posts').select('user_id').match({ user_id: currentUserId, post_id: p.id }).maybeSingle(),
            ])
            isLikedByMe = !!like
            isSavedByMe = !!save
          }

          return {
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
            likeCount: likeCount ?? 0,
            commentCount: commentCount ?? 0,
            repostCount: 0,
            isLikedByMe,
            isSavedByMe,
            isRepostedByMe: false,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
          }
        })
      )
      setPosts(formatted)
    }
    setLoading(false)
    setRefreshing(false)
  }, [activeTab, currentUserId])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchPosts()
  }

  function handleDeletePost(deletedId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== deletedId))
  }

  return (
    <View style={styles.container}>
      {/* Tab filter bar */}
      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Feed List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>✨</Text>
          <Text style={styles.emptyTitle}>No posts yet</Text>
          <Text style={styles.emptyBody}>
            Be the first to share your thoughts, or follow more people to fill your feed.
          </Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MobilePostCard
              post={item}
              currentUserId={currentUserId}
              onDelete={handleDeletePost}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.brand}
            />
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    paddingHorizontal: 16,
  },
  tab: {
    paddingVertical: 12,
    marginRight: 20,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.brand,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.gray500,
  },
  tabTextActive: {
    color: colors.brand,
    fontWeight: '700',
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.gray900, marginBottom: 8 },
  emptyBody: { fontSize: 14, color: colors.gray500, textAlign: 'center', lineHeight: 20 },
  listContent: { padding: 16, paddingBottom: 100 },
})
