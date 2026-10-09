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
  Pin,
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
import { UserBadgesRow, CommunityRoleBadge } from './PlatformBadge'
import { useTheme } from '../context/ThemeContext'

interface MobilePostCardProps {
  post: Post
  currentUserId?: string
  communityRole?: 'owner' | 'moderator' | 'vip' | 'member' | null
  onDelete?: (postId: string) => void
  onPressAuthor?: (userId: string) => void
  onPressMention?: (username: string) => void
  onPressHashtag?: (hashtag: string) => void
  onToggleSave?: (postId: string, isSaved: boolean) => void
  onTogglePin?: (postId: string, isPinned: boolean) => void
}

export function MobilePostCard({ post, currentUserId, communityRole, onDelete, onPressAuthor, onPressMention, onPressHashtag, onToggleSave, onTogglePin }: MobilePostCardProps) {
  const router = useRouter()
  const { colors: themeColors, isDark } = useTheme()
  const [authorBadges, setAuthorBadges] = useState<string[]>([])
  const [authorCommunityRole, setAuthorCommunityRole] = useState<string | null>(null)
  const [isLiked, setIsLiked] = useState(post.isLikedByMe)
  const [isPinned, setIsPinned] = useState(post.isPinned || false)
  const [pinBusy, setPinBusy] = useState(false)
  const [canModerateCommunity, setCanModerateCommunity] = useState(
    communityRole === 'owner' || communityRole === 'moderator'
  )

  useEffect(() => {
    async function loadAuthorBadges() {
      if (!post.authorId) return
      try {
        const { data } = await supabase
          .from('user_badges')
          .select('badge_id')
          .eq('user_id', post.authorId)
          .is('revoked_at', null)

        if (data) {
          setAuthorBadges(data.map((b) => b.badge_id))
        }
      } catch {
        // Safe fallback
      }
    }
    loadAuthorBadges()
  }, [post.authorId])

  useEffect(() => {
    async function loadAuthorCommunityRole() {
      if (!post.authorId || !post.communityId) {
        setAuthorCommunityRole(null)
        return
      }
      try {
        const { data } = await supabase
          .from('community_members')
          .select('role')
          .match({ community_id: post.communityId, user_id: post.authorId })
          .maybeSingle()

        if (data?.role) {
          setAuthorCommunityRole(data.role)
        } else {
          setAuthorCommunityRole(null)
        }
      } catch {
        setAuthorCommunityRole(null)
      }
    }
    loadAuthorCommunityRole()
  }, [post.authorId, post.communityId])

  useEffect(() => {
    async function checkCommunityModStatus() {
      if (communityRole !== undefined) {
        setCanModerateCommunity(communityRole === 'owner' || communityRole === 'moderator')
        return
      }
      if (!currentUserId || !post.communityId) {
        setCanModerateCommunity(false)
        return
      }
      try {
        const { data } = await supabase
          .from('community_members')
          .select('role')
          .match({ community_id: post.communityId, user_id: currentUserId })
          .maybeSingle()

        if (data && (data.role === 'owner' || data.role === 'moderator')) {
          setCanModerateCommunity(true)
        } else {
          setCanModerateCommunity(false)
        }
      } catch {
        setCanModerateCommunity(false)
      }
    }
    checkCommunityModStatus()
  }, [currentUserId, post.communityId, communityRole])

  async function handleTogglePin() {
    if (pinBusy) return
    setPinBusy(true)
    const nextPinned = !isPinned
    setIsPinned(nextPinned)

    try {
      const { error } = await supabase
        .from('posts')
        .update({
          is_pinned: nextPinned,
          pinned_at: nextPinned ? new Date().toISOString() : null,
          pinned_by: nextPinned ? currentUserId : null,
        })
        .eq('id', post.id)

      if (error) {
        setIsPinned(!nextPinned)
        Alert.alert('Error', `Failed to ${nextPinned ? 'pin' : 'unpin'} post: ${error.message}`)
      } else {
        onTogglePin?.(post.id, nextPinned)
        Alert.alert('Success', `Post ${nextPinned ? 'pinned to community top' : 'unpinned'}`)
      }
    } catch (err: any) {
      setIsPinned(!nextPinned)
      Alert.alert('Error', `Pin update failed: ${err.message}`)
    } finally {
      setPinBusy(false)
    }
  }
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

  // Real-Time Comments & Reaction Updates
  useEffect(() => {
    const channel = supabase
      .channel(`post-mobile-realtime:${post.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `post_id=eq.${post.id}`,
        },
        async (payload) => {
          const newComm = payload.new as any
          let authorData = null
          if (newComm.author_id) {
            const { data } = await supabase
              .from('profiles')
              .select('id, username, display_name, avatar_url')
              .eq('id', newComm.author_id)
              .maybeSingle()
            authorData = data
          }

          setComments((prev) => {
            if (prev.some((c) => c.id === newComm.id)) return prev
            return [
              ...prev,
              {
                ...newComm,
                author: authorData || { id: newComm.author_id, username: 'anonymous', display_name: 'Anonymous' },
                likeCount: 0,
                isLikedByMe: false,
              },
            ]
          })
          setCommentCount((c) => (c || 0) + 1)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'comments',
          filter: `post_id=eq.${post.id}`,
        },
        (payload) => {
          setComments((prev) => prev.filter((c) => c.id !== payload.old.id && c.parent_id !== payload.old.id))
          setCommentCount((c) => Math.max(0, (c || 0) - 1))
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'likes',
          filter: `post_id=eq.${post.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            if ((payload.new as any)?.user_id !== currentUserId) {
              setLikeCount((prev) => prev + 1)
            }
          } else if (payload.eventType === 'DELETE') {
            if ((payload.old as any)?.user_id !== currentUserId) {
              setLikeCount((prev) => Math.max(0, prev - 1))
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comment_likes',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as any
            if (row.user_id !== currentUserId) {
              setComments((prev) =>
                prev.map((c) => (c.id === row.comment_id ? { ...c, likeCount: (c.likeCount || 0) + 1 } : c))
              )
            }
          } else if (payload.eventType === 'DELETE') {
            const row = payload.old as any
            if (row.user_id !== currentUserId) {
              setComments((prev) =>
                prev.map((c) => (c.id === row.comment_id ? { ...c, likeCount: Math.max(0, (c.likeCount || 0) - 1) } : c))
              )
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [post.id, currentUserId])

  // Reanimated heart scale value
  const heartScale = useSharedValue(1)
  const animatedHeartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }))
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<any[]>([])
  const [commentSort, setCommentSort] = useState<'newest' | 'top'>('newest')
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

  async function handleDeleteComment(commentId: string) {
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const prevComments = [...comments]
            setComments((prev) => prev.filter((c) => c.id !== commentId && c.parent_id !== commentId))
            setCommentCount((c) => Math.max(0, (c || 0) - 1))

            try {
              const { error } = await supabase.from('comments').delete().eq('id', commentId)
              if (error) {
                setComments(prevComments)
                setCommentCount((c) => (c || 0) + 1)
                Alert.alert('Error', error.message)
              }
            } catch (err: any) {
              setComments(prevComments)
              setCommentCount((c) => (c || 0) + 1)
              Alert.alert('Error', err.message)
            }
          },
        },
      ]
    )
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
        } else if (!error && post.authorId !== currentUserId) {
          await supabase.from('notifications').insert({
            recipient_id: post.authorId,
            actor_id: currentUserId,
            type: 'post_repost',
            title: 'Voice Reposted 🔄',
            message: 'reposted your Voice.',
            entity_type: 'post',
            entity_id: post.id,
            is_read: false,
          })
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

      const commentList = data ?? []
      if (commentList.length > 0) {
        const commentIds = commentList.map((c: any) => c.id)

        // Fetch like counts and user's likes
        const [likesRes, myLikesRes] = await Promise.all([
          supabase.from('comment_likes').select('comment_id').in('comment_id', commentIds),
          currentUserId
            ? supabase.from('comment_likes').select('comment_id').eq('user_id', currentUserId).in('comment_id', commentIds)
            : Promise.resolve({ data: [] }),
        ])

        const likeCountsMap = new Map<string, number>()
        ;(likesRes.data || []).forEach((row: any) => {
          likeCountsMap.set(row.comment_id, (likeCountsMap.get(row.comment_id) || 0) + 1)
        })

        const myLikedSet = new Set((myLikesRes.data || []).map((row: any) => row.comment_id))

        setComments(
          commentList.map((c: any) => ({
            ...c,
            likeCount: likeCountsMap.get(c.id) || 0,
            isLikedByMe: myLikedSet.has(c.id),
          }))
        )
      } else {
        setComments([])
      }
      setLoadingComments(false)
    }
    setShowComments(!showComments)
  }

  async function handleToggleLikeComment(commentId: string) {
    if (!currentUserId) {
      Alert.alert('Login Required', 'Please log in to like comments.')
      return
    }

    const currentComment = comments.find((c) => c.id === commentId)
    if (!currentComment) return

    const wasLiked = !!currentComment.isLikedByMe
    const newLiked = !wasLiked
    const newCount = Math.max(0, (currentComment.likeCount || 0) + (newLiked ? 1 : -1))

    // Optimistic UI update
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, isLikedByMe: newLiked, likeCount: newCount }
          : c
      )
    )

    try {
      if (newLiked) {
        await supabase.from('comment_likes').insert({
          user_id: currentUserId,
          comment_id: commentId,
        })
      } else {
        await supabase
          .from('comment_likes')
          .delete()
          .match({ user_id: currentUserId, comment_id: commentId })
      }
    } catch {
      // Revert optimistic update
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, isLikedByMe: wasLiked, likeCount: currentComment.likeCount || 0 }
            : c
        )
      )
    }
  }

  const [replyToComment, setReplyToComment] = useState<{ id: string; username: string } | null>(null)

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
        parent_id: replyToComment?.id || null,
      })
      .select('*, author:profiles!comments_author_id_fkey(id, username, display_name, avatar_url)')
      .maybeSingle()

    if (error) {
      Alert.alert('Error', error.message)
    } else if (newComment) {
      setComments((prev) => [...prev, { ...newComment, likeCount: 0, isLikedByMe: false }])
      setCommentText('')

      if (replyToComment) {
        const { data: parentComm } = await supabase
          .from('comments')
          .select('author_id')
          .eq('id', replyToComment.id)
          .maybeSingle()

        if (parentComm && parentComm.author_id !== currentUserId) {
          await supabase.from('notifications').insert({
            recipient_id: parentComm.author_id,
            actor_id: currentUserId,
            type: 'comment_reply',
            title: 'New Reply 💬',
            message: 'replied to your comment.',
            entity_type: 'post',
            entity_id: post.id,
            is_read: false,
          })
        }
      } else if (post.authorId !== currentUserId) {
        await supabase.from('notifications').insert({
          recipient_id: post.authorId,
          actor_id: currentUserId,
          type: 'post_comment',
          title: 'New Comment 💬',
          message: 'commented on your Voice.',
          entity_type: 'post',
          entity_id: post.id,
          is_read: false,
        })
      }

      setReplyToComment(null)
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

    // Community Moderation: Pin / Unpin post
    if (canModerateCommunity) {
      options.unshift({
        text: isPinned ? 'Unpin from Community 📌' : 'Pin to Community 📌',
        onPress: handleTogglePin,
      })
    }

    // Post Analytics & Insights: strictly for post author only
    if (isOwner) {
      options.unshift({
        text: 'Post Analytics & Insights 📈',
        onPress: () => setShowInsightsModal(true),
      })
    }

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
    <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
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
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={[styles.displayName, { color: themeColors.textPrimary }]}>{post.author.displayName}</Text>
              <UserBadgesRow badges={authorBadges} size={14} />
              {post.communityId && authorCommunityRole && (
                <CommunityRoleBadge role={authorCommunityRole} size={14} showLabel={false} />
              )}
            </View>
            <Text style={[styles.username, { color: themeColors.textMuted }]}>@{post.author.username}</Text>
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

      {/* Pinned Post Badge Banner */}
      {isPinned && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#f3e8ff', alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, marginBottom: 8 }}>
          <Pin size={12} color="#7e22ce" />
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#7e22ce' }}>Pinned Post</Text>
        </View>
      )}

      {/* Body — Tapping opens full Post Detail Thread */}
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={() => router.push(`/post/${post.id}` as any)}
      >
        <FormattedText
          text={post.content}
          style={[styles.content, { color: themeColors.textPrimary }]}
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
      </TouchableOpacity>

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

        {/* 4. Views: Author can tap to view Analytics & Insights; Public cannot tap (display-only) */}
        {isOwner ? (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setShowInsightsModal(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={`Views. ${viewCount} views. Tap to open analytics`}
          >
            <BarChart2 size={18} color={colors.brand} />
            <Text style={[styles.actionText, { color: colors.brand, fontWeight: '600' }]}>
              {viewCount}
            </Text>
          </TouchableOpacity>
        ) : (
          <View
            style={styles.actionBtn}
            accessibilityLabel={`Views. ${viewCount} views`}
          >
            <BarChart2 size={18} color={colors.gray500} />
            <Text style={styles.actionText}>
              {viewCount}
            </Text>
          </View>
        )}

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
              {/* Sort selector */}
              <View style={styles.commentSortRow}>
                <Text style={styles.commentSortTitle}>Comments</Text>
                <View style={styles.commentSortTabs}>
                  <TouchableOpacity
                    onPress={() => setCommentSort('newest')}
                    style={[styles.commentSortTab, commentSort === 'newest' && styles.commentSortTabActive]}
                  >
                    <Text style={[styles.commentSortTabText, commentSort === 'newest' && styles.commentSortTabTextActive]}>
                      Newest
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setCommentSort('top')}
                    style={[styles.commentSortTab, commentSort === 'top' && styles.commentSortTabActive]}
                  >
                    <Text style={[styles.commentSortTabText, commentSort === 'top' && styles.commentSortTabTextActive]}>
                      Top
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {[...comments]
                .sort((a, b) => {
                  if (commentSort === 'top') {
                    const diff = (b.likeCount || 0) - (a.likeCount || 0)
                    if (diff !== 0) return diff
                  }
                  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                })
                .map((c) => {
                  const canDelete = currentUserId && (currentUserId === c.author_id || currentUserId === post.authorId)
                  return (
                    <View key={c.id} style={styles.commentItem}>
                      <View style={{ flex: 1, flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity
                          onPress={() => handleToggleLikeComment(c.id)}
                          style={styles.commentLikeBtn}
                          activeOpacity={0.7}
                          accessibilityLabel={c.isLikedByMe ? 'Unlike comment' : 'Like comment'}
                        >
                          <Heart
                            size={14}
                            color={c.isLikedByMe ? '#ef4444' : colors.gray400}
                            fill={c.isLikedByMe ? '#ef4444' : 'transparent'}
                          />
                          {(c.likeCount || 0) > 0 && (
                            <Text style={[styles.commentLikeCount, c.isLikedByMe && { color: '#ef4444', fontWeight: '700' }]}>
                              {c.likeCount}
                            </Text>
                          )}
                        </TouchableOpacity>
                        {canDelete && (
                          <TouchableOpacity
                            onPress={() => handleDeleteComment(c.id)}
                            style={{ padding: 4 }}
                            accessibilityLabel="Delete comment"
                          >
                            <Trash2 size={13} color={colors.gray400} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )
                })}
            </View>
          )}
        </View>
      )}

      {/* Post Progression & Insights Modal */}
      <PostInsightsModal
        visible={showInsightsModal}
        post={post}
        currentUserId={currentUserId}
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
  commentSortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  commentSortTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gray400,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  commentSortTabs: {
    flexDirection: 'row',
    backgroundColor: colors.gray100,
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  commentSortTab: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  commentSortTabActive: {
    backgroundColor: '#ffffff',
  },
  commentSortTabText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.gray500,
  },
  commentSortTabTextActive: {
    fontWeight: '700',
    color: colors.gray900,
  },
  commentItem: {
    backgroundColor: '#f9fafb',
    padding: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
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
  commentLikeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
  },
  commentLikeCount: {
    fontSize: 11,
    color: colors.gray500,
    fontWeight: '600',
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
