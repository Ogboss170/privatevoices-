import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, Share, TextInput, ActivityIndicator } from 'react-native'
import { Heart, MessageCircle, Bookmark, Share2, Trash2, MoreVertical, Flag, ShieldOff, Send } from 'lucide-react-native'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'
import type { Post } from '@private-voices/shared'

interface MobilePostCardProps {
  post: Post
  currentUserId?: string
  onDelete?: (postId: string) => void
}

export function MobilePostCard({ post, currentUserId, onDelete }: MobilePostCardProps) {
  const [isLiked, setIsLiked] = useState(post.isLikedByMe)
  const [likeCount, setLikeCount] = useState(post.likeCount)
  const [isSaved, setIsSaved] = useState(post.isSavedByMe)
  const [commentCount, setCommentCount] = useState(post.commentCount)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<any[]>([])
  const [commentText, setCommentText] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)

  const isOwner = currentUserId === post.authorId

  async function handleToggleLike() {
    const prevLiked = isLiked
    const prevCount = likeCount
    setIsLiked(!prevLiked)
    setLikeCount(prevLiked ? prevCount - 1 : prevCount + 1)

    try {
      if (prevLiked) {
        await supabase.from('likes').delete().match({ user_id: currentUserId, post_id: post.id })
      } else {
        await supabase.from('likes').insert({ user_id: currentUserId, post_id: post.id })
      }
    } catch {
      setIsLiked(prevLiked)
      setLikeCount(prevCount)
    }
  }

  async function handleToggleSave() {
    const prevSaved = isSaved
    setIsSaved(!prevSaved)

    try {
      if (prevSaved) {
        await supabase.from('saved_posts').delete().match({ user_id: currentUserId, post_id: post.id })
      } else {
        await supabase.from('saved_posts').insert({ user_id: currentUserId, post_id: post.id })
      }
    } catch {
      setIsSaved(prevSaved)
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
        <View style={styles.authorGroup}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>
              {post.author.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.displayName}>{post.author.displayName}</Text>
            <Text style={styles.username}>@{post.author.username}</Text>
          </View>
        </View>

        <TouchableOpacity onPress={handleOpenOptionsMenu} style={styles.deleteBtn}>
          <MoreVertical size={20} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {/* Body */}
      <Text style={styles.content}>{post.content}</Text>

      {/* Footer / Actions */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleToggleLike}>
          <Heart
            size={20}
            color={isLiked ? '#ef4444' : colors.gray400}
            fill={isLiked ? '#ef4444' : 'none'}
          />
          <Text style={[styles.actionText, isLiked && styles.likedText]}>{likeCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleLoadComments}>
          <MessageCircle size={20} color={showComments ? colors.brand : colors.gray400} />
          <Text style={[styles.actionText, showComments && { color: colors.brand, fontWeight: '600' }]}>
            {commentCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleToggleSave}>
          <Bookmark
            size={20}
            color={isSaved ? colors.brand : colors.gray400}
            fill={isSaved ? colors.brand : 'none'}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
          <Share2 size={20} color={colors.gray400} />
        </TouchableOpacity>
      </View>

      {/* Expandable Comments Section */}
      {showComments && (
        <View style={styles.commentsContainer}>
          {/* Add Comment Input */}
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              placeholder="Write a comment..."
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
                  <Text style={styles.commentAuthor}>@{c.author?.username || 'user'}:</Text>
                  <Text style={styles.commentBody}>{c.content}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
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
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
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
})
