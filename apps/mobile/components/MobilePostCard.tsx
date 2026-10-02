import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { Heart, MessageCircle, Bookmark, Share2, Trash2 } from 'lucide-react-native'
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

        {isOwner && (
          <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
            <Trash2 size={18} color="#9ca3af" />
          </TouchableOpacity>
        )}
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

        <TouchableOpacity style={styles.actionBtn}>
          <MessageCircle size={20} color={colors.gray400} />
          <Text style={styles.actionText}>{post.commentCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleToggleSave}>
          <Bookmark
            size={20}
            color={isSaved ? colors.brand : colors.gray400}
            fill={isSaved ? colors.brand : 'none'}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn}>
          <Share2 size={20} color={colors.gray400} />
        </TouchableOpacity>
      </View>
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
})
