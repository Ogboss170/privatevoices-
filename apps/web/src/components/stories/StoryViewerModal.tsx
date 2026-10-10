'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, Eye, Clock, Sparkles, Volume2, Mic, Film } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import VoiceWaveformPlayer from '@/components/common/VoiceWaveformPlayer'

interface FloatingEmoji {
  id: string
  emoji: string
  left: number
}

interface StoryGroup {
  author: {
    id: string
    username: string
    displayName: string
    avatarUrl: string | null
  }
  stories: any[]
}

interface StoryViewerModalProps {
  storyGroup: StoryGroup
  currentUserId?: string
  onClose: () => void
}

export default function StoryViewerModal({
  storyGroup,
  currentUserId,
  onClose,
}: StoryViewerModalProps): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [viewers, setViewers] = useState<any[]>([])
  const [showViewers, setShowViewers] = useState(false)
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([])
  const [reactionSentBadge, setReactionSentBadge] = useState<string | null>(null)

  const stories = storyGroup?.stories ?? []
  const currentStory = stories[currentIndex]
  const author = storyGroup?.author ?? { id: '', username: 'user', displayName: 'User', avatarUrl: null }
  const isOwner = currentUserId === author.id

  useEffect(() => {
    if (!currentStory?.id || !currentUserId) return

    // Record story view safely
    supabase.from('story_views').insert({
      story_id: currentStory.id,
      viewer_id: currentUserId,
    }).then()

    if (isOwner) {
      supabase
        .from('story_views')
        .select('*, viewer:profiles(id, username, display_name, avatar_url)')
        .eq('story_id', currentStory.id)
        .then(({ data }) => setViewers(data ?? []))
    }
  }, [supabase, currentStory?.id, currentUserId, isOwner])

  if (!currentStory) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
        <div className="bg-gray-900 text-white p-6 rounded-2xl text-center space-y-4">
          <p>No story available.</p>
          <button onClick={onClose} className="px-4 py-2 bg-brand-600 rounded-xl font-bold text-xs">
            Close
          </button>
        </div>
      </div>
    )
  }

  function handleNext() {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      onClose()
    }
  }

  function handlePrev() {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const formatRemainingTime = useCallback((expiresAt?: string, createdAt?: string) => {
    const target = expiresAt
      ? new Date(expiresAt).getTime()
      : createdAt
      ? new Date(createdAt).getTime() + 24 * 60 * 60 * 1000
      : Date.now() + 24 * 60 * 60 * 1000
    const diffMs = Math.max(0, target - Date.now())
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    if (diffHours <= 0) return `${diffMinutes}m left`
    return `${diffHours}h ${diffMinutes}m left`
  }, [])

  const triggerFloatingReaction = useCallback((emoji: string) => {
    const id = `${Date.now()}-${Math.random()}`
    const left = Math.floor(Math.random() * 60) + 20 // 20% to 80%
    setFloatingEmojis((prev) => [...prev, { id, emoji, left }])
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((item) => item.id !== id))
    }, 1800)
  }, [])

  const initialLetter = author.displayName ? author.displayName.charAt(0).toUpperCase() : 'U'

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      {/* Viewer Box */}
      <div className="relative w-full max-w-sm h-[560px] bg-gradient-to-b from-brand-900 to-gray-950 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between p-5 text-white">
        {/* Floating Animated Reaction Emojis */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
          {floatingEmojis.map((item) => (
            <div
              key={item.id}
              style={{ left: `${item.left}%`, bottom: '80px' }}
              className="absolute text-4xl select-none animate-bounce transition-all duration-1000 ease-out transform -translate-x-1/2 opacity-90"
            >
              {item.emoji}
            </div>
          ))}
        </div>

        {/* Progress Bars Header */}
        <div className="space-y-3 z-10">
          <div className="flex gap-1">
            {stories.map((s, idx) => (
              <div
                key={s.id || idx}
                className={`h-1 flex-1 rounded-full transition-all ${
                  idx <= currentIndex ? 'bg-white' : 'bg-white/30'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {author.avatarUrl ? (
                <img
                  src={author.avatarUrl}
                  alt={author.displayName}
                  className="w-8 h-8 rounded-full object-cover border border-white/20"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center font-bold text-xs border border-white/20">
                  {initialLetter}
                </div>
              )}
              <div>
                <h4 className="font-bold text-xs text-white">{author.displayName}</h4>
                <div className="flex items-center gap-1.5 text-[10px] text-white/70">
                  <span>
                    {currentStory.created_at
                      ? new Date(currentStory.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : ''}
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/10 text-brand-300 font-semibold border border-white/10">
                    <Clock size={10} />
                    {formatRemainingTime(currentStory.expires_at, currentStory.created_at)}
                  </span>
                </div>
              </div>
            </div>

            <button onClick={onClose} className="p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Story Content */}
        <div className="my-auto text-center px-2 space-y-4 flex flex-col items-center justify-center overflow-hidden w-full">
          {/* Video Story */}
          {(currentStory.media_type === 'video' || (currentStory.media_url && currentStory.media_url.match(/\.(mp4|mov|webm|quicktime)(\?.*)?$/i))) && currentStory.media_url ? (
            <div className="relative w-full h-72 rounded-2xl overflow-hidden my-2 border border-white/10 shadow-lg flex items-center justify-center bg-black">
              <video
                src={currentStory.media_url}
                controls
                playsInline
                autoPlay
                className="w-full h-full object-contain"
              />
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-[10px] text-white flex items-center gap-1 font-medium pointer-events-none">
                <Film size={11} className="text-purple-400" />
                <span>Video Story</span>
              </div>
            </div>
          ) : (currentStory.media_type === 'audio' || (currentStory.media_url && currentStory.media_url.match(/\.(mp3|wav|ogg|m4a|aac|webm)(\?.*)?$/i))) && currentStory.media_url ? (
            /* Voice Whisper Story */
            <div className="w-full my-3 p-4 rounded-2xl bg-black/50 backdrop-blur-md border border-white/10 shadow-xl space-y-3">
              <div className="flex items-center gap-2 text-brand-300 text-xs font-semibold">
                <Mic size={15} className="animate-pulse text-brand-400" />
                <span>Voice Whisper Story</span>
              </div>
              <VoiceWaveformPlayer
                audioUrl={currentStory.media_url}
                theme="dark"
                barCount={24}
              />
            </div>
          ) : currentStory.media_url ? (
            /* Image Story */
            <div className="relative w-full h-64 rounded-2xl overflow-hidden my-2 border border-white/10 shadow-lg flex items-center justify-center bg-black/40">
              <img
                src={currentStory.media_url}
                alt="Story content"
                className="w-full h-full object-cover"
              />
            </div>
          ) : null}

          {currentStory.content && (
            <p className="text-base font-semibold leading-relaxed tracking-wide bg-black/50 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 max-w-full break-words">
              "{currentStory.content}"
            </p>
          )}
        </div>

        {/* Navigation Controls */}
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-0 transition-opacity"
        >
          <ChevronLeft size={24} />
        </button>

        <button
          onClick={handleNext}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-opacity"
        >
          <ChevronRight size={24} />
        </button>

        {/* Bottom Bar / Viewer Count / Reactions */}
        {isOwner ? (
          <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs z-10">
            <button
              onClick={() => setShowViewers(!showViewers)}
              className="flex items-center gap-1.5 text-white/80 hover:text-white"
            >
              <Eye size={16} />
              <span>{viewers.length} views</span>
            </button>
          </div>
        ) : (
          <div className="pt-3 border-t border-white/10 space-y-2 z-10">
            {/* Quick Emoji Reaction Buttons */}
            <div className="flex items-center justify-around bg-black/40 backdrop-blur-md py-1.5 px-3 rounded-full border border-white/10">
              {['❤️', '🔥', '👏', '😂', '😮', '😍'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={async () => {
                    if (!currentUserId || !author.id) return
                    // Trigger visual floating reaction instantly
                    triggerFloatingReaction(emoji)
                    setReactionSentBadge(`Reacted ${emoji}`)
                    setTimeout(() => setReactionSentBadge(null), 2200)

                    // Send reaction directly to author conversation in background
                    const userA = currentUserId < author.id ? currentUserId : author.id
                    const userB = currentUserId < author.id ? author.id : currentUserId

                    const { data: conv } = await supabase
                      .from('conversations')
                      .select('id')
                      .eq('user_a_id', userA)
                      .eq('user_b_id', userB)
                      .maybeSingle()

                    let targetConvId = conv?.id
                    if (!targetConvId) {
                      const { data: newC } = await supabase
                        .from('conversations')
                        .insert({ user_a_id: userA, user_b_id: userB, last_message: `Reacted ${emoji} to story` })
                        .select('id')
                        .single()
                      targetConvId = newC?.id
                    }

                    if (targetConvId) {
                      await supabase.from('messages').insert({
                        conversation_id: targetConvId,
                        sender_id: currentUserId,
                        content: `Reacted ${emoji} to your story`,
                      })
                    }
                  }}
                  className="text-lg hover:scale-130 active:scale-95 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {reactionSentBadge && (
              <div className="text-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/80 backdrop-blur-md text-white text-[11px] font-bold shadow-lg animate-fade-in">
                  <Sparkles size={12} />
                  <span>{reactionSentBadge}</span>
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Viewer List Modal */}
      {showViewers && (
        <div className="absolute inset-0 bg-black/80 flex items-end justify-center p-4 z-20">
          <div className="card w-full max-w-sm p-4 bg-white text-gray-900 rounded-2xl space-y-3 max-h-80 overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="font-bold text-xs">Story Viewers ({viewers.length})</h4>
              <button onClick={() => setShowViewers(false)} className="text-gray-400">
                <X size={16} />
              </button>
            </div>

            {viewers.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No views yet.</p>
            ) : (
              viewers.map((v, idx) => (
                <div key={v.id || idx} className="flex items-center gap-2.5 text-xs">
                  <div className="w-7 h-7 rounded-full bg-brand-100 font-bold text-brand-700 flex items-center justify-center">
                    {(v.viewer?.display_name || v.viewer?.username || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span className="font-semibold text-gray-900">{v.viewer?.display_name || v.viewer?.username || 'User'}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
