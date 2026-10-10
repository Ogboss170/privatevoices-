'use client'

import React, { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import CreateStoryModal from './CreateStoryModal'
import StoryViewerModal from './StoryViewerModal'

interface StoryGroup {
  author: {
    id: string
    username: string
    displayName: string
    avatarUrl: string | null
  }
  stories: any[]
}

export default function StoriesTray(): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [activeStoryGroup, setActiveStoryGroup] = useState<StoryGroup | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | undefined>()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
  }, [supabase])

  const fetchStories = async () => {
    setLoading(true)
    try {
      const now = new Date().toISOString()

      let { data: stories, error } = await supabase
        .from('stories')
        .select('*, author:profiles!stories_author_id_fkey(id, username, display_name, avatar_url)')
        .gt('expires_at', now)
        .order('created_at', { ascending: false })

      if (error || !stories) {
        console.warn('Stories FK query failed, falling back to direct select:', error)
        const fallbackRes = await supabase
          .from('stories')
          .select('*')
          .gt('expires_at', now)
          .order('created_at', { ascending: false })
        stories = fallbackRes.data
      }

      if (stories && stories.length > 0) {
        // Collect distinct author IDs for missing author profiles
        const missingAuthorIds = stories
          .filter((s) => !s.author)
          .map((s) => s.author_id)

        let profileMap = new Map()
        if (missingAuthorIds.length > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url')
            .in('id', missingAuthorIds)
          profileMap = new Map((profs ?? []).map((p) => [p.id, p]))
        }

        const authorMap = new Map<string, StoryGroup>()

        for (const story of stories) {
          const authorId = story.author_id
          const authorData = story.author || profileMap.get(authorId) || {
            id: authorId,
            username: 'user',
            displayName: 'User',
            avatarUrl: null,
          }

          if (!authorMap.has(authorId)) {
            authorMap.set(authorId, {
              author: {
                id: authorData.id,
                username: authorData.username || 'user',
                displayName: authorData.display_name || authorData.displayName || 'User',
                avatarUrl: authorData.avatar_url || authorData.avatarUrl || null,
              },
              stories: [],
            })
          }
          authorMap.get(authorId)!.stories.push(story)
        }

        setStoryGroups(Array.from(authorMap.values()))
      } else {
        setStoryGroups([])
      }
    } catch (err) {
      console.error('Error fetching stories:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStories()
  }, [])

  return (
    <div className="card p-3 flex items-center gap-3 overflow-x-auto no-scrollbar">
      {/* Add Story Button */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="flex flex-col items-center gap-1 flex-shrink-0 group"
      >
        <div className="w-14 h-14 rounded-full border-2 border-dashed border-brand-400 bg-brand-50 flex items-center justify-center text-brand-600 group-hover:scale-105 transition-transform">
          <Plus size={22} />
        </div>
        <span className="text-[11px] font-medium text-gray-700">Add Story</span>
      </button>

      {/* Stories Tray */}
      {storyGroups.map((group) => {
        const hasVoice = group.stories.some(
          (s) => s.media_type === 'audio' || s.media_url?.match(/\.(mp3|wav|ogg|m4a|aac|webm)(\?.*)?$/i)
        )
        const hasVideo = group.stories.some(
          (s) => s.media_type === 'video' || s.media_url?.match(/\.(mp4|mov|webm|quicktime)(\?.*)?$/i)
        )

        return (
          <button
            key={group.author.id}
            onClick={() => setActiveStoryGroup(group)}
            className="flex flex-col items-center gap-1 flex-shrink-0 group"
          >
            <div className="relative">
              <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-brand-500 via-purple-500 to-pink-500 group-hover:scale-105 transition-transform shadow-2xs">
                <div className="w-full h-full rounded-full bg-white p-0.5">
                  <div className="w-full h-full rounded-full bg-brand-100 flex items-center justify-center font-bold text-sm text-brand-600 overflow-hidden">
                    {group.author.avatarUrl ? (
                      <img
                        src={group.author.avatarUrl}
                        alt={group.author.displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      group.author.displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                </div>
              </div>
              {hasVoice && (
                <span
                  className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-brand-600 text-white flex items-center justify-center text-[9px] shadow-sm border border-white"
                  title="Contains Voice Whisper Story"
                >
                  🎙️
                </span>
              )}
              {!hasVoice && hasVideo && (
                <span
                  className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center text-[9px] shadow-sm border border-white"
                  title="Contains Video Story"
                >
                  🎥
                </span>
              )}
            </div>
            <span className="text-[11px] font-medium text-gray-700 truncate max-w-[64px]">
              {group.author.displayName}
            </span>
          </button>
        )
      })}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateStoryModal
          onClose={() => setShowCreateModal(false)}
          onCreated={fetchStories}
        />
      )}

      {/* View Modal */}
      {activeStoryGroup && (
        <StoryViewerModal
          storyGroup={activeStoryGroup}
          currentUserId={currentUserId}
          onClose={() => setActiveStoryGroup(null)}
        />
      )}
    </div>
  )
}
