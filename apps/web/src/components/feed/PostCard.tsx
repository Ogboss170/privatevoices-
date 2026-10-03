'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Heart, MessageCircle, Bookmark, Share2, Trash2, MoreVertical, Flag, ShieldOff, ChevronLeft, ChevronRight, X, TrendingUp } from 'lucide-react'
import type { Post } from '@private-voices/shared'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import FormattedText from '../common/FormattedText'
import MentionAutocomplete from '../common/MentionAutocomplete'
import InteractivePoll from './InteractivePoll'
import PostInsightsModal from './PostInsightsModal'

interface PostCardProps {
  post: Post
  currentUserId?: string
  onDelete?: (postId: string) => void
  onToggleSave?: (postId: string, isSaved: boolean) => void
}

export default function PostCard({ post, currentUserId, onDelete, onToggleSave }: PostCardProps): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const [isLiked, setIsLiked] = useState(post.isLikedByMe)
  const [likeCount, setLikeCount] = useState(post.likeCount)
  const [likeBusy, setLikeBusy] = useState(false)
  const [isSaved, setIsSaved] = useState(post.isSavedByMe)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<any[]>([])
  const [commentText, setCommentText] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [showInsightsModal, setShowInsightsModal] = useState(false)

  const isOwner = currentUserId === post.authorId

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

      setComments(data ?? [])
      setLoadingComments(false)
    }
    setShowComments(!showComments)
  }

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
      })
      .select('*, author:profiles!comments_author_id_fkey(id, username, display_name, avatar_url)')
      .maybeSingle()

    if (error) {
      alert(`Could not post comment: ${error.message}`)
    } else if (newComment) {
      setComments((prev) => [...prev, newComment])
      setCommentText('')
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

  return (
    <article className="card p-5 space-y-4 hover:border-gray-300 transition-colors">
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
            <h3 className="font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">
              {post.author.displayName}
            </h3>
            <p className="text-xs text-gray-500">@{post.author.username}</p>
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
              <button
                onClick={() => {
                  setShowInsightsModal(true)
                  setShowMenu(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              >
                <TrendingUp size={14} />
                <span>View Progression</span>
              </button>
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

      {/* Action buttons */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-gray-500 text-xs">
        <button
          onClick={handleToggleLike}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors ${
            isLiked ? 'text-red-500 font-semibold' : ''
          }`}
        >
          <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
          <span>{likeCount}</span>
        </button>

        <button
          onClick={handleLoadComments}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <MessageCircle size={18} />
          <span>{post.commentCount}</span>
        </button>

        <button
          onClick={() => setShowInsightsModal(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-purple-50 text-purple-600 font-medium transition-colors"
          title="View Post Insights & Progression"
        >
          <TrendingUp size={18} />
          <span>Insights</span>
        </button>

        <button
          onClick={handleToggleSave}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors ${
            isSaved ? 'text-brand-600' : ''
          }`}
        >
          <Bookmark size={18} fill={isSaved ? 'currentColor' : 'none'} />
        </button>

        <button
          onClick={() => {
            navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`)
            alert('Post link copied to clipboard!')
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <Share2 size={18} />
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="pt-3 border-t border-gray-100 space-y-3">
          <div className="relative">
            <MentionAutocomplete
              query={mentionQuery ?? ''}
              visible={isMentioning}
              onSelect={handleSelectMention}
            />
            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                type="text"
                placeholder="Write a comment… (use @ to mention)"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="input-field text-xs py-2 flex-1"
              />
              <button
                type="submit"
                disabled={submittingComment || !commentText.trim()}
                className="btn-primary text-xs py-2 px-3"
              >
                Post
              </button>
            </form>
          </div>

          {loadingComments ? (
            <p className="text-xs text-gray-400 text-center py-2">Loading comments…</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">No comments yet. Be the first!</p>
          ) : (
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-2 text-xs bg-gray-50 p-2.5 rounded-lg">
                  <Link
                    href={`/@${comment.author?.username || 'user'}`}
                    className="font-semibold text-gray-900 hover:text-brand-600 transition-colors flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    @{comment.author?.username || 'user'}:
                  </Link>
                  <div className="text-gray-700 flex-1 whitespace-pre-line">
                    <FormattedText text={comment.content} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Post Progression & Insights Modal */}
      {showInsightsModal && (
        <PostInsightsModal post={post} onClose={() => setShowInsightsModal(false)} />
      )}
    </article>
  )
}
