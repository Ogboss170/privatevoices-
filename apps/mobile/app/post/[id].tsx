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
  Share,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ArrowLeft, Send, Heart, Repeat, Bookmark, Share2, MessageCircle } from 'lucide-react-native'
import { Image } from 'expo-image'
import { supabase } from '../../lib/supabase'
import { colors } from '../../constants/colors'
import { MobilePostCard } from '../../components/MobilePostCard'
import { PublicProfileModal } from '../../components/PublicProfileModal'
import { FormattedText } from '../../components/FormattedText'
import { MentionSuggestions } from '../../components/MentionSuggestions'
import type { Post } from '@private-voices/shared'
import { extractPostMediaAndCleanContent } from '@private-voices/shared'

export default function PostDetailScreen() {
  const params = useLocalSearchParams()
  const postId = params.id as string
  const router = useRouter()

  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [replyToComment, setReplyToComment] = useState<{ id: string; username: string } | null>(null)
  const [selectedProfileTarget, setSelectedProfileTarget] = useState<{ userId?: string; username?: string } | null>(null)

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

  const fetchPostDetail = useCallback(async () => {
    setLoading(true)
    const { data: userRes } = await supabase.auth.getUser()
    const uId = userRes?.user?.id || null
    setCurrentUserId(uId)

    // 1. Fetch Post
    let { data: p, error: pErr } = await supabase
      .from('posts')
      .select('*, author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url), community:communities!posts_community_id_fkey(id, name, slug)')
      .eq('id', postId)
      .maybeSingle()

    if (pErr || !p) {
      const fallback = await supabase.from('posts').select('*').eq('id', postId).maybeSingle()
      p = fallback.data
    }

    if (!p) {
      setLoading(false)
      return
    }

    // Author metadata
    let authorObj = p.author
    if (!authorObj) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .eq('id', p.author_id)
        .maybeSingle()
      authorObj = prof
    }

    // Likes / Saved / Repost / Counts
    let likeCount = 0, commentCount = 0, repostCount = 0, viewCount = 0
    let isLiked = false, isSaved = false, isReposted = false

    try {
      const [{ count: lc }, { count: cc }, { count: rc }, { count: vc }] = await Promise.all([
        supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
        supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
        supabase.from('reposts').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
        supabase.from('post_views').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
      ])
      likeCount = lc ?? 0
      commentCount = cc ?? 0
      repostCount = rc ?? 0
      viewCount = vc ?? 0

      if (uId) {
        const [{ data: myLike }, { data: mySave }, { data: myRepost }] = await Promise.all([
          supabase.from('likes').select('user_id').match({ user_id: uId, post_id: p.id }).maybeSingle(),
          supabase.from('saved_posts').select('user_id').match({ user_id: uId, post_id: p.id }).maybeSingle(),
          supabase.from('reposts').select('user_id').match({ user_id: uId, post_id: p.id }).maybeSingle(),
        ])
        isLiked = !!myLike
        isSaved = !!mySave
        isReposted = !!myRepost
      }
    } catch {
      // ignore
    }

    const { content: cleanContent, imageUrls } = extractPostMediaAndCleanContent(p.content, p.image_urls)

    setPost({
      id: p.id,
      authorId: p.author_id,
      author: {
        id: authorObj?.id || p.author_id,
        username: authorObj?.username || 'user',
        displayName: authorObj?.display_name || 'User',
        avatarUrl: authorObj?.avatar_url || null,
      },
      community: p.community ? { id: p.community.id, name: p.community.name, slug: p.community.slug } : undefined,
      content: cleanContent,
      imageUrls,
      hashtags: [],
      likeCount,
      commentCount,
      repostCount,
      viewCount,
      isLikedByMe: isLiked,
      isSavedByMe: isSaved,
      isRepostedByMe: isReposted,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    })

    // 2. Fetch Comments Thread
    let { data: comms } = await supabase
      .from('comments')
      .select('*, author:profiles!comments_author_id_fkey(id, username, display_name, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    if (!comms) {
      const fbComms = await supabase.from('comments').select('*').eq('post_id', postId).order('created_at', { ascending: true })
      comms = fbComms.data
    }

    setComments(comms ?? [])
    setLoading(false)
  }, [postId])

  useEffect(() => {
    fetchPostDetail()
  }, [fetchPostDetail])

  async function handleAddComment() {
    if (!commentText.trim() || !post) return
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
      setComments((prev) => [...prev, newComment])
      setCommentText('')
      setReplyToComment(null)
      setPost((prev) => (prev ? { ...prev, commentCount: prev.commentCount + 1 } : null))
    }
    setSubmittingComment(false)
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      </SafeAreaView>
    )
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Voice Not Found</Text>
          <TouchableOpacity style={styles.backBtnAction} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Top Header */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <ArrowLeft size={20} color={colors.gray800} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Voice Thread</Text>
        </View>

        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
          {/* Main Full Post Card */}
          <MobilePostCard
            post={post}
            currentUserId={currentUserId || undefined}
            onDelete={() => router.back()}
            onPressAuthor={(authorId) => setSelectedProfileTarget({ userId: authorId })}
            onPressMention={(username) => setSelectedProfileTarget({ username })}
          />

          {/* Comments Section */}
          <View style={styles.commentsSection}>
            <Text style={styles.commentsSectionTitle}>
              Comments ({comments.length})
            </Text>

            {comments.length === 0 ? (
              <View style={styles.emptyCommentsCard}>
                <Text style={styles.emptyCommentsTitle}>No comments yet</Text>
                <Text style={styles.emptyCommentsSub}>Be the first to share your thoughts on this Voice.</Text>
              </View>
            ) : (
              comments.map((comment) => {
                const author = comment.author
                const displayName = author?.display_name || author?.username || 'User'
                const username = author?.username || 'user'
                return (
                  <View key={comment.id} style={styles.commentCard}>
                    <TouchableOpacity
                      style={styles.commentAvatarCircle}
                      onPress={() => author?.id && setSelectedProfileTarget({ userId: author.id })}
                    >
                      {author?.avatar_url ? (
                        <Image source={{ uri: author.avatar_url }} style={styles.commentAvatarImg} />
                      ) : (
                        <Text style={styles.commentAvatarLetter}>{displayName.charAt(0).toUpperCase()}</Text>
                      )}
                    </TouchableOpacity>

                    <View style={styles.commentBodyWrapper}>
                      <View style={styles.commentMetaRow}>
                        <TouchableOpacity onPress={() => author?.id && setSelectedProfileTarget({ userId: author.id })}>
                          <Text style={styles.commentDisplayName}>{displayName}</Text>
                        </TouchableOpacity>
                        <Text style={styles.commentUsername}>@{username}</Text>
                      </View>

                      <FormattedText
                        text={comment.content}
                        style={styles.commentText}
                        onPressMention={(u) => setSelectedProfileTarget({ username: u })}
                      />

                      <TouchableOpacity
                        style={styles.replyActionBtn}
                        onPress={() => {
                          setReplyToComment({ id: comment.id, username })
                          setCommentText(`@${username} `)
                        }}
                      >
                        <Text style={styles.replyActionText}>Reply</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )
              })
            )}
          </View>
        </ScrollView>

        {/* Floating Reply Indicator */}
        {replyToComment && (
          <View style={styles.replyingBar}>
            <Text style={styles.replyingText}>Replying to @{replyToComment.username}</Text>
            <TouchableOpacity onPress={() => setReplyToComment(null)}>
              <Text style={styles.cancelReplyText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Comment Composer Input Bar */}
        <View style={styles.inputBarContainer}>
          <MentionSuggestions
            query={mentionQuery ?? ''}
            visible={isMentioning}
            onSelect={handleSelectMention}
          />
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              placeholder="Write your reply... (use @ to mention)"
              placeholderTextColor={colors.gray400}
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!commentText.trim() || submittingComment) && styles.sendBtnDisabled,
              ]}
              disabled={!commentText.trim() || submittingComment}
              onPress={handleAddComment}
            >
              {submittingComment ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Send size={16} color="#ffffff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

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
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  container: { flex: 1, backgroundColor: colors.gray50 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  iconBtn: { padding: 6, borderRadius: 8, backgroundColor: colors.gray100 },
  topBarTitle: { fontSize: 17, fontWeight: '700', color: colors.gray900 },

  scrollContainer: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },

  commentsSection: { marginTop: 12, gap: 12 },
  commentsSectionTitle: { fontSize: 16, fontWeight: '700', color: colors.gray900, marginBottom: 4 },

  emptyCommentsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray200,
    gap: 4,
  },
  emptyCommentsTitle: { fontSize: 15, fontWeight: '700', color: colors.gray900 },
  emptyCommentsSub: { fontSize: 13, color: colors.gray500, textAlign: 'center' },

  commentCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  commentAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  commentAvatarImg: { width: 36, height: 36 },
  commentAvatarLetter: { fontSize: 14, fontWeight: '700', color: colors.brand },
  commentBodyWrapper: { flex: 1 },
  commentMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  commentDisplayName: { fontSize: 13, fontWeight: '700', color: colors.gray900 },
  commentUsername: { fontSize: 12, color: colors.gray500 },
  commentText: { fontSize: 14, color: colors.gray800, lineHeight: 20 },
  replyActionBtn: { marginTop: 6 },
  replyActionText: { fontSize: 12, fontWeight: '600', color: colors.brand },

  replyingBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.brandLight,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.brand + '30',
  },
  replyingText: { fontSize: 12, fontWeight: '600', color: colors.brand },
  cancelReplyText: { fontSize: 12, color: colors.gray600, fontWeight: '600' },

  inputBarContainer: { backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: colors.gray200 },
  inputBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  input: {
    flex: 1,
    backgroundColor: colors.gray100,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.gray900,
    maxHeight: 100,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },

  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.gray900, marginBottom: 8 },
  backBtnAction: { backgroundColor: colors.brand, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  backBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
})
