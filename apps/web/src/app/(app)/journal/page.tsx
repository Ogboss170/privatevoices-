'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Sparkles,
  Calendar,
  Heart,
  MessageCircle,
  Repeat,
  Bookmark,
  Share2,
  ChevronRight,
  Filter,
  Search,
  BookOpen,
  ArrowUpDown,
  Send,
  Loader2,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { DailyThoughtPrompt, PromptComment } from '@private-voices/shared'

const THEMES = [
  'All',
  'Daily Reflection',
  'Curiosity',
  'Unfiltered Thought',
  'Deep Question',
  'Life Reflection',
  'Growth',
  'Mindset',
]

export default function ReflectionsJournalPage(): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [prompts, setPrompts] = useState<DailyThoughtPrompt[]>([])
  const [loading, setLoading] = useState(true)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTheme, setSelectedTheme] = useState('All')
  const [timeframe, setTimeframe] = useState<'all' | 'month' | 'week'>('all')

  // Expanded discussion state (maps promptId -> boolean)
  const [expandedPromptId, setExpandedPromptId] = useState<string | null>(null)
  const [commentsMap, setCommentsMap] = useState<Record<string, PromptComment[]>>({})
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [newCommentText, setNewCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [commentIsMasked, setCommentIsMasked] = useState(false)
  const [commentMaskedPersona, setCommentMaskedPersona] = useState('Thoughtful Owl')

  // Copy share state
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentUserId(data.user.id)
      }
    })
  }, [supabase])

  // Fetch all past & present thought prompts
  const fetchPrompts = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('daily_thought_prompts')
        .select('*')
        .order('active_date', { ascending: false })

      if (!error && data) {
        // Hydrate each prompt with counts
        const hydrated: DailyThoughtPrompt[] = await Promise.all(
          data.map(async (p: any) => {
            const [
              { count: rCount },
              { count: sCount },
              { count: resCount },
              { count: cCount },
              myReactionRes,
              mySaveRes,
            ] = await Promise.all([
              supabase.from('prompt_reactions').select('*', { count: 'exact', head: true }).eq('prompt_id', p.id),
              supabase.from('prompt_saves').select('*', { count: 'exact', head: true }).eq('prompt_id', p.id),
              supabase.from('prompt_reshares').select('*', { count: 'exact', head: true }).eq('prompt_id', p.id),
              supabase.from('prompt_comments').select('*', { count: 'exact', head: true }).eq('prompt_id', p.id),
              currentUserId
                ? supabase.from('prompt_reactions').select('user_id').eq('prompt_id', p.id).eq('user_id', currentUserId).maybeSingle()
                : Promise.resolve({ data: null }),
              currentUserId
                ? supabase.from('prompt_saves').select('user_id').eq('prompt_id', p.id).eq('user_id', currentUserId).maybeSingle()
                : Promise.resolve({ data: null }),
            ])

            return {
              id: p.id,
              tag: p.tag,
              prompt: p.prompt,
              icon: p.icon || '💭',
              activeDate: p.active_date,
              isActive: p.is_active,
              reactionCount: rCount || 0,
              saveCount: sCount || 0,
              reshareCount: resCount || 0,
              commentCount: cCount || 0,
              isReactedByMe: Boolean(myReactionRes.data),
              isSavedByMe: Boolean(mySaveRes.data),
            }
          })
        )
        setPrompts(hydrated)
      }
    } catch (err) {
      console.error('Error fetching reflection prompts archive:', err)
    } finally {
      setLoading(false)
    }
  }, [currentUserId, supabase])

  useEffect(() => {
    fetchPrompts()
  }, [fetchPrompts])

  // Filter & Search Logic
  const filteredPrompts = useMemo(() => {
    return prompts.filter((p) => {
      // Theme filter
      if (selectedTheme !== 'All' && p.tag.toLowerCase() !== selectedTheme.toLowerCase()) {
        return false
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesPrompt = p.prompt.toLowerCase().includes(q)
        const matchesTag = p.tag.toLowerCase().includes(q)
        if (!matchesPrompt && !matchesTag) return false
      }

      // Timeframe filter
      if (timeframe !== 'all' && p.activeDate) {
        const promptDate = new Date(p.activeDate)
        const now = new Date()
        const diffMs = now.getTime() - promptDate.getTime()
        const diffDays = diffMs / (1000 * 60 * 60 * 24)

        if (timeframe === 'week' && diffDays > 7) return false
        if (timeframe === 'month' && diffDays > 30) return false
      }

      return true
    })
  }, [prompts, selectedTheme, searchQuery, timeframe])

  // Toggle Discussion Thread for a specific prompt
  const handleToggleDiscussion = async (promptId: string) => {
    if (expandedPromptId === promptId) {
      setExpandedPromptId(null)
      return
    }

    setExpandedPromptId(promptId)

    // Load comments if not already cached
    if (!commentsMap[promptId]) {
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
          .eq('prompt_id', promptId)
          .order('created_at', { ascending: true })

        if (!error && data) {
          const mapped: PromptComment[] = data.map((c: any) => {
            const authorObj = Array.isArray(c.author) ? c.author[0] : c.author
            return {
              id: c.id,
              promptId: c.prompt_id,
              authorId: c.author_id,
              content: c.content,
              isMasked: c.is_masked,
              maskedPersona: c.masked_persona,
              createdAt: c.created_at,
              updatedAt: c.updated_at,
              author: authorObj
                ? {
                    id: authorObj.id,
                    username: authorObj.username,
                    displayName: authorObj.display_name,
                    avatarUrl: authorObj.avatar_url,
                  }
                : undefined,
            }
          })
          setCommentsMap((prev) => ({ ...prev, [promptId]: mapped }))
        }
      } catch (err) {
        console.error('Error fetching comments:', err)
      } finally {
        setCommentsLoading(false)
      }
    }
  }

  // Handle Post Comment inside an archived prompt
  const handleSubmitComment = async (promptId: string) => {
    if (!newCommentText.trim() || !currentUserId) return
    setSubmittingComment(true)

    try {
      const { data, error } = await supabase
        .from('prompt_comments')
        .insert({
          prompt_id: promptId,
          author_id: currentUserId,
          content: newCommentText.trim(),
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
        const added: PromptComment = {
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

        setCommentsMap((prev) => ({
          ...prev,
          [promptId]: [...(prev[promptId] || []), added],
        }))
        setNewCommentText('')

        // Update commentCount on prompt
        setPrompts((prev) =>
          prev.map((p) => (p.id === promptId ? { ...p, commentCount: (p.commentCount || 0) + 1 } : p))
        )
      }
    } catch (err) {
      console.error('Error submitting reflection:', err)
    } finally {
      setSubmittingComment(false)
    }
  }

  // Like / Resonate Toggle
  const handleToggleReaction = async (promptId: string) => {
    if (!currentUserId) {
      alert('Please log in to like this prompt.')
      return
    }

    setPrompts((prev) =>
      prev.map((p) => {
        if (p.id !== promptId) return p
        const nextReacted = !p.isReactedByMe
        return {
          ...p,
          isReactedByMe: nextReacted,
          reactionCount: nextReacted ? (p.reactionCount || 0) + 1 : Math.max(0, (p.reactionCount || 1) - 1),
        }
      })
    )

    const target = prompts.find((p) => p.id === promptId)
    if (target?.isReactedByMe) {
      await supabase.from('prompt_reactions').delete().eq('prompt_id', promptId).eq('user_id', currentUserId)
    } else {
      await supabase.from('prompt_reactions').insert({ prompt_id: promptId, user_id: currentUserId })
    }
  }

  // Save / Bookmark Toggle
  const handleToggleSave = async (promptId: string) => {
    if (!currentUserId) {
      alert('Please log in to save this prompt.')
      return
    }

    setPrompts((prev) =>
      prev.map((p) => {
        if (p.id !== promptId) return p
        const nextSaved = !p.isSavedByMe
        return {
          ...p,
          isSavedByMe: nextSaved,
          saveCount: nextSaved ? (p.saveCount || 0) + 1 : Math.max(0, (p.saveCount || 1) - 1),
        }
      })
    )

    const target = prompts.find((p) => p.id === promptId)
    if (target?.isSavedByMe) {
      await supabase.from('prompt_saves').delete().eq('prompt_id', promptId).eq('user_id', currentUserId)
    } else {
      await supabase.from('prompt_saves').insert({ prompt_id: promptId, user_id: currentUserId })
    }
  }

  // Copy Link
  const handleCopyShare = async (prompt: DailyThoughtPrompt) => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(`${window.location.origin}/journal#${prompt.id}`)
      setCopiedPromptId(prompt.id)
      setTimeout(() => setCopiedPromptId(null), 2000)
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-purple-950 via-indigo-950 to-gray-950 text-white p-6 sm:p-8 border border-white/10 shadow-xl space-y-3">
        <div className="flex items-center gap-2 text-purple-300 font-bold text-xs uppercase tracking-wider">
          <BookOpen size={16} className="text-purple-400" />
          <span>Reflections Journal & Thought Archive</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white">
          Community Wisdom & Daily Archives
        </h1>
        <p className="text-xs sm:text-sm text-purple-200/80 max-w-2xl leading-relaxed">
          Revisit all past Thoughts of the Day, explore the community's most candid answers, and add your perspective to timeless conversations across weeks and months.
        </p>

        {/* Quick Stats Pill */}
        <div className="flex items-center gap-3 pt-2 text-xs text-purple-300 font-semibold">
          <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
            <span>✨</span>
            <span>{prompts.length} Archived Reflections</span>
          </div>
          <Link
            href="/saved"
            className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 px-3 py-1.5 rounded-full border border-amber-500/30 hover:bg-amber-500/30 transition-colors"
          >
            <Bookmark size={13} className="fill-current" />
            <span>My Saved Sanctuary</span>
          </Link>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="card p-4 space-y-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search thoughts by question or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Timeframe Switcher */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-slate-800 rounded-2xl self-stretch sm:self-auto text-xs">
            <button
              onClick={() => setTimeframe('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                timeframe === 'all'
                  ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setTimeframe('month')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                timeframe === 'month'
                  ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setTimeframe('week')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                timeframe === 'week'
                  ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Past 7 Days
            </button>
          </div>
        </div>

        {/* Theme Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar">
          {THEMES.map((theme) => (
            <button
              key={theme}
              onClick={() => setSelectedTheme(theme)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedTheme === theme
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              {theme}
            </button>
          ))}
        </div>
      </div>

      {/* Prompts Archive Grid */}
      {loading ? (
        <div className="py-20 text-center">
          <Loader2 size={24} className="animate-spin text-purple-600 mx-auto" />
          <p className="text-xs text-gray-400 mt-2">Loading reflection archives...</p>
        </div>
      ) : filteredPrompts.length === 0 ? (
        <div className="card p-12 text-center text-gray-400 dark:text-gray-500 space-y-2 border-dashed border-2">
          <div className="text-4xl">📖</div>
          <h3 className="font-bold text-gray-800 dark:text-gray-200 text-base">No Reflections Found</h3>
          <p className="text-xs max-w-sm mx-auto">
            Try tweaking your search term, theme filter, or timeframe to discover other daily thoughts.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPrompts.map((prompt) => {
            const isExpanded = expandedPromptId === prompt.id
            const promptComments = commentsMap[prompt.id] || []
            const encodedPrompt = encodeURIComponent(`💭 [${prompt.tag}]\n"${prompt.prompt}"\n\n`)

            return (
              <div
                key={prompt.id}
                id={prompt.id}
                className="card p-5 bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 rounded-3xl shadow-xs hover:shadow-md transition-all space-y-3"
              >
                {/* Prompt Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{prompt.icon}</span>
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded-lg border border-purple-200/50 dark:border-purple-800/40">
                      {prompt.tag}
                    </span>
                    {prompt.activeDate && (
                      <span className="text-[11px] text-gray-400 flex items-center gap-1 font-medium">
                        <Calendar size={11} />
                        <span>
                          {new Date(prompt.activeDate).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleCopyShare(prompt)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                    title="Share Link to this Question"
                  >
                    {copiedPromptId === prompt.id ? (
                      <Check size={14} className="text-emerald-500" />
                    ) : (
                      <Share2 size={14} />
                    )}
                  </button>
                </div>

                {/* Prompt Body */}
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 leading-snug">
                  "{prompt.prompt}"
                </h3>

                {/* Actions Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    {/* Like / Resonate */}
                    <button
                      onClick={() => handleToggleReaction(prompt.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold transition-colors cursor-pointer ${
                        prompt.isReactedByMe
                          ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 font-bold'
                          : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Heart size={14} className={prompt.isReactedByMe ? 'fill-current text-rose-500' : ''} />
                      <span>{prompt.reactionCount || 0}</span>
                    </button>

                    {/* Bookmark */}
                    <button
                      onClick={() => handleToggleSave(prompt.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold transition-colors cursor-pointer ${
                        prompt.isSavedByMe
                          ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 font-bold'
                          : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Bookmark size={14} className={prompt.isSavedByMe ? 'fill-current text-amber-500' : ''} />
                      <span>{prompt.saveCount || 0}</span>
                    </button>

                    {/* Toggle Discussion Thread */}
                    <button
                      onClick={() => handleToggleDiscussion(prompt.id)}
                      className={`flex items-center gap-1 px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
                        isExpanded
                          ? 'bg-purple-600 text-white shadow-2xs'
                          : 'text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100'
                      }`}
                    >
                      <MessageCircle size={14} />
                      <span>Dialogue</span>
                      <span>({prompt.commentCount || 0})</span>
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>

                  {/* Create Post Button */}
                  <Link
                    href={`/create?initialContent=${encodedPrompt}`}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-950 text-xs font-bold hover:opacity-90 active:scale-95 transition-all shadow-2xs"
                  >
                    <span>Write Story</span>
                    <ChevronRight size={12} strokeWidth={2.5} />
                  </Link>
                </div>

                {/* ── Expanded Discussion Thread ── */}
                {isExpanded && (
                  <div className="pt-3 border-t border-purple-100 dark:border-slate-800 space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-xs font-bold text-gray-500">
                      <span>Reflections & Community Dialogue</span>
                      <span>{promptComments.length} shared</span>
                    </div>

                    {/* Comments List */}
                    {commentsLoading && !commentsMap[prompt.id] ? (
                      <div className="py-4 text-center">
                        <Loader2 size={16} className="animate-spin text-purple-600 mx-auto" />
                      </div>
                    ) : promptComments.length === 0 ? (
                      <div className="py-3 px-4 rounded-2xl bg-gray-50 dark:bg-slate-800/60 text-center text-xs text-gray-400">
                        No reflections shared yet. Start this thread!
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {promptComments.map((comment) => (
                          <div
                            key={comment.id}
                            className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/70 border border-gray-100 dark:border-slate-700/60 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200 flex items-center justify-center font-bold text-[9px] overflow-hidden">
                                  {comment.isMasked ? (
                                    '🎭'
                                  ) : comment.author?.avatarUrl ? (
                                    <Image
                                      src={comment.author.avatarUrl}
                                      alt={comment.author.displayName}
                                      width={20}
                                      height={20}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    comment.author?.displayName?.charAt(0).toUpperCase() || 'U'
                                  )}
                                </div>
                                <span className="font-bold text-gray-900 dark:text-gray-100">
                                  {comment.isMasked
                                    ? comment.maskedPersona || 'Masked Voice'
                                    : comment.author?.displayName || 'Member'}
                                </span>
                                {comment.isMasked && (
                                  <span className="text-[9px] bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 px-1 py-0.2 rounded font-semibold">
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

                            <p className="text-gray-800 dark:text-gray-200 pl-7 leading-relaxed">
                              {comment.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reflection Composer */}
                    <div className="pt-1 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-500 font-medium">Add reflection</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setCommentIsMasked(!commentIsMasked)}
                            className={`flex items-center gap-1 font-bold px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                              commentIsMasked
                                ? 'bg-purple-600 text-white'
                                : 'text-gray-500 hover:text-purple-600'
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
                              : 'Share your perspective on this question...'
                          }
                          value={newCommentText}
                          onChange={(e) => setNewCommentText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleSubmitComment(prompt.id)
                            }
                          }}
                          className="flex-1 px-3.5 py-2 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />

                        <button
                          onClick={() => handleSubmitComment(prompt.id)}
                          disabled={submittingComment || !newCommentText.trim()}
                          className="px-3.5 py-2 rounded-2xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
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
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
