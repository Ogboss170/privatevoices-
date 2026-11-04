'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Bookmark,
  Sparkles,
  MessageSquare,
  Repeat,
  Heart,
  Calendar,
  Share2,
  Trash2,
  ChevronRight,
  Loader2,
  MessageCircle,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import PostCard from '@/components/feed/PostCard'
import type { Post, DailyThoughtPrompt } from '@private-voices/shared'

export default function SavedHubPage(): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'thoughts' | 'posts'>('thoughts')
  const [loading, setLoading] = useState(true)

  // Saved Thoughts of the Day
  const [savedThoughts, setSavedThoughts] = useState<DailyThoughtPrompt[]>([])

  // Saved Posts / Voices
  const [savedPosts, setSavedPosts] = useState<Post[]>([])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentUserId(data.user.id)
      }
    })
  }, [supabase])

  const fetchSavedItems = useCallback(async () => {
    if (!currentUserId) return
    setLoading(true)

    try {
      // 1. Fetch Saved Thoughts of the Day
      const { data: savedPromptRows } = await supabase
        .from('prompt_saves')
        .select(`
          prompt_id,
          created_at,
          prompt:daily_thought_prompts(id, tag, prompt, icon, active_date, is_active)
        `)
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false })

      if (savedPromptRows) {
        const thoughts: DailyThoughtPrompt[] = savedPromptRows
          .filter((r: any) => r.prompt)
          .map((r: any) => ({
            id: r.prompt.id,
            tag: r.prompt.tag,
            prompt: r.prompt.prompt,
            icon: r.prompt.icon,
            activeDate: r.prompt.active_date,
            isActive: r.prompt.is_active,
            isSavedByMe: true,
          }))
        setSavedThoughts(thoughts)
      }

      // 2. Fetch Saved Posts
      const { data: savedPostRows } = await supabase
        .from('saved_posts')
        .select('post_id, created_at')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false })

      if (savedPostRows && savedPostRows.length > 0) {
        const savedIds = savedPostRows.map((r) => r.post_id)
        const { data: rawSavedPosts } = await supabase
          .from('posts')
          .select('*, author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url)')
          .in('id', savedIds)

        if (rawSavedPosts) {
          const postMap = new Map(rawSavedPosts.map((p) => [p.id, p]))
          const orderedSaved = savedIds.map((id) => postMap.get(id)).filter(Boolean) as any[]

          const formatted: Post[] = await Promise.all(
            orderedSaved.map(async (p) => {
              const [{ count: likeCount }, { count: commentCount }, { data: myLike }] = await Promise.all([
                supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
                supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
                supabase.from('likes').select('user_id').match({ user_id: currentUserId, post_id: p.id }).maybeSingle(),
              ])

              return {
                id: p.id,
                authorId: p.author_id,
                author: {
                  id: p.author?.id || p.author_id,
                  username: p.author?.username || 'user',
                  displayName: p.author?.display_name || 'Anonymous',
                  avatarUrl: p.author?.avatar_url || null,
                },
                content: p.content,
                mediaUrl: p.media_url,
                mediaType: p.media_type,
                imageUrls: p.image_urls || [],
                hashtags: p.hashtags || [],
                likeCount: likeCount || 0,
                commentCount: commentCount || 0,
                repostCount: p.repost_count || 0,
                isLikedByMe: !!myLike,
                isSavedByMe: true,
                isRepostedByMe: false,
                isMasked: p.is_masked,
                maskedPersona: p.masked_persona,
                createdAt: p.created_at,
                updatedAt: p.updated_at || p.created_at,
              }
            })
          )
          setSavedPosts(formatted)
        }
      } else {
        setSavedPosts([])
      }
    } catch (err) {
      console.error('Error fetching saved hub items:', err)
    } finally {
      setLoading(false)
    }
  }, [currentUserId, supabase])

  useEffect(() => {
    fetchSavedItems()
  }, [fetchSavedItems])

  // Remove saved thought
  const handleRemoveSavedThought = async (promptId: string) => {
    if (!currentUserId) return
    setSavedThoughts((prev) => prev.filter((t) => t.id !== promptId))
    try {
      await supabase
        .from('prompt_saves')
        .delete()
        .eq('prompt_id', promptId)
        .eq('user_id', currentUserId)
    } catch (err) {
      console.error('Error removing saved thought:', err)
      fetchSavedItems()
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-brand-500/10 dark:from-amber-950/20 dark:via-purple-950/20 dark:to-slate-800 p-6 border border-amber-200/50 dark:border-amber-900/40 shadow-xs space-y-2">
        <div className="flex items-center gap-2.5 text-amber-700 dark:text-amber-400 font-bold text-xs uppercase tracking-wider">
          <Bookmark size={16} className="fill-current text-amber-500" />
          <span>Personal Sanctuary</span>
        </div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">
          Saved Thoughts & Bookmarks
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Revisit poignant reflections, preserved daily questions, and thought-provoking voices you’ve saved.
        </p>
      </div>

      {/* Segmented Filter Switch */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('thoughts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'thoughts'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'
          }`}
        >
          <span>💭</span>
          <span>Thoughts of the Day</span>
          <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-black/10 text-white">
            {savedThoughts.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('posts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'posts'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'
          }`}
        >
          <Bookmark size={14} className={activeTab === 'posts' ? 'fill-current' : ''} />
          <span>Bookmarked Voices</span>
          <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-black/10 text-white">
            {savedPosts.length}
          </span>
        </button>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-16 text-center">
          <Loader2 size={24} className="animate-spin text-purple-600 mx-auto" />
          <p className="text-xs text-gray-400 mt-2">Opening your saved library...</p>
        </div>
      ) : activeTab === 'thoughts' ? (
        savedThoughts.length === 0 ? (
          <div className="card p-12 text-center text-gray-400 dark:text-gray-500 space-y-3 border-dashed border-2">
            <div className="text-4xl">💭</div>
            <h3 className="font-bold text-gray-800 dark:text-gray-200 text-base">
              No Saved Thoughts of the Day
            </h3>
            <p className="text-xs max-w-sm mx-auto leading-relaxed">
              When a Thought of the Day resonates with you on the feed, tap the bookmark icon to save it here for ongoing reflection.
            </p>
            <Link
              href="/feed"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 hover:text-purple-700 pt-2"
            >
              <span>Explore Today's Feed</span>
              <ChevronRight size={13} />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {savedThoughts.map((thought) => {
              const encodedPrompt = encodeURIComponent(`💭 [${thought.tag}]\n"${thought.prompt}"\n\n`)
              return (
                <div
                  key={thought.id}
                  className="card p-5 bg-gradient-to-br from-white via-amber-50/20 to-purple-50/10 dark:from-slate-900 dark:via-slate-900 dark:to-purple-950/20 border border-amber-200/50 dark:border-amber-900/30 rounded-3xl shadow-2xs hover:shadow-sm transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{thought.icon || '💭'}</span>
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                        {thought.tag}
                      </span>
                    </div>

                    <button
                      onClick={() => handleRemoveSavedThought(thought.id)}
                      className="p-1.5 text-gray-400 hover:text-rose-500 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      title="Remove from Saved"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 leading-snug">
                    "{thought.prompt}"
                  </p>

                  <div className="pt-2 flex items-center justify-between border-t border-amber-100 dark:border-slate-800">
                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                      <Calendar size={12} />
                      <span>Saved Reflection</span>
                    </span>

                    <Link
                      href={`/create?initialContent=${encodedPrompt}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs"
                    >
                      <span>Share Perspective</span>
                      <ChevronRight size={12} strokeWidth={2.5} />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : savedPosts.length === 0 ? (
        <div className="card p-12 text-center text-gray-400 dark:text-gray-500 space-y-3 border-dashed border-2">
          <div className="text-4xl">🔖</div>
          <h3 className="font-bold text-gray-800 dark:text-gray-200 text-base">
            No Bookmarked Posts
          </h3>
          <p className="text-xs max-w-sm mx-auto leading-relaxed">
            Voices, whispers, and thoughts you bookmark from the community will stay safe here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {savedPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId || undefined}
              onToggleSave={(id, isSaved) => {
                if (!isSaved) {
                  setSavedPosts((prev) => prev.filter((p) => p.id !== id))
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
