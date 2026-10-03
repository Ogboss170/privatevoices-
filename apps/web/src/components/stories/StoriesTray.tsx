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
    const now = new Date().toISOString()

    const { data: stories } = await supabase
      .from('stories')
      .select('*, author:profiles!stories_author_id_fkey(id, username, display_name, avatar_url)')
      .gt('expires_at', now)
      .order('created_at', { ascending: false })

    if (stories) {
      const authorMap = new Map<string, StoryGroup>()

      for (const story of stories) {
        const authorId = story.author_id
        if (!authorMap.has(authorId)) {
          authorMap.set(authorId, {
            author: {
              id: story.author.id,
              username: story.author.username,
              displayName: story.author.display_name,
              avatarUrl: story.author.avatar_url,
            },
            stories: [],
          })
        }
        authorMap.get(authorId)!.stories.push(story)
      }

      setStoryGroups(Array.from(authorMap.values()))
    }
    setLoading(false)
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
      {storyGroups.map((group) => (
        <button
          key={group.author.id}
          onClick={() => setActiveStoryGroup(group)}
          className="flex flex-col items-center gap-1 flex-shrink-0 group"
        >
          <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-brand-500 to-purple-600 group-hover:scale-105 transition-transform">
            <div className="w-full h-full rounded-full bg-white p-0.5">
              <div className="w-full h-full rounded-full bg-brand-100 flex items-center justify-center font-bold text-sm text-brand-600">
                {group.author.displayName.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
          <span className="text-[11px] font-medium text-gray-700 truncate max-w-[64px]">
            {group.author.displayName}
          </span>
        </button>
      ))}

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
