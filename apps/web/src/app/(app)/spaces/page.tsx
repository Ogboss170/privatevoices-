'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import {
  Radio,
  Plus,
  Users,
  Mic,
  Volume2,
  Sparkles,
  Loader2,
  X,
  Play
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { LiveSpace } from '@private-voices/shared'
import { LiveSpaceModal } from '@/components/spaces/LiveSpaceModal'

export default function SpacesPage(): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [spaces, setSpaces] = useState<LiveSpace[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null)

  // Create Space Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newTopic, setNewTopic] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentUserId(data.user.id)
      }
    })
  }, [supabase])

  const fetchSpaces = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('spaces')
        .select(`
          *,
          host:profiles!spaces_host_id_fkey(id, username, display_name, avatar_url)
        `)
        .eq('status', 'live')
        .order('created_at', { ascending: false })

      if (!error && data) {
        const mapped: LiveSpace[] = data.map((s: any) => ({
          id: s.id,
          title: s.title,
          topic: s.topic,
          hostId: s.host_id,
          host: s.host ? {
            id: s.host.id,
            username: s.host.username,
            displayName: s.host.display_name,
            avatarUrl: s.host.avatar_url,
          } : undefined,
          status: s.status,
          speakerCount: s.speaker_count,
          listenerCount: s.listener_count,
          createdAt: s.created_at,
        }))
        setSpaces(mapped)
      }
    } catch (err) {
      console.error('Error fetching live spaces:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchSpaces()

    // Realtime channel for live spaces updates
    const channel = supabase
      .channel('public:spaces')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'spaces' },
        () => {
          fetchSpaces()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchSpaces, supabase])

  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUserId || !newTitle.trim()) return

    setCreating(true)
    try {
      const { data, error } = await supabase
        .from('spaces')
        .insert({
          title: newTitle.trim(),
          topic: newTopic.trim() || null,
          host_id: currentUserId,
          status: 'live',
          speaker_count: 1,
          listener_count: 0,
        })
        .select()
        .single()

      if (!error && data) {
        setShowCreateModal(false)
        setNewTitle('')
        setNewTopic('')
        setActiveSpaceId(data.id)
        fetchSpaces()
      }
    } catch (err: any) {
      alert(err.message || 'Could not start space')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-purple-900 to-gray-950 text-white p-6 sm:p-8 shadow-xl border border-white/10">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-black tracking-wide uppercase">
              <Radio size={14} className="animate-pulse text-rose-400" />
              <span>Live Drop-in Audio</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Group Voice Lounges & Spaces
            </h1>
            <p className="text-sm text-purple-200/80 leading-relaxed">
              Drop in, listen to uncensored anonymous chats, raise your hand to speak, or host your own community audio stage.
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="self-start sm:self-center px-5 py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white font-bold text-sm shadow-lg shadow-rose-500/25 flex items-center gap-2 transition-all transform active:scale-95"
          >
            <Plus size={18} />
            <span>Start a Space</span>
          </button>
        </div>

        {/* Ambient background blur */}
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-indigo-500/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Spaces Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>Happening Now</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {spaces.length} Live
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="card p-12 text-center text-gray-400">
            <Loader2 size={24} className="animate-spin text-brand-600 mx-auto mb-2" />
            <p className="text-xs">Finding active voice spaces...</p>
          </div>
        ) : spaces.length === 0 ? (
          <div className="card p-12 text-center space-y-4 border-dashed border-2 border-gray-200">
            <div className="text-5xl">🎙️</div>
            <h3 className="font-bold text-gray-900 text-lg">No Voice Lounges Live</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Be the first to start a conversation! Host an audio stage, invite members, or discuss whatever is on your mind.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary text-xs py-2.5 px-4 inline-flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={16} />
              <span>Host the First Space</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {spaces.map((space) => (
              <div
                key={space.id}
                onClick={() => setActiveSpaceId(space.id)}
                className="card p-5 hover:border-purple-300 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-4 relative overflow-hidden"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-rose-50 text-rose-600 border border-rose-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                      LIVE
                    </span>

                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Users size={12} />
                      <span>{space.speakerCount + space.listenerCount} in room</span>
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-gray-900 group-hover:text-purple-600 transition-colors">
                    {space.title}
                  </h3>

                  {space.topic && (
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {space.topic}
                    </p>
                  )}
                </div>

                {/* Host Info & Join Pill */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-600 text-xs overflow-hidden flex-shrink-0">
                      {space.host?.avatarUrl ? (
                        <Image
                          src={space.host.avatarUrl}
                          alt={space.host.displayName}
                          width={32}
                          height={32}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        space.host?.displayName?.charAt(0).toUpperCase() || 'H'
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">
                        {space.host?.displayName || 'Host'}
                      </p>
                      <p className="text-[10px] text-gray-400">Host</p>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveSpaceId(space.id)
                    }}
                    className="px-3 py-1.5 rounded-xl bg-purple-50 group-hover:bg-purple-600 text-purple-700 group-hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                  >
                    <Play size={12} fill="currentColor" />
                    <span>Drop In</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Space Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <Radio size={18} className="text-rose-500" />
                <span>Start a Live Voice Space</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSpace} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Space Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Late Night Confessions & Advice"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Topic / Guidelines (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="What is this space about? Keep it friendly and anonymous."
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary text-xs py-2 px-3.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newTitle.trim()}
                  className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {creating ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Starting Space...</span>
                    </>
                  ) : (
                    <>
                      <Radio size={14} />
                      <span>Go Live Now</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Voice Space Modal */}
      {activeSpaceId && currentUserId && (
        <LiveSpaceModal
          spaceId={activeSpaceId}
          currentUserId={currentUserId}
          isOpen={!!activeSpaceId}
          onClose={() => {
            setActiveSpaceId(null)
            fetchSpaces()
          }}
        />
      )}
    </div>
  )
}
