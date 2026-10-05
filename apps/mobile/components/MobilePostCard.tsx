import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Share,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Modal,
  SafeAreaView,
} from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import {
  Heart,
  MessageCircle,
  Repeat,
  BarChart2,
  Bookmark,
  Share2,
  Trash2,
  MoreVertical,
  Flag,
  ShieldOff,
  Send,
  X,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from 'lucide-react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'
import type { Post } from '@private-voices/shared'
import { FormattedText } from './FormattedText'
import { MentionSuggestions } from './MentionSuggestions'
import { MobileInteractivePoll } from './MobileInteractivePoll'
import { PostInsightsModal } from './PostInsightsModal'

interface MobilePostCardProps {
  post: Post
  currentUserId?: string
  onDelete?: (postId: string) => void
  onPressAuthor?: (userId: string) => void
  onPressMention?: (username: string) => void
  onPressHashtag?: (hashtag: string) => void
  onToggleSave?: (postId: string, isSaved: boolean) => void
}

export function MobilePostCard({ post, currentUserId, onDelete, onPressAuthor, onPressMention, onPressHashtag, onToggleSave }: MobilePostCardProps) {
  const router = useRouter()
  const [isLiked, setIsLiked] = useState(post.isLikedByMe)
  const [likeCount, setLikeCount] = useState(post.likeCount)
  const [likeBusy, setLikeBusy] = useState(false)
  const [isReposted, setIsReposted] = useState(post.isRepostedByMe || false)
  const [repostCount, setRepostCount] = useState(post.repostCount || 0)
  const [repostBusy, setRepostBusy] = useState(false)
  const [isSaved, setIsSaved] = useState(post.isSavedByMe)
  const [commentCount, setCommentCount] = useState(post.commentCount)
  const [viewCount, setViewCount] = useState(post.viewCount || 0)

  const isOwner = currentUserId === post.authorId

  // Meaningful View Recording (1-second visibility threshold, excludes author, 24h dedup)
  useEffect(() => {
    if (!currentUserId || isOwner) return

    const timer = setTimeout(async () => {
      try {
        const { data: recorded } = await supabase.rpc('record_post_view', {
          p_post_id: post.id,
          p_viewer_id: currentUserId,
        })
        if (recorded) {
          setViewCount((prev) => prev + 1)
        }
      } catch {
        // ignore
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [post.id, currentUserId, isOwner])

  // Reanimated heart scale value
  const heartScale = useSharedValue(1)
  const animatedHeartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }))
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<any[]>([])
  const [commentText, setCommentText] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)
  const [carouselWidth, setCarouselWidth] = useState(0)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [modalVisible, setModalVisible] = useState(false)
  const [modalImageIndex, setModalImageIndex] = useState(0)
  const [showInsightsModal, setShowInsightsModal] = useState(false)

  const mentionMatch = commentText.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/)
  const mentionQuery = mentionMatch ? mentionMatch[1] : null
  const isMentioning = mentionQuery !== null

  function handleSelectMention(username: string) {
    setCommentText((prev) => {
      return prev.replace(/(?:^|\s)@([a-zA-Z0-9_]*)$/, (match) => {
        const prefix = match.startsWith(' ') ? ' ' : ''
        return `${prefix}@${username} `
      })
    })
  }

  async function handleToggleLike() {
    if (likeBusy) return
    if (!currentUserId) {
      Alert.alert('Login Required', 'Please log in to like posts.')
      return
    }

    setLikeBusy(true)
    const prevLiked = isLiked
    const prevCount = likeCount
    const nextLiked = !prevLiked

    setIsLiked(nextLiked)
    setLikeCount(prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1)

    // Trigger subtle spring pop animation if liking
    if (nextLiked) {
      heartScale.value = 1.35
      heartScale.value = withSpring(1, { damping: 7, stiffness: 200 })
    }

    try {
      if (prevLiked) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .match({ user_id: currentUserId, post_id: post.id })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('likes')
          .insert({ user_id: currentUserId, post_id: post.id })
        // 23505 = already liked (primary key user_id+post_id): keep liked state, fix count
        if (error && error.code !== '23505') throw error
        if (error && error.code === '23505') {
          setIsLiked(true)
          setLikeCount(prevCount)
        }
      }
    } catch {
      setIsLiked(prevLiked)
      setLikeCount(prevCount)
    } finally {
      setLikeBusy(false)
    }
  }

  async function handleToggleRepost() {
    if (repostBusy) return
    if (!currentUserId) {
      Alert.alert('Login Required', 'Please log in to repost.')
      return
    }

    setRepostBusy(true)
    const prevReposted = isReposted
    const prevCount = repostCount
    setIsReposted(!prevReposted)
    setRepostCount(prevReposted ? Math.max(0, prevCount - 1) : prevCount + 1)

    try {
      if (prevReposted) {
        const { error } = await supabase
          .from('reposts')
          .delete()
          .match({ user_id: currentUserId, post_id: post.id })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('reposts')
          .insert({ user_id: currentUserId, post_id: post.id })
        if (error && error.code !== '23505') throw error
        if (error && error.code === '23505') {
          setIsReposted(true)
          setRepostCount(prevCount)
        }
      }
    } catch {
      setIsReposted(prevReposted)
      setRepostCount(prevCount)
    } finally {
      setRepostBusy(false)
    }
  }

  async function handleToggleSave() {
    const prevSaved = isSaved
    const nextSaved = !prevSaved
    setIsSaved(nextSaved)
    onToggleSave?.(post.id, nextSaved)

    try {
      if (prevSaved) {
        await supabase.from('saved_posts').delete().match({ user_id: currentUserId, post_id: post.id })
      } else {
        await supabase.from('saved_posts').insert({ user_id: currentUserId, post_id: post.id })
      }
    } catch {
      setIsSaved(prevSaved)
      onToggleSave?.(post.id, prevSaved)
    }
  }

  function handleShare() {
    Share.share({
      message: `Check out @${post.author.username}'s Voice on Private Voices: "${post.content.slice(0, 80)}..."`,
      url: `https://privatevoices.app/post/${post.id}`,
    })
  }

  async function handleLoadComments() {
    if (!showComments && comments.length === 0) {
      setLoadingComments(true)
      let { data, error } = await supabase
        .from('comments')
        .select('*, author:profiles!comments_author_id_fkey(id, username, display_name, avatar_url)')
        .eq('post_id', post.id)
        .order('created_at', { ascending: true })

      if (error || !data) {
        const fallback = await supabase
          .from('comments')
          .select('*')
          .eq('post_id', post.id)
          .order('created_at', { ascending: true })
        data = fallback.data
      }

      setComments(data ?? [])
      setLoadingComments(false)
    }
    setShowComments(!showComments)
  }

  async function handleAddComment() {
    if (!commentText.trim()) return
    if (!currentUserId) {
      Alert.alert('Login Required', 'Please log in to leave a comment.')
      return
    }

    setSubmittingComment(true)
    const { data: newComment, error } = await supabase
      .from('comments')
      .insert({
        post_id: post.id,
        author_id: currentUserId,
        content: commentText.trim(),
      })
      .select('*, author:profiles!comments_author_id_fkey(id, username, display_name, avatar_url)')
      .maybeSingle()

    if (error) {
      Alert.alert('Error', error.message)
    } else if (newComment) {
      setComments((prev) => [...prev, newComment])
      setCommentText('')
      setCommentCount((prev) => prev + 1)
    }
    setSubmittingComment(false)
  }

  function handleOpenOptionsMenu() {
    const options: any[] = [
      {
        text: 'Report Post',
        onPress: () => {
          Alert.prompt(
            'Report Post',
            'Please describe why you are reporting this post:',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Submit',
                onPress: async (reason) => {
                  if (!currentUserId || !reason?.trim()) return
                  await supabase.from('content_reports').insert({
                    reporter_id: currentUserId,
                    target_type: 'post',
                    target_id: post.id,
                    reason: reason.trim(),
                  })
                  Alert.alert('Report submitted', 'Thank you. Our moderation team will review this content.')
                },
              },
            ]
          )
        },
      },
    ]

    if (!isOwner && currentUserId) {
      options.push({
        text: `Block @${post.author.username}`,
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Block User',
            `Are you sure you want to block @${post.author.username}?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Block',
                style: 'destructive',
                onPress: async () => {
                  await supabase.from('user_blocks').insert({
                    blocker_id: currentUserId,
                    blocked_id: post.authorId,
                  })
                  Alert.alert('Blocked', `@${post.author.username} has been blocked.`)
                },
              },
            ]
          )
        },
      })
    }

    // Allow viewing insights for any post (especially owner's)
    options.unshift({
      text: 'View Insights & Progression 📈',
      onPress: () => setShowInsightsModal(true),
    })

    if (isOwner) {
      options.push({
        text: 'Delete Post',
        style: 'destructive',
        onPress: handleDelete,
      })
    }

    options.push({ text: 'Cancel', style: 'cancel' })

    Alert.alert('Post Options', undefined, options)
  }

  function handleDelete() {
    Alert.alert('Delete post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('posts').delete().eq('id', post.id)
          if (!error && onDelete) {
            onDelete(post.id)
          }
        },
      },
    ])
  }

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.authorGroup}
          onPress={() => onPressAuthor?.(post.authorId)}
          activeOpacity={onPressAuthor ? 0.7 : 1}
          disabled={!onPressAuthor}
        >
          <View style={styles.avatarCircle}>
            {post.author.avatarUrl ? (
              <Image source={{ uri: post.author.avatarUrl }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarInitial}>
                {post.author.displayName.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View>
            <Text style={styles.displayName}>{post.author.displayName}</Text>
            <Text style={styles.username}>@{post.author.username}</Text>
            {post.community && (
              <TouchableOpacity
                onPress={() => router.push(`/community/${post.community?.slug}` as any)}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 }}
              >
                <Text style={{ fontSize: 11 }}>📌</Text>
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.brand }}>
                  {post.community.name}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleOpenOptionsMenu} style={styles.deleteBtn}>
          <MoreVertical size={20} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {/* Body */}
      <FormattedText
        text={post.content}
        style={styles.content}
        onPressMention={onPressMention}
        onPressHashtag={(tag) => {
          if (onPressHashtag) {
            onPressHashtag(tag)
          } else {
            router.push({
              pathname: '/(tabs)/explore',
              params: { q: tag, tab: 'voices' },
            } as any)
          }
        }}
      />

      {/* Interactive Poll */}
      <MobileInteractivePoll
        postId={post.id}
        currentUserId={currentUserId}
        initialPoll={post.poll}
      />

      {/* Attached Media */}
      {post.imageUrls && post.imageUrls.length > 0 && (
        <View
          style={styles.mediaSection}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width
            if (w > 0) setCarouselWidth(w)
          }}
        >
          {post.imageUrls.length === 1 ? (
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.singleImageContainer}
              onPress={() => {
                setModalImageIndex(0)
                setModalVisible(true)
              }}
            >
              <Image
                source={{ uri: post.imageUrls[0] }}
                style={styles.singleImage}
                contentFit="cover"
                transition={200}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.carouselContainer}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  if (carouselWidth > 0) {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / carouselWidth)
                    setActiveImageIndex(Math.max(0, Math.min(idx, post.imageUrls.length - 1)))
                  }
                }}
              >
                {post.imageUrls.map((url, idx) => (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.9}
                    style={{ width: carouselWidth || 300, height: 240 }}
                    onPress={() => {
                      setModalImageIndex(idx)
                      setModalVisible(true)
                    }}
                  >
                    <Image
                      source={{ uri: url }}
                      style={styles.carouselImage}
                      contentFit="cover"
                      transition={200}
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Counter Pill */}
              <View style={styles.counterBadge}>
                <Text style={styles.counterText}>
                  {activeImageIndex + 1}/{post.imageUrls.length}
                </Text>
              </View>

              {/* Dots */}
              <View style={styles.dotsRow}>
                {post.imageUrls.map((_, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.dot,
                      idx === activeImageIndex ? styles.activeDot : styles.inactiveDot,
                    ]}
                  />
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* Full-screen Image Viewer Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalCounter}>
              {modalImageIndex + 1} / {post.imageUrls?.length ?? 1}
            </Text>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.modalCloseBtn}
            >
              <X size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            {post.imageUrls && post.imageUrls[modalImageIndex] && (
              <Image
                source={{ uri: post.imageUrls[modalImageIndex] }}
                style={styles.modalImage}
                contentFit="contain"
              />
            )}

            {post.imageUrls && post.imageUrls.length > 1 && (
              <>
                {modalImageIndex > 0 && (
                  <TouchableOpacity
                    style={[styles.modalNavBtn, styles.modalNavLeft]}
                    onPress={() => setModalImageIndex((prev) => prev - 1)}
                  >
                    <ChevronLeft size={28} color="#ffffff" />
                  </TouchableOpacity>
                )}
                {modalImageIndex < post.imageUrls.length - 1 && (
                  <TouchableOpacity
                    style={[styles.modalNavBtn, styles.modalNavRight]}
                    onPress={() => setModalImageIndex((prev) => prev + 1)}
                  >
                    <ChevronRight size={28} color="#ffffff" />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Footer / Actions (Order: Comment -> Repost -> Like -> Views -> Bookmark -> Share) */}
      <View style={styles.footer}>
        {/* 1. Comment */}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handleLoadComments}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={`Comment. ${commentCount} comments`}
        >
          <MessageCircle size={18} color={showComments ? colors.brand : colors.gray500} />
          <Text style={[styles.actionText, showComments && { color: colors.brand, fontWeight: '600' }]}>
            {commentCount}
          </Text>
        </TouchableOpacity>

        {/* 2. Repost */}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handleToggleRepost}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={`Repost. ${repostCount} reposts`}
          accessibilityState={{ selected: isReposted }}
        >
          <Repeat size={18} color={isReposted ? '#10b981' : colors.gray500} />
          <Text style={[styles.actionText, isReposted && { color: '#10b981', fontWeight: '600' }]}>
            {repostCount}
          </Text>
        </TouchableOpacity>

        {/* 3. Like */}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handleToggleLike}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={`Like. ${likeCount} likes`}
          accessibilityState={{ selected: isLiked }}
        >
          <Animated.View style={animatedHeartStyle}>
            <Heart
              size={18}
              color={isLiked ? '#ef4444' : colors.gray500}
              fill={isLiked ? '#ef4444' : 'none'}
            />
          </Animated.View>
          <Text style={[styles.actionText, isLiked && styles.likedText]}>{likeCount}</Text>
        </TouchableOpacity>

        {/* 4. Views */}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => setShowInsightsModal(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={`Views. ${viewCount} views`}
        >
          <BarChart2 size={18} color={colors.gray500} />
          <Text style={styles.actionText}>
            {viewCount}
          </Text>
        </TouchableOpacity>

        {/* 5. Bookmark */}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handleToggleSave}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Bookmark post"
          accessibilityState={{ selected: isSaved }}
        >
          <Bookmark
            size={18}
            color={isSaved ? colors.brand : colors.gray500}
            fill={isSaved ? colors.brand : 'none'}
          />
        </TouchableOpacity>

        {/* 6. Share */}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handleShare}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Share post"
        >
          <Share2 size={18} color={colors.gray500} />
        </TouchableOpacity>
      </View>

      {/* Expandable Comments Section */}
      {showComments && (
        <View style={styles.commentsContainer}>
          {/* Mention Autocomplete suggestions bar */}
          <MentionSuggestions
            query={mentionQuery ?? ''}
            visible={isMentioning}
            onSelect={handleSelectMention}
          />

          {/* Add Comment Input */}
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              placeholder="Write a comment... (use @ to mention)"
              placeholderTextColor="#9ca3af"
              value={commentText}
              onChangeText={setCommentText}
            />
            <TouchableOpacity
              style={[
                styles.sendCommentBtn,
                (!commentText.trim() || submittingComment) && styles.sendCommentBtnDisabled,
              ]}
              onPress={handleAddComment}
              disabled={!commentText.trim() || submittingComment}
            >
              {submittingComment ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Send size={16} color="#ffffff" />
              )}
            </TouchableOpacity>
          </View>

          {/* Comment List */}
          {loadingComments ? (
            <ActivityIndicator size="small" color={colors.brand} style={{ paddingVertical: 8 }} />
          ) : comments.length === 0 ? (
            <Text style={styles.noCommentsText}>No comments yet. Be the first!</Text>
          ) : (
            <View style={styles.commentsList}>
              {comments.map((c) => (
                <View key={c.id} style={styles.commentItem}>
                  <TouchableOpacity
                    onPress={() => {
                      if (onPressMention && c.author?.username) onPressMention(c.author.username)
                      else if (c.author_id && onPressAuthor) onPressAuthor(c.author_id)
                    }}
                    disabled={!onPressMention && !onPressAuthor}
                  >
                    <Text style={styles.commentAuthor}>@{c.author?.username || 'user'}:</Text>
                  </TouchableOpacity>
                  <FormattedText
                    text={c.content}
                    style={styles.commentBody}
                    onPressMention={onPressMention}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Post Progression & Insights Modal */}
      <PostInsightsModal
        visible={showInsightsModal}
        post={post}
        onClose={() => setShowInsightsModal(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  authorGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 40,
    height: 40,
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.brand,
  },
  displayName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.gray900,
  },
  username: {
    fontSize: 12,
    color: colors.gray500,
  },
  deleteBtn: {
    padding: 4,
  },
  content: {
    fontSize: 15,
    color: colors.gray800,
    lineHeight: 22,
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  actionText: {
    fontSize: 13,
    color: colors.gray500,
  },
  likedText: {
    color: '#ef4444',
    fontWeight: '600',
  },
  commentsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 10,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.gray900,
  },
  sendCommentBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendCommentBtnDisabled: {
    backgroundColor: colors.gray300,
  },
  noCommentsText: {
    fontSize: 12,
    color: colors.gray400,
    textAlign: 'center',
    paddingVertical: 6,
  },
  commentsList: {
    gap: 8,
  },
  commentItem: {
    backgroundColor: '#f9fafb',
    padding: 10,
    borderRadius: 10,
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gray900,
  },
  commentBody: {
    fontSize: 12,
    color: colors.gray700,
    flexShrink: 1,
  },
  mediaSection: {
    marginBottom: 14,
    borderRadius: 12,
    overflow: 'hidden',
  },
  singleImageContainer: {
    width: '100%',
    height: 240,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
  },
  singleImage: {
    width: '100%',
    height: '100%',
  },
  carouselContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
  },
  carouselImage: {
    width: '100%',
    height: '100%',
  },
  counterBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    zIndex: 10,
  },
  counterText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    zIndex: 10,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  activeDot: {
    width: 18,
    backgroundColor: '#ffffff',
  },
  inactiveDot: {
    width: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalCounter: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalCloseBtn: {
    padding: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
  },
  modalBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalNavBtn: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -24 }],
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 24,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalNavLeft: {
    left: 12,
  },
  modalNavRight: {
    right: 12,
  },
})
