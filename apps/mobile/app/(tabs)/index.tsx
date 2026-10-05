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
import { useFocusEffect } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { colors } from '../../constants/colors'
import { MobilePostCard } from '../../components/MobilePostCard'
import { StoriesTray } from '../../components/StoriesTray'
import { PublicProfileModal } from '../../components/PublicProfileModal'
import type { Post } from '@private-voices/shared'
import { extractPostMediaAndCleanContent } from '@private-voices/shared'

const TABS = [
  { id: 'for-you', label: 'For You' },
  { id: 'following', label: 'Following' },
  { id: 'trending', label: 'Trending' },
  { id: 'latest', label: 'Latest' },
  { id: 'community', label: 'Community' },
]

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState('for-you')
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | undefined>()
  const [selectedProfileTarget, setSelectedProfileTarget] = useState<{ userId?: string; username?: string } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
  }, [])

  const fetchPosts = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setLoading(true)
    }

    try {
      let query = supabase
        .from('posts')
        .select('*, author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url), community:communities(id, name, slug, avatar_url, privacy)')
        .order('created_at', { ascending: false })

      if (activeTab === 'following' && currentUserId) {
        const { data: follows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', currentUserId)

        const followingIds = (follows ?? []).map((f) => f.following_id)
        followingIds.push(currentUserId)
        query = query.in('author_id', followingIds)
      } else if (activeTab === 'community') {
        query = query.not('community_id', 'is', null)
      }

      let { data, error } = await query

      if (error || !data) {
        console.warn('Mobile feed query error, retrying fallback:', error)
        const fallbackRes = await supabase
          .from('posts')
          .select('*, community:communities(id, name, slug, avatar_url, privacy)')
          .order('created_at', { ascending: false })
        data = fallbackRes.data
      }

      if (data && data.length > 0) {
        const authorIds = Array.from(new Set(data.map((p) => p.author_id)))
        const { data: profList } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', authorIds)

        const profileMap = new Map((profList ?? []).map((prof) => [prof.id, prof]))

        const formatted: Post[] = await Promise.all(
          data.map(async (p) => {
            let likeCount = 0
            let commentCount = 0
            let repostCount = 0

            try {
              const [{ count: lCount }, { count: cCount }, { count: rCount }] = await Promise.all([
                supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
                supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
                supabase.from('reposts').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
              ])
              likeCount = lCount ?? 0
              commentCount = cCount ?? 0
              repostCount = rCount ?? 0
            } catch {
              // ignore
            }

            let isLikedByMe = false
            let isSavedByMe = false
            let isRepostedByMe = false

            if (currentUserId) {
              try {
                const [{ data: like }, { data: save }, { data: repost }] = await Promise.all([
                  supabase.from('likes').select('user_id').match({ user_id: currentUserId, post_id: p.id }).maybeSingle(),
                  supabase.from('saved_posts').select('user_id').match({ user_id: currentUserId, post_id: p.id }).maybeSingle(),
                  supabase.from('reposts').select('user_id').match({ user_id: currentUserId, post_id: p.id }).maybeSingle(),
                ])
                isLikedByMe = !!like
                isSavedByMe = !!save
                isRepostedByMe = !!repost
              } catch {
                // ignore
              }
            }

            const authorData = p.author || profileMap.get(p.author_id)
            const { content: cleanContent, imageUrls } = extractPostMediaAndCleanContent(p.content, p.image_urls)

            return {
              id: p.id,
              authorId: p.author_id,
              author: {
                id: authorData?.id || p.author_id,
                username: authorData?.username || 'user',
                displayName: authorData?.display_name || 'User',
                avatarUrl: authorData?.avatar_url || null,
              },
              communityId: p.community_id || null,
              community: p.community
                ? {
                    id: p.community.id,
                    name: p.community.name,
                    slug: p.community.slug,
                    avatarUrl: p.community.avatar_url,
                    privacy: p.community.privacy,
                  }
                : null,
              content: cleanContent,
              imageUrls,
              hashtags: [],
              likeCount,
              commentCount,
              repostCount,
              isLikedByMe,
              isSavedByMe,
              isRepostedByMe,
              createdAt: p.created_at,
              updatedAt: p.updated_at,
            }
          })
        )
        setPosts(formatted)
      } else {
        setPosts([])
      }
    } catch (err) {
      console.error('Fatal mobile feed error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeTab, currentUserId])

  // Refetch posts in background when tab screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchPosts(false)
    }, [fetchPosts])
  )

  useEffect(() => {
    fetchPosts(true)

    // Realtime listener for instant feed updates
    const channel = supabase
      .channel('mobile:feed_posts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        () => {
          fetchPosts(false)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
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
      {/* 24-Hour Stories Tray */}
      <StoriesTray />

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
              onPressAuthor={(authorId) => setSelectedProfileTarget({ userId: authorId })}
              onPressMention={(username) => setSelectedProfileTarget({ username })}
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

