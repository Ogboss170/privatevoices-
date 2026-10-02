'use client'

import React, { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, Eye } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

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

  const currentStory = storyGroup.stories[currentIndex]
  const isOwner = currentUserId === storyGroup.author.id

  useEffect(() => {
    if (!currentStory || !currentUserId) return

    // Record story view
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
  }, [supabase, currentStory, currentUserId, isOwner])

  function handleNext() {
    if (currentIndex < storyGroup.stories.length - 1) {
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

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      {/* Viewer Box */}
      <div className="relative w-full max-w-sm h-[560px] bg-gradient-to-b from-brand-900 to-gray-950 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between p-5 text-white">
        {/* Progress Bars Header */}
        <div className="space-y-3 z-10">
          <div className="flex gap-1">
            {storyGroup.stories.map((s, idx) => (
              <div
                key={s.id}
                className={`h-1 flex-1 rounded-full transition-all ${
                  idx <= currentIndex ? 'bg-white' : 'bg-white/30'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center font-bold text-xs border border-white/20">
                {storyGroup.author.displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 className="font-bold text-xs text-white">{storyGroup.author.displayName}</h4>
                <p className="text-[10px] text-white/70">
                  {new Date(currentStory.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            <button onClick={onClose} className="p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Story Content */}
        <div className="my-auto text-center px-4 space-y-4">
          <p className="text-lg font-semibold leading-relaxed tracking-wide">
            "{currentStory.content}"
          </p>
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

        {/* Bottom Bar / Viewer Count */}
        {isOwner && (
          <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs z-10">
            <button
              onClick={() => setShowViewers(!showViewers)}
              className="flex items-center gap-1.5 text-white/80 hover:text-white"
            >
              <Eye size={16} />
              <span>{viewers.length} views</span>
            </button>
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
              viewers.map((v) => (
                <div key={v.id} className="flex items-center gap-2.5 text-xs">
                  <div className="w-7 h-7 rounded-full bg-brand-100 font-bold text-brand-700 flex items-center justify-center">
                    {v.viewer?.display_name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-semibold text-gray-900">{v.viewer?.display_name}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
