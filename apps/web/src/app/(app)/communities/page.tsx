'use client'

import React, { useState, useEffect } from 'react'
import { Users, Plus, Hash, Check } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function CommunitiesPage(): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const [communities, setCommunities] = useState<any[]>([])
  const [joinedCommunityIds, setJoinedCommunityIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentUserId(data.user.id)
      }
    })
  }, [supabase])

  const fetchCommunities = async () => {
    setLoading(true)
    const { data: comms } = await supabase
      .from('communities')
      .select('*')
      .order('created_at', { ascending: false })

    setCommunities(comms ?? [])

    if (currentUserId) {
      const { data: memberships } = await supabase
        .from('community_members')
        .select('community_id')
        .eq('user_id', currentUserId)

      setJoinedCommunityIds((memberships ?? []).map((m) => m.community_id))
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchCommunities()
  }, [currentUserId])

  async function handleToggleJoin(communityId: string) {
    if (!currentUserId) return
    const isJoined = joinedCommunityIds.includes(communityId)

    if (isJoined) {
      setJoinedCommunityIds((prev) => prev.filter((id) => id !== communityId))
      await supabase
        .from('community_members')
        .delete()
        .match({ community_id: communityId, user_id: currentUserId })
    } else {
      setJoinedCommunityIds((prev) => [...prev, communityId])
      await supabase
        .from('community_members')
        .insert({ community_id: communityId, user_id: currentUserId })
    }
  }

  async function handleCreateCommunity(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !currentUserId) return

    setCreating(true)
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-')

    const { data: comm, error } = await supabase
      .from('communities')
      .insert({
        name: name.trim(),
        slug,
        description: description.trim() || null,
        creator_id: currentUserId,
      })
      .select()
      .single()

    if (!error && comm) {
      // Auto join as owner
      await supabase
        .from('community_members')
        .insert({ community_id: comm.id, user_id: currentUserId, role: 'owner' })

      setName('')
      setDescription('')
      setShowCreateModal(false)
      fetchCommunities()
    }
    setCreating(false)
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Communities</h1>
          <p className="text-xs text-gray-500">Discover and join topic-based groups</p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5"
        >
          <Plus size={16} />
          <span>Create Community</span>
        </button>
      </div>

      {/* Community Grid */}
      {loading ? (
        <div className="card p-12 text-center text-gray-400">
          <p className="text-sm">Loading communities...</p>
        </div>
      ) : communities.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <div className="text-5xl">👥</div>
          <h3 className="font-bold text-gray-900">No Communities Found</h3>
          <p className="text-xs text-gray-500 max-w-xs mx-auto">
            Be the first to create a community around your favorite topic!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {communities.map((comm) => {
            const isJoined = joinedCommunityIds.includes(comm.id)
            return (
              <div key={comm.id} className="card p-5 space-y-3 flex flex-col justify-between hover:border-gray-300 transition-colors">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 font-bold flex items-center justify-center">
                    <Hash size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">{comm.name}</h3>
                    <p className="text-xs text-gray-500 line-clamp-2 mt-1">{comm.description || 'No description provided.'}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleJoin(comm.id)}
                  className={`w-full text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                    isJoined
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      : 'bg-brand-600 text-white hover:bg-brand-700'
                  }`}
                >
                  {isJoined ? (
                    <>
                      <Check size={14} />
                      <span>Joined</span>
                    </>
                  ) : (
                    <>
                      <Plus size={14} />
                      <span>Join Community</span>
                    </>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6 bg-white space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Create a Community</h2>

            <form onSubmit={handleCreateCommunity} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Community Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Photography, Campus Life, Coding"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="What is this community about?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input-field text-sm resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary flex-1 text-xs py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !name.trim()}
                  className="btn-primary flex-1 text-xs py-2"
                >
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
