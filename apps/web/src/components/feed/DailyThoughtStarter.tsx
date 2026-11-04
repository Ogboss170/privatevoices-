'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ChevronRight,
  X,
  MessageCircle,
  Repeat,
  Bookmark,
  Share2,
  Heart,
  Send,
  Loader2,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { DailyThoughtPrompt, PromptComment } from '@private-voices/shared'

const FALLBACK_PROMPTS: Array<Omit<DailyThoughtPrompt, 'id' | 'isActive'>> = [
  {
    tag: 'Daily Reflection',
    prompt: 'What is an opinion or perspective you hold that you rarely share out loud?',
    icon: '💭',
  },
  {
    tag: 'Curiosity',
    prompt: 'What was a hard lesson you had to learn on your own without anyone warning you?',
    icon: '🌱',
  },
  {
    tag: 'Unfiltered Thought',
    prompt: 'If you had zero fear of judgment from friends or colleagues, what would you create or say today?',
    icon: '🎭',
  },
  {
    tag: 'Deep Question',
    prompt: 'What is something simple that genuinely brought you peace of mind this week?',
    icon: '✨',
  },
  {
    tag: 'Life Reflection',
    prompt: 'What is a piece of common advice that you think is completely wrong or misleading?',
    icon: '🔍',
  },
]

export default function DailyThoughtStarter(): React.JSX.Element | null {
  const supabase = createSupabaseBrowserClient()

  const [currentPrompt, setCurrentPrompt] = useState<DailyThoughtPrompt | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  // Interaction States
  const [isReacted, setIsReacted] = useState(false)
  const [reactionCount, setReactionCount] = useState(0)
  const [isSaved, setIsSaved] = useState(false)
  const [saveCount, setSaveCount] = useState(0)
  const [isReshared, setIsReshared] = useState(false)
  const [reshareCount, setReshareCount] = useState(0)

  // Conversation / Comment Tray States
  const [showConversation, setShowConversation] = useState(false)
  const [comments, setComments] = useState<PromptComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [commentIsMasked, setCommentIsMasked] = useState(false)
  const [commentMaskedPersona, setCommentMaskedPersona] = useState('Thoughtful Owl')

  // Copy Link Alert State
  const [copiedLink, setCopiedLink] = useState(false)

  // Check auth user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentUserId(data.user.id)
      }
    })
  }, [supabase])

  // Load Prompt of the Day
  useEffect(() => {
    const isDismissed = sessionStorage.getItem('pv_thought_starter_dismissed') === 'true'
    if (isDismissed) {
      setDismissed(true)
      return
    }

    async function fetchTodayPrompt() {
      try {
        const todayStr = new Date().toISOString().split('T')[0]

        // 1. Check for prompt scheduled for today
        const { data: dbPrompt } = await supabase
          .from('daily_thought_prompts')
          .select('id, tag, prompt, icon, active_date, is_active')
          .eq('is_active', true)
          .eq('active_date', todayStr)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (dbPrompt) {
          setCurrentPrompt({
            id: dbPrompt.id,
            tag: dbPrompt.tag,
            prompt: dbPrompt.prompt,
            icon: dbPrompt.icon,
            activeDate: dbPrompt.active_date,
            isActive: dbPrompt.is_active,
          })
          return
        }

        // 2. Check for latest active prompt
        const { data: latestPrompt } = await supabase
          .from('daily_thought_prompts')
          .select('id, tag, prompt, icon, active_date, is_active')
          .eq('is_active', true)
          .order('active_date', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (latestPrompt) {
          setCurrentPrompt({
            id: latestPrompt.id,
            tag: latestPrompt.tag,
            prompt: latestPrompt.prompt,
            icon: latestPrompt.icon,
            activeDate: latestPrompt.active_date,
            isActive: latestPrompt.is_active,
          })
          return
        }
      } catch {
        // Fall back to local rotation if database query fails or table not yet migrated
      }

      // 3. Fallback based on day of year
      const now = new Date()
      const dayOfYear = Math.floor(
        (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
      )
      const fallback = FALLBACK_PROMPTS[dayOfYear % FALLBACK_PROMPTS.length]
      setCurrentPrompt({
        id: `fallback-${dayOfYear % FALLBACK_PROMPTS.length}`,
        tag: fallback.tag,
        prompt: fallback.prompt,
        icon: fallback.icon,
        isActive: true,
      })
    }

    fetchTodayPrompt()
  }, [supabase])

  // Fetch reactions, saves, reshares & comment counts for this prompt
  const fetchPromptInteractions = useCallback(async () => {
    if (!currentPrompt || currentPrompt.id.startsWith('fallback-')) return

    try {
      // 1. Reactions (Likes)
      const { count: reactCount } = await supabase
        .from('prompt_reactions')
        .select('*', { count: 'exact', head: true })
        .eq('prompt_id', currentPrompt.id)

      setReactionCount(reactCount || 0)

      if (currentUserId) {
        const { data: myReact } = await supabase
          .from('prompt_reactions')
          .select('user_id')
          .eq('prompt_id', currentPrompt.id)
          .eq('user_id', currentUserId)
          .maybeSingle()
        setIsReacted(Boolean(myReact))
      }

      // 2. Saves (Bookmarks)
      const { count: sCount } = await supabase
        .from('prompt_saves')
        .select('*', { count: 'exact', head: true })
        .eq('prompt_id', currentPrompt.id)

      setSaveCount(sCount || 0)

      if (currentUserId) {
        const { data: mySave } = await supabase
          .from('prompt_saves')
          .select('user_id')
          .eq('prompt_id', currentPrompt.id)
          .eq('user_id', currentUserId)
          .maybeSingle()
        setIsSaved(Boolean(mySave))
      }

      // 3. Reshares
      const { count: rCount } = await supabase
        .from('prompt_reshares')
        .select('*', { count: 'exact', head: true })
        .eq('prompt_id', currentPrompt.id)

      setReshareCount(rCount || 0)

      if (currentUserId) {
        const { data: myReshare } = await supabase
          .from('prompt_reshares')
          .select('user_id')
          .eq('prompt_id', currentPrompt.id)
          .eq('user_id', currentUserId)
          .maybeSingle()
        setIsReshared(Boolean(myReshare))
      }
    } catch (err) {
      console.error('Error loading prompt interactions:', err)
    }
  }, [currentPrompt, currentUserId, supabase])

  useEffect(() => {
    fetchPromptInteractions()
  }, [fetchPromptInteractions])

  // Load comments
  const loadComments = useCallback(async () => {
    if (!currentPrompt || currentPrompt.id.startsWith('fallback-')) return
    setCommentsLoading(true)

    try {
      const { data, error } = await supabase
        .from('prompt_comments')
        .select(`
          id,
          prompt_id,
          author_id,
          content,
          is_masked,
          masked_persona,
          created_at,
          updated_at,
          author:profiles!prompt_comments_author_id_fkey(id, username, display_name, avatar_url)
        `)
        .eq('prompt_id', currentPrompt.id)
        .order('created_at', { ascending: true })

      if (!error && data) {
        const mapped: PromptComment[] = data.map((c: any) => ({
          id: c.id,
          promptId: c.prompt_id,
          authorId: c.author_id,
          content: c.content,
          isMasked: c.is_masked,
          maskedPersona: c.masked_persona,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          author: c.author
            ? {
                id: c.author.id,
                username: c.author.username,
                displayName: c.author.display_name,
                avatarUrl: c.author.avatar_url,
              }
            : undefined,
        }))
        setComments(mapped)
      }
    } catch (err) {
      console.error('Error loading prompt comments:', err)
    } finally {
      setCommentsLoading(false)
    }
  }, [currentPrompt, supabase])

  const toggleConversation = () => {
    const next = !showConversation
    setShowConversation(next)
    if (next && comments.length === 0) {
      loadComments()
    }
  }

  // Handle Like / Resonate toggle
  const handleToggleReaction = async () => {
    if (!currentUserId) {
      alert('Please log in to like this Thought of the Day.')
      return
    }
    if (!currentPrompt || currentPrompt.id.startsWith('fallback-')) return

    const prevReacted = isReacted
    const prevCount = reactionCount
    setIsReacted(!prevReacted)
    setReactionCount(prevReacted ? Math.max(0, prevCount - 1) : prevCount + 1)

    try {
      if (prevReacted) {
        await supabase
          .from('prompt_reactions')
          .delete()
          .eq('prompt_id', currentPrompt.id)
          .eq('user_id', currentUserId)
      } else {
        await supabase
          .from('prompt_reactions')
          .insert({ prompt_id: currentPrompt.id, user_id: currentUserId })
      }
    } catch {
      setIsReacted(prevReacted)
      setReactionCount(prevCount)
    }
  }

  // Handle Save / Bookmark toggle
  const handleToggleSave = async () => {
    if (!currentUserId) {
      alert('Please log in to save this Thought of the Day.')
      return
    }
    if (!currentPrompt || currentPrompt.id.startsWith('fallback-')) return

    const prevSaved = isSaved
    const prevCount = saveCount
    setIsSaved(!prevSaved)
    setSaveCount(prevSaved ? Math.max(0, prevCount - 1) : prevCount + 1)

    try {
      if (prevSaved) {
        await supabase
          .from('prompt_saves')
          .delete()
          .eq('prompt_id', currentPrompt.id)
          .eq('user_id', currentUserId)
      } else {
        await supabase
          .from('prompt_saves')
          .insert({ prompt_id: currentPrompt.id, user_id: currentUserId })
      }
    } catch {
      setIsSaved(prevSaved)
      setSaveCount(prevCount)
    }
  }

  // Handle Reshare toggle
  const handleToggleReshare = async () => {
    if (!currentUserId) {
      alert('Please log in to reshare.')
      return
    }
    if (!currentPrompt || currentPrompt.id.startsWith('fallback-')) return

    const prevReshared = isReshared
    const prevCount = reshareCount
    setIsReshared(!prevReshared)
    setReshareCount(prevReshared ? Math.max(0, prevCount - 1) : prevCount + 1)

    try {
      if (prevReshared) {
        await supabase
          .from('prompt_reshares')
          .delete()
          .eq('prompt_id', currentPrompt.id)
          .eq('user_id', currentUserId)
      } else {
        await supabase
          .from('prompt_reshares')
          .insert({ prompt_id: currentPrompt.id, user_id: currentUserId })
      }
    } catch {
      setIsReshared(prevReshared)
      setReshareCount(prevCount)
    }
  }

  // Handle Share Link
  const handleCopyShareLink = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        setCopiedLink(true)
        setTimeout(() => setCopiedLink(false), 2000)
      }
    } catch {}
  }

  // Handle post comment to prompt conversation
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || !currentUserId || !currentPrompt) return
    if (currentPrompt.id.startsWith('fallback-')) {
      alert('This prompt is in offline preview mode. Start a thought above to share!')
      return
    }

    setSubmittingComment(true)
    try {
      const { data, error } = await supabase
        .from('prompt_comments')
        .insert({
          prompt_id: currentPrompt.id,
          author_id: currentUserId,
          content: newComment.trim(),
          is_masked: commentIsMasked,
          masked_persona: commentIsMasked ? commentMaskedPersona : null,
        })
        .select(`
          id,
          prompt_id,
          author_id,
          content,
          is_masked,
          masked_persona,
          created_at,
          updated_at,
          author:profiles!prompt_comments_author_id_fkey(id, username, display_name, avatar_url)
        `)
        .single()

      if (!error && data) {
        const authorObj = Array.isArray(data.author) ? data.author[0] : data.author
        const addedComment: PromptComment = {
          id: data.id,
          promptId: data.prompt_id,
          authorId: data.author_id,
          content: data.content,
          isMasked: data.is_masked,
          maskedPersona: data.masked_persona,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          author: authorObj
            ? {
                id: authorObj.id,
                username: authorObj.username,
                displayName: authorObj.display_name,
                avatarUrl: authorObj.avatar_url,
              }
            : undefined,
        }
        setComments((prev) => [...prev, addedComment])
        setNewComment('')
      }
    } catch (err: any) {
      alert(err.message || 'Could not post conversation comment')
    } finally {
      setSubmittingComment(false)
    }
  }

  if (dismissed || !currentPrompt) return null

  function handleDismiss() {
    setDismissed(true)
    sessionStorage.setItem('pv_thought_starter_dismissed', 'true')
  }

  const encodedPrompt = encodeURIComponent(`💭 [${currentPrompt.tag}]\n"${currentPrompt.prompt}"\n\n`)

  return (
    <div className="relative mx-3.5 my-3 p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-amber-500/10 via-purple-500/5 to-brand-500/10 dark:from-amber-950/20 dark:via-purple-950/15 dark:to-slate-800/80 border border-amber-200/50 dark:border-amber-900/30 shadow-xs overflow-hidden">
      {/* Decorative Aura background */}
      <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-gradient-to-br from-amber-400/20 to-purple-500/20 rounded-full blur-xl pointer-events-none" />

      {/* Top Bar: Tag & Dismiss */}
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{currentPrompt.icon}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] uppercase font-bold tracking-wider text-amber-700 dark:text-amber-400">
              {currentPrompt.tag}
            </span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">• Today's Thought</span>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="p-1 -mr-1 -mt-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full transition-colors cursor-pointer"
          title="Dismiss for today"
        >
          <X size={15} />
        </button>
      </div>

      {/* Thought Prompt Text */}
      <p className="relative mt-2.5 text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 leading-snug">
        "{currentPrompt.prompt}"
      </p>

      {/* Primary Action & Conversation Bar */}
      <div className="relative mt-4 flex items-center justify-between pt-3 border-t border-amber-200/40 dark:border-slate-800/80">
        {/* Interaction Action Icons: Like, Reshare, Save, Conversation */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* 1. Like / Resonate */}
          <button
            type="button"
            onClick={handleToggleReaction}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              isReacted
                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold'
                : 'text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
            title={isReacted ? 'Unlike Thought' : 'Like / Resonate'}
          >
            <Heart size={15} className={isReacted ? 'fill-current text-rose-500' : ''} />
            {reactionCount > 0 && <span>{reactionCount}</span>}
          </button>

          {/* 2. Reshare */}
          <button
            type="button"
            onClick={handleToggleReshare}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              isReshared
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
            title={isReshared ? 'Undo Reshare' : 'Reshare Thought'}
          >
            <Repeat size={15} className={isReshared ? 'text-emerald-500' : ''} />
            {reshareCount > 0 && <span>{reshareCount}</span>}
          </button>

          {/* 3. Save / Bookmark */}
          <button
            type="button"
            onClick={handleToggleSave}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              isSaved
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold'
                : 'text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
            title={isSaved ? 'Remove from Saved' : 'Save Thought'}
          >
            <Bookmark size={15} className={isSaved ? 'fill-current text-amber-500' : ''} />
            {saveCount > 0 && <span>{saveCount}</span>}
          </button>

          {/* 4. Conversation Tray Toggle */}
          <button
            type="button"
            onClick={toggleConversation}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              showConversation
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-purple-700 dark:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20'
            }`}
            title="Open Thought Discussion"
          >
            <MessageCircle size={15} />
            <span>Discussion</span>
            {comments.length > 0 && <span className="ml-0.5">({comments.length})</span>}
            {showConversation ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {/* 5. Copy Link */}
          <button
            type="button"
            onClick={handleCopyShareLink}
            className="p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="Share Link"
          >
            {copiedLink ? <Check size={14} className="text-emerald-500" /> : <Share2 size={14} />}
          </button>
        </div>

        {/* Create Post from Thought Button */}
        <Link
          href={`/create?initialContent=${encodedPrompt}`}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-950 text-xs font-bold hover:opacity-90 active:scale-95 transition-all shadow-xs"
        >
          <span>Create Post</span>
          <ChevronRight size={13} strokeWidth={2.5} />
        </Link>
      </div>

      {/* ─── Expandable Conversation Area ─── */}
      {showConversation && (
        <div className="relative mt-4 pt-4 border-t border-amber-200/50 dark:border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
              <span>💬</span>
              <span>Thought Reflections & Dialogue</span>
            </h4>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {comments.length} {comments.length === 1 ? 'reflection' : 'reflections'}
            </span>
          </div>

          {/* Comments List */}
          {commentsLoading ? (
            <div className="py-4 text-center">
              <Loader2 size={18} className="animate-spin text-purple-600 mx-auto" />
            </div>
          ) : comments.length === 0 ? (
            <div className="py-3 px-4 rounded-2xl bg-white/40 dark:bg-slate-900/40 text-center border border-dashed border-amber-300/40 dark:border-slate-700/50">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                No reflections shared yet. Be the first to start the conversation!
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="p-3 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-amber-200/40 dark:border-slate-800 text-xs shadow-2xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold text-[10px] overflow-hidden">
                        {comment.isMasked ? (
                          '🎭'
                        ) : comment.author?.avatarUrl ? (
                          <Image
                            src={comment.author.avatarUrl}
                            alt={comment.author.displayName}
                            width={24}
                            height={24}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          comment.author?.displayName?.charAt(0).toUpperCase() || 'U'
                        )}
                      </div>
                      <span className="font-bold text-gray-900 dark:text-gray-100">
                        {comment.isMasked
                          ? comment.maskedPersona || 'Masked Voice'
                          : comment.author?.displayName || 'Community Member'}
                      </span>
                      {comment.isMasked && (
                        <span className="text-[10px] bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 px-1.5 py-0.2 rounded-full font-semibold">
                          Masked
                        </span>
                      )}
                    </div>

                    <span className="text-[10px] text-gray-400">
                      {new Date(comment.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>

                  <p className="text-gray-800 dark:text-gray-200 leading-relaxed pl-8">
                    {comment.content}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* New Comment Composer Form */}
          <form onSubmit={handleSubmitComment} className="pt-1 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-gray-500 dark:text-gray-400 font-medium">Add your perspective</span>

              {/* Masked Voice Option */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCommentIsMasked(!commentIsMasked)}
                  className={`flex items-center gap-1 font-bold px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                    commentIsMasked
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-500 hover:text-purple-600 dark:text-gray-400'
                  }`}
                >
                  <span>🎭</span>
                  <span>{commentIsMasked ? 'Masked' : 'Reveal'}</span>
                </button>

                {commentIsMasked && (
                  <select
                    value={commentMaskedPersona}
                    onChange={(e) => setCommentMaskedPersona(e.target.value)}
                    className="text-[11px] bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 rounded-lg px-2 py-0.5 text-purple-900 dark:text-purple-200 font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="Thoughtful Owl">🦉 Owl</option>
                    <option value="Quiet Thinker">🌙 Thinker</option>
                    <option value="Curious Fox">🦊 Fox</option>
                    <option value="Gentle Breeze">🍃 Breeze</option>
                    <option value="Masked Voice">🎭 Masked</option>
                  </select>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder={
                  commentIsMasked
                    ? `Reply as ${commentMaskedPersona}...`
                    : 'Share a thoughtful perspective...'
                }
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="flex-1 px-3.5 py-2 text-xs bg-white dark:bg-slate-900 border border-amber-300/60 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-gray-100 placeholder-gray-400"
              />

              <button
                type="submit"
                disabled={submittingComment || !newComment.trim()}
                className="px-3.5 py-2 rounded-2xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-all cursor-pointer"
              >
                {submittingComment ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <>
                    <span>Reply</span>
                    <Send size={12} />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
