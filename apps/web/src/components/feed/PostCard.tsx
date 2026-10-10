'use client'

import React, { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Heart, MessageCircle, Repeat, Bookmark, Share2, Trash2, MoreVertical, Flag, ShieldOff, ChevronLeft, ChevronRight, X, TrendingUp, BarChart2, Pin, Mic, Film } from 'lucide-react'
import type { Post } from '@private-voices/shared'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import FormattedText from '../common/FormattedText'
import MentionAutocomplete from '../common/MentionAutocomplete'
import InteractivePoll from './InteractivePoll'
import PostInsightsModal from './PostInsightsModal'
import { UserBadgesRow, CommunityRoleBadge } from '../common/PlatformBadge'
import VoiceWaveformPlayer from '../common/VoiceWaveformPlayer'

interface PostCardProps {
  post: Post
  currentUserId?: string
  communityRole?: 'owner' | 'moderator' | 'member' | null
  onDelete?: (postId: string) => void
  onToggleSave?: (postId: string, isSaved: boolean) => void
  onTogglePin?: (postId: string, isPinned: boolean) => void
}

export default function PostCard({ post, currentUserId, communityRole, onDelete, onToggleSave, onTogglePin }: PostCardProps): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const cardRef = useRef<HTMLDivElement>(null)
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

        if (post.communityId) {
          const { data: memberData } = await supabase
            .from('community_members')
            .select('role')
            .match({ community_id: post.communityId, user_id: post.authorId })
            .maybeSingle()
          if (memberData?.role) {
            setAuthorCommunityRole(memberData.role)
          }
        }
      } catch {
        // Safe fallback
      }
    }
    loadAuthorBadges()
  }, [supabase, post.authorId, post.communityId])

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
  }, [supabase, currentUserId, post.communityId, communityRole])
  const [likeCount, setLikeCount] = useState(post.likeCount)
  const [likeBusy, setLikeBusy] = useState(false)
  const [isReposted, setIsReposted] = useState(post.isRepostedByMe || false)
  const [repostCount, setRepostCount] = useState(post.repostCount || 0)
  const [repostBusy, setRepostBusy] = useState(false)
  const [viewCount, setViewCount] = useState(post.viewCount || 0)
  const [commentCount, setCommentCount] = useState(post.commentCount || 0)
  const [isSaved, setIsSaved] = useState(post.isSavedByMe)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<any[]>([])
  const [commentSort, setCommentSort] = useState<'newest' | 'top'>('newest')
  const [commentText, setCommentText] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [showInsightsModal, setShowInsightsModal] = useState(false)

  const isOwner = currentUserId === post.authorId

  // Meaningful View Recording (1-second visibility threshold, excludes author, 24h dedup)
  useEffect(() => {
    if (!currentUserId || isOwner || !cardRef.current) return

    let timer: NodeJS.Timeout | null = null
    let hasRecorded = false

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasRecorded) {
          timer = setTimeout(async () => {
            hasRecorded = true
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
          }, 1000) // 1 second meaningful visibility threshold
        } else {
          if (timer) {
            clearTimeout(timer)
            timer = null
          }
        }
      },
      { threshold: 0.6 } // At least 60% of post must be visible
    )

    observer.observe(cardRef.current)

    return () => {
      if (timer) clearTimeout(timer)
      observer.disconnect()
    }
  }, [post.id, currentUserId, isOwner, supabase])

  // Real-Time Comments & Reaction Updates
  useEffect(() => {
    const channel = supabase
      .channel(`post-realtime:${post.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `post_id=eq.${post.id}`,
        },
        async (payload) => {
          // Fetch author profile if comment is from another user
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
          post.commentCount = (post.commentCount || 0) + 1
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
          post.commentCount = Math.max(0, (post.commentCount || 0) - 1)
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
  }, [post.id, currentUserId, supabase])

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

  async function handleReportPost() {
    if (!currentUserId) {
      alert('Please log in to report posts.')
      return
    }
    const reason = prompt('Please enter the reason for reporting this post (e.g. Spam, Harassment, Inappropriate):')
    if (!reason?.trim()) return

    const { error } = await supabase.from('content_reports').insert({
      reporter_id: currentUserId,
      target_type: 'post',
      target_id: post.id,
      reason: reason.trim(),
    })

    if (error) {
      alert(`Report failed: ${error.message}`)
    } else {
      alert('Thank you. The report has been submitted to moderators.')
    }
    setShowMenu(false)
  }

  async function handleBlockUser() {
    if (!currentUserId) {
      alert('Please log in to block users.')
      return
    }
    if (!confirm(`Are you sure you want to block @${post.author.username}?`)) return

    const { error } = await supabase.from('user_blocks').insert({
      blocker_id: currentUserId,
      blocked_id: post.authorId,
    })

    if (error) {
      alert(`Block failed: ${error.message}`)
    } else {
      alert(`@${post.author.username} has been blocked.`)
    }
    setShowMenu(false)
  }

  async function handleToggleLike() {
    if (likeBusy) return
    if (!currentUserId) {
      alert('Please log in to like posts.')
      return
    }

    setLikeBusy(true)
    const prevLiked = isLiked
    const prevCount = likeCount
    setIsLiked(!prevLiked)
    setLikeCount(prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1)

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
      alert('Please log in to repost.')
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
          // Send notification to post author when someone reposts their voice
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
        await supabase.from('saved_posts').delete().match({ post_id: post.id })
      } else {
        const { data: user } = await supabase.auth.getUser()
        if (user.user) {
          await supabase.from('saved_posts').insert({ user_id: user.user.id, post_id: post.id })
        }
      }
    } catch {
      setIsSaved(prevSaved)
      onToggleSave?.(post.id, prevSaved)
    }
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
        const { data: userRes } = await supabase.auth.getUser()
        const currentUid = userRes?.user?.id

        // Fetch like counts and user's likes for each comment
        const [likesRes, myLikesRes] = await Promise.all([
          supabase.from('comment_likes').select('comment_id').in('comment_id', commentIds),
          currentUid
            ? supabase.from('comment_likes').select('comment_id').eq('user_id', currentUid).in('comment_id', commentIds)
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
    const { data: userRes } = await supabase.auth.getUser()
    if (!userRes?.user) {
      alert('Please log in to like comments.')
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
          user_id: userRes.user.id,
          comment_id: commentId,
        })
      } else {
        await supabase
          .from('comment_likes')
          .delete()
          .match({ user_id: userRes.user.id, comment_id: commentId })
      }
    } catch (err) {
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

  async function handleDeleteComment(commentId: string) {
    if (!confirm('Are you sure you want to delete this comment?')) return

    // Optimistic removal
    const previousComments = [...comments]
    setComments((prev) => prev.filter((c) => c.id !== commentId && c.parent_id !== commentId))
    post.commentCount = Math.max(0, (post.commentCount || 0) - 1)

    try {
      const { error } = await supabase.from('comments').delete().eq('id', commentId)
      if (error) {
        setComments(previousComments)
        post.commentCount = (post.commentCount || 0) + 1
        alert(`Failed to delete comment: ${error.message}`)
      }
    } catch (err: any) {
      setComments(previousComments)
      post.commentCount = (post.commentCount || 0) + 1
      alert(`Error deleting comment: ${err.message}`)
    }
  }

  const [replyToComment, setReplyToComment] = useState<{ id: string; username: string } | null>(null)

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentText.trim()) return
    setSubmittingComment(true)

    const { data: userRes } = await supabase.auth.getUser()
    if (!userRes.user) {
      alert('Please log in to leave a comment.')
      setSubmittingComment(false)
      return
    }

    const { data: newComment, error } = await supabase
      .from('comments')
      .insert({
        post_id: post.id,
        author_id: userRes.user.id,
        content: commentText.trim(),
        parent_id: replyToComment?.id || null,
      })
      .select('*, author:profiles!comments_author_id_fkey(id, username, display_name, avatar_url)')
      .maybeSingle()

    if (error) {
      alert(`Could not post comment: ${error.message}`)
    } else if (newComment) {
      setComments((prev) => [...prev, { ...newComment, likeCount: 0, isLikedByMe: false }])
      setCommentText('')

      // Send notification to parent comment author or post author
      if (replyToComment) {
        // Fetch parent comment author to notify
        const { data: parentComm } = await supabase
          .from('comments')
          .select('author_id')
          .eq('id', replyToComment.id)
          .maybeSingle()

        if (parentComm && parentComm.author_id !== userRes.user.id) {
          await supabase.from('notifications').insert({
            recipient_id: parentComm.author_id,
            actor_id: userRes.user.id,
            type: 'comment_reply',
            title: 'New Reply 💬',
            message: 'replied to your comment.',
            entity_type: 'post',
            entity_id: post.id,
            is_read: false,
          })
        }
      } else if (post.authorId !== userRes.user.id) {
        await supabase.from('notifications').insert({
          recipient_id: post.authorId,
          actor_id: userRes.user.id,
          type: 'post_comment',
          title: 'New Comment 💬',
          message: 'commented on your Voice.',
          entity_type: 'post',
          entity_id: post.id,
          is_read: false,
        })
      }

      setReplyToComment(null)
      setCommentCount((c) => (c || 0) + 1)
      post.commentCount = (post.commentCount || 0) + 1
    }
    setSubmittingComment(false)
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this post?')) return
    const { error } = await supabase.from('posts').delete().eq('id', post.id)
    if (!error && onDelete) {
      onDelete(post.id)
    }
  }

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
        alert(`Failed to ${nextPinned ? 'pin' : 'unpin'} post: ${error.message}`)
      } else {
        onTogglePin?.(post.id, nextPinned)
      }
    } catch (err: any) {
      setIsPinned(!nextPinned)
      alert(`Error updating post pin: ${err.message}`)
    } finally {
      setPinBusy(false)
      setShowMenu(false)
    }
  }

  return (
    <article ref={cardRef} className="card p-5 space-y-4 hover:border-gray-300 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href={`/@${post.author.username}`} className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-600 flex-shrink-0">
            {post.author.avatarUrl ? (
              <Image
                src={post.author.avatarUrl}
                alt={post.author.displayName}
                width={40}
                height={40}
                className="rounded-full object-cover"
              />
            ) : (
              post.author.displayName.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">
                {post.author.displayName}
              </h3>
              <UserBadgesRow badges={authorBadges} size={15} />
              {authorCommunityRole && <CommunityRoleBadge role={authorCommunityRole} size={14} />}
            </div>
            <p className="text-xs text-gray-500">@{post.author.username}</p>
            {post.community && (
              <Link
                href={`/community/${post.community.slug}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:underline mt-0.5"
              >
                <span>📌</span>
                <span>{post.community.name}</span>
              </Link>
            )}
          </div>
        </Link>

        <div className="flex items-center gap-2 relative">
          <span className="text-xs text-gray-400">
            {new Date(post.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </span>
          {isOwner && (
            <button
              onClick={handleDelete}
              className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
              title="Delete post"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            title="More options"
          >
            <MoreVertical size={16} />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 z-20 w-48 space-y-1">
              {canModerateCommunity && (
                <button
                  onClick={handleTogglePin}
                  disabled={pinBusy}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    isPinned
                      ? 'text-purple-700 bg-purple-50 hover:bg-purple-100'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Pin size={14} className={isPinned ? 'text-purple-600 fill-purple-600' : 'text-gray-500'} />
                  <span>{isPinned ? 'Unpin from Community' : 'Pin to Community'}</span>
                </button>
              )}
              {isOwner && (
                <button
                  onClick={() => {
                    setShowInsightsModal(true)
                    setShowMenu(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                >
                  <TrendingUp size={14} />
                  <span>Post Analytics & Insights</span>
                </button>
              )}
              <button
                onClick={handleReportPost}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Flag size={14} className="text-amber-500" />
                <span>Report Post</span>
              </button>
              {!isOwner && (
                <button
                  onClick={handleBlockUser}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <ShieldOff size={14} />
                  <span>Block User</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pinned Badge Banner */}
      {isPinned && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200/60 px-3 py-1.5 rounded-lg w-fit">
          <Pin size={13} className="fill-purple-600 text-purple-600" />
          <span>Pinned Post</span>
        </div>
      )}

      {/* Content */}
      <div className="text-gray-800 text-sm whitespace-pre-line leading-relaxed">
        <FormattedText text={post.content} />
      </div>

      {/* Interactive Poll */}
      <InteractivePoll
        postId={post.id}
        currentUserId={currentUserId}
        initialPoll={post.poll}
      />

      {/* Voice Whisper Audio Attachment */}
      {post.audioUrl && (
        <div className="mt-2.5">
          <VoiceWaveformPlayer
            audioUrl={post.audioUrl}
            duration={post.audioDuration}
            theme="brand"
            barCount={22}
          />
        </div>
      )}

      {/* Video Attachment Preview */}
      {post.videoUrl && (
        <div className="mt-2.5 relative rounded-2xl overflow-hidden bg-black max-h-[440px] border border-gray-200">
          <video
            src={post.videoUrl}
            controls
            playsInline
            className="w-full max-h-[440px] object-contain"
          />
          <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-xs text-[10px] text-white flex items-center gap-1 font-semibold pointer-events-none">
            <Film size={12} className="text-purple-400" />
            <span>Video</span>
          </div>
        </div>
      )}

      {/* Images Grid & Lightbox */}
      {post.imageUrls && post.imageUrls.length > 0 && (
        <div className="mt-2">
          {post.imageUrls.length === 1 && (
            <div
              className="relative w-full aspect-[16/9] max-h-[440px] rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 cursor-pointer group"
              onClick={() => setLightboxIndex(0)}
            >
              <Image
                src={post.imageUrls[0]}
                alt="Voice attachment"
                fill
                className="object-cover group-hover:scale-[1.01] transition-transform duration-200"
              />
            </div>
          )}

          {post.imageUrls.length === 2 && (
            <div className="grid grid-cols-2 gap-1.5 aspect-[16/9] max-h-[440px] rounded-2xl overflow-hidden border border-gray-200">
              {post.imageUrls.map((url, i) => (
                <div
                  key={i}
                  className="relative w-full h-full bg-gray-100 cursor-pointer group overflow-hidden"
                  onClick={() => setLightboxIndex(i)}
                >
                  <Image
                    src={url}
                    alt={`Voice attachment ${i + 1}`}
                    fill
                    className="object-cover group-hover:scale-[1.02] transition-transform duration-200"
                  />
                </div>
              ))}
            </div>
          )}

          {post.imageUrls.length === 3 && (
            <div className="grid grid-cols-2 grid-rows-2 gap-1.5 aspect-[16/9] max-h-[440px] rounded-2xl overflow-hidden border border-gray-200">
              <div
                className="relative row-span-2 col-span-1 bg-gray-100 cursor-pointer group overflow-hidden"
                onClick={() => setLightboxIndex(0)}
              >
                <Image
                  src={post.imageUrls[0]}
                  alt="Voice attachment 1"
                  fill
                  className="object-cover group-hover:scale-[1.02] transition-transform duration-200"
                />
              </div>
              <div
                className="relative row-span-1 col-span-1 bg-gray-100 cursor-pointer group overflow-hidden"
                onClick={() => setLightboxIndex(1)}
              >
                <Image
                  src={post.imageUrls[1]}
                  alt="Voice attachment 2"
                  fill
                  className="object-cover group-hover:scale-[1.02] transition-transform duration-200"
                />
              </div>
              <div
                className="relative row-span-1 col-span-1 bg-gray-100 cursor-pointer group overflow-hidden"
                onClick={() => setLightboxIndex(2)}
              >
                <Image
                  src={post.imageUrls[2]}
                  alt="Voice attachment 3"
                  fill
                  className="object-cover group-hover:scale-[1.02] transition-transform duration-200"
                />
              </div>
            </div>
          )}

          {post.imageUrls.length >= 4 && (
            <div className="grid grid-cols-2 grid-rows-2 gap-1.5 aspect-[16/9] max-h-[440px] rounded-2xl overflow-hidden border border-gray-200">
              {post.imageUrls.slice(0, 4).map((url, i) => (
                <div
                  key={i}
                  className="relative w-full h-full bg-gray-100 cursor-pointer group overflow-hidden"
                  onClick={() => setLightboxIndex(i)}
                >
                  <Image
                    src={url}
                    alt={`Voice attachment ${i + 1}`}
                    fill
                    className="object-cover group-hover:scale-[1.02] transition-transform duration-200"
                  />
                  {i === 3 && post.imageUrls.length > 4 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-lg">
                      +{post.imageUrls.length - 4}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors z-50"
            title="Close"
          >
            <X size={24} />
          </button>

          {post.imageUrls.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setLightboxIndex((prev) => (prev! > 0 ? prev! - 1 : post.imageUrls.length - 1))
              }}
              className="absolute left-4 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors z-50"
              title="Previous"
            >
              <ChevronLeft size={28} />
            </button>
          )}

          <div
            className="relative max-w-4xl max-h-[85vh] w-full h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={post.imageUrls[lightboxIndex]}
              alt={`Full size attachment ${lightboxIndex + 1}`}
              className="max-h-[85vh] max-w-full object-contain rounded-lg"
            />
          </div>

          {post.imageUrls.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setLightboxIndex((prev) => (prev! < post.imageUrls.length - 1 ? prev! + 1 : 0))
              }}
              className="absolute right-4 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors z-50"
              title="Next"
            >
              <ChevronRight size={28} />
            </button>
          )}

          {post.imageUrls.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 px-3 py-1 rounded-full text-white text-xs font-medium">
              {lightboxIndex + 1} / {post.imageUrls.length}
            </div>
          )}
        </div>
      )}

      {/* Action buttons (Minimal horizontal action row: Comment -> Repost -> Like -> Views -> Bookmark -> Share) */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-gray-500 text-xs select-none">
        {/* 1. Comment */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleLoadComments()
          }}
          aria-label={`Comment. ${commentCount} comments`}
          className="flex items-center gap-1.5 p-2 -m-2 rounded-full hover:text-brand-600 hover:bg-brand-50/50 transition-colors cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 min-w-[44px] min-h-[44px] justify-center"
        >
          <MessageCircle size={18} className="transition-transform group-active:scale-90" />
          <span className="text-xs font-medium">{commentCount}</span>
        </button>

        {/* 2. Repost */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleToggleRepost()
          }}
          aria-label={`Repost. ${repostCount} reposts`}
          aria-pressed={isReposted}
          className={`flex items-center gap-1.5 p-2 -m-2 rounded-full hover:text-emerald-600 hover:bg-emerald-50/50 transition-colors cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 min-w-[44px] min-h-[44px] justify-center ${
            isReposted ? 'text-emerald-600 font-semibold' : ''
          }`}
        >
          <Repeat size={18} className="transition-transform group-active:rotate-45" />
          <span className="text-xs font-medium">{repostCount}</span>
        </button>

        {/* 3. Like */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleToggleLike()
          }}
          aria-label={`Like. ${likeCount} likes`}
          aria-pressed={isLiked}
          className={`flex items-center gap-1.5 p-2 -m-2 rounded-full hover:text-rose-500 hover:bg-rose-50/50 transition-colors cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 min-w-[44px] min-h-[44px] justify-center ${
            isLiked ? 'text-rose-500 font-semibold' : ''
          }`}
        >
          <Heart
            size={18}
            fill={isLiked ? 'currentColor' : 'none'}
            className={`transition-all duration-200 ${
              isLiked ? 'scale-110 animate-[bounce_0.3s_ease-in-out_1]' : 'group-active:scale-125'
            }`}
          />
          <span className="text-xs font-medium">{likeCount}</span>
        </button>

        {/* 4. Views: Author can tap to view Analytics & Insights; Public cannot tap (display-only) */}
        {isOwner ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setShowInsightsModal(true)
            }}
            aria-label={`Views. ${viewCount} views. Tap to open analytics`}
            title="Post Analytics & Insights"
            className="flex items-center gap-1.5 p-2 -m-2 rounded-full text-brand-600 hover:text-brand-700 hover:bg-brand-50/50 transition-colors cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 min-w-[44px] min-h-[44px] justify-center"
          >
            <BarChart2 size={18} className="transition-transform group-active:scale-90" />
            <span className="text-xs font-semibold">{viewCount}</span>
          </button>
        ) : (
          <div
            aria-label={`Views. ${viewCount} views`}
            className="flex items-center gap-1.5 p-2 -m-2 rounded-full text-gray-500 min-w-[44px] min-h-[44px] justify-center select-none"
          >
            <BarChart2 size={18} />
            <span className="text-xs font-medium">{viewCount}</span>
          </div>
        )}

        {/* 5. Bookmark */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleToggleSave()
          }}
          aria-label="Bookmark post"
          aria-pressed={isSaved}
          className={`flex items-center p-2 -m-2 rounded-full hover:text-brand-600 hover:bg-brand-50/50 transition-colors cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 min-w-[44px] min-h-[44px] justify-center ${
            isSaved ? 'text-brand-600' : ''
          }`}
        >
          <Bookmark
            size={18}
            fill={isSaved ? 'currentColor' : 'none'}
            className="transition-transform group-active:scale-110"
          />
        </button>

        {/* 6. Share */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`)
            alert('Post link copied to clipboard!')
          }}
          aria-label="Share post"
          className="flex items-center p-2 -m-2 rounded-full hover:text-brand-600 hover:bg-brand-50/50 transition-colors cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 min-w-[44px] min-h-[44px] justify-center"
        >
          <Share2 size={18} className="transition-transform group-active:scale-90" />
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="pt-3 border-t border-gray-100 space-y-3">
          {replyToComment && (
            <div className="flex items-center justify-between bg-purple-50 text-purple-700 text-xs px-3 py-1.5 rounded-lg border border-purple-100">
              <span>Replying to <strong>@{replyToComment.username}</strong></span>
              <button
                type="button"
                onClick={() => setReplyToComment(null)}
                className="text-purple-500 hover:text-purple-800 font-bold ml-2"
              >
                ✕
              </button>
            </div>
          )}

          <div className="relative">
            <MentionAutocomplete
              query={mentionQuery ?? ''}
              visible={isMentioning}
              onSelect={handleSelectMention}
            />
            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                type="text"
                placeholder={replyToComment ? `Replying to @${replyToComment.username}…` : "Write a comment… (use @ to mention)"}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="input-field text-xs py-2 flex-1"
                autoFocus={!!replyToComment}
              />
              <button
                type="submit"
                disabled={submittingComment || !commentText.trim()}
                className="btn-primary text-xs py-2 px-3"
              >
                {replyToComment ? 'Reply' : 'Post'}
              </button>
            </form>
          </div>

          {loadingComments ? (
            <p className="text-xs text-gray-400 text-center py-2">Loading comments…</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">No comments yet. Be the first!</p>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {/* Comment Sorting Selector */}
              <div className="flex items-center justify-between pb-1 border-b border-gray-100 dark:border-slate-800 text-[11px]">
                <span className="font-semibold text-gray-400 uppercase tracking-wider">Comments</span>
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setCommentSort('newest')}
                    className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                      commentSort === 'newest'
                        ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-xs font-semibold'
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    Newest
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommentSort('top')}
                    className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                      commentSort === 'top'
                        ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-xs font-semibold'
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    Top
                  </button>
                </div>
              </div>

              {/* Separate top-level comments and nested replies */}
              {comments
                .filter((c) => !c.parent_id)
                .sort((a, b) => {
                  if (commentSort === 'top') {
                    const diff = (b.likeCount || 0) - (a.likeCount || 0)
                    if (diff !== 0) return diff
                  }
                  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                })
                .map((comment) => {
                  const replies = comments.filter((r) => r.parent_id === comment.id)
                  const canDelete = currentUserId && (currentUserId === comment.author_id || currentUserId === post.authorId)
                  return (
                    <div key={comment.id} className="space-y-1.5">
                      {/* Top level comment */}
                      <div className="bg-gray-50 dark:bg-slate-800/60 p-2.5 rounded-lg space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex gap-2 text-xs flex-1">
                            <Link
                              href={`/@${comment.author?.username || 'user'}`}
                              className="font-semibold text-gray-900 dark:text-gray-100 hover:text-brand-600 transition-colors flex-shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              @{comment.author?.username || 'user'}
                            </Link>
                            <div className="text-gray-700 dark:text-gray-200 flex-1 whitespace-pre-line">
                              <FormattedText text={comment.content} />
                            </div>
                          </div>
                          {/* Comment Like Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleToggleLikeComment(comment.id)
                            }}
                            className={`flex items-center gap-1 text-[11px] font-medium transition-colors p-1 rounded-md hover:bg-gray-200/50 dark:hover:bg-slate-700/50 ${
                              comment.isLikedByMe ? 'text-red-500 font-bold' : 'text-gray-400 hover:text-red-500'
                            }`}
                            title={comment.isLikedByMe ? 'Unlike comment' : 'Like comment'}
                          >
                            <Heart size={14} className={comment.isLikedByMe ? 'fill-current text-red-500' : ''} />
                            {(comment.likeCount || 0) > 0 && <span>{comment.likeCount}</span>}
                          </button>
                        </div>
                        <div className="flex items-center justify-between pt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                          <div className="flex items-center gap-3">
                            <span>{new Date(comment.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setReplyToComment({ id: comment.id, username: comment.author?.username || 'user' })
                                setCommentText(`@${comment.author?.username || 'user'} `)
                              }}
                              className="font-semibold text-brand-600 hover:underline"
                            >
                              Reply
                            </button>
                          </div>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDeleteComment(comment.id)}
                              className="text-gray-400 hover:text-red-500 transition-colors p-0.5"
                              title="Delete comment"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Nested Replies */}
                      {replies.length > 0 && (
                        <div className="pl-5 border-l-2 border-purple-200 dark:border-purple-900 space-y-1.5 ml-2">
                          {replies.map((reply) => {
                            const canDeleteReply = currentUserId && (currentUserId === reply.author_id || currentUserId === post.authorId)
                            return (
                              <div key={reply.id} className="bg-purple-50/50 dark:bg-purple-950/20 p-2 rounded-lg space-y-1">
                                <div className="flex items-start justify-between gap-2 text-xs">
                                  <div className="flex gap-2 flex-1">
                                    <Link
                                      href={`/@${reply.author?.username || 'user'}`}
                                      className="font-semibold text-purple-900 dark:text-purple-300 hover:text-brand-600 transition-colors flex-shrink-0"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      @{reply.author?.username || 'user'}
                                    </Link>
                                    <div className="text-gray-700 dark:text-gray-200 flex-1 whitespace-pre-line">
                                      <FormattedText text={reply.content} />
                                    </div>
                                  </div>
                                  {/* Reply Like Button */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleToggleLikeComment(reply.id)
                                    }}
                                    className={`flex items-center gap-1 text-[11px] font-medium transition-colors p-1 rounded-md hover:bg-purple-100/50 dark:hover:bg-purple-900/50 ${
                                      reply.isLikedByMe ? 'text-red-500 font-bold' : 'text-gray-400 hover:text-red-500'
                                    }`}
                                    title={reply.isLikedByMe ? 'Unlike reply' : 'Like reply'}
                                  >
                                    <Heart size={13} className={reply.isLikedByMe ? 'fill-current text-red-500' : ''} />
                                    {(reply.likeCount || 0) > 0 && <span>{reply.likeCount}</span>}
                                  </button>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500">
                                  <span>{new Date(reply.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                                  {canDeleteReply && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteComment(reply.id)}
                                      className="text-gray-400 hover:text-red-500 transition-colors p-0.5"
                                      title="Delete reply"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}

      {/* Post Progression & Insights Modal */}
      {showInsightsModal && (
        <PostInsightsModal post={post} currentUserId={currentUserId} onClose={() => setShowInsightsModal(false)} />
      )}
    </article>
  )
}
