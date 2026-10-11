'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Users, Plus, Hash, Check, Globe, Lock, Radio, Camera, Sparkles, Search } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function CommunitiesPage(): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const [communities, setCommunities] = useState<any[]>([])
  const [joinedCommunityIds, setJoinedCommunityIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')

  // Create form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('General')
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public')
  const [broadcastMode, setBroadcastMode] = useState(false)
  const [coverUrl, setCoverUrl] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
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

  async function handleToggleJoin(communityId: string, isPrivate: boolean) {
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
        .insert({
          community_id: communityId,
          user_id: currentUserId,
          role: 'member',
          status: isPrivate ? 'pending' : 'member',
        })
    }
  }

  async function handleCreateCommunity(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !currentUserId) return

    setCreating(true)
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(100 + Math.random() * 900)

    const { data: comm, error } = await supabase
      .from('communities')
      .insert({
        name: name.trim(),
        slug,
        description: description.trim() || null,
        category: category.trim() || 'General',
        privacy,
        broadcast_mode: broadcastMode,
        cover_url: coverUrl.trim() || null,
        banner_url: coverUrl.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        creator_id: currentUserId,
      })
      .select()
      .single()

    if (!error && comm) {
      // Auto join as owner
      await supabase
        .from('community_members')
        .insert({ community_id: comm.id, user_id: currentUserId, role: 'owner', status: 'member' })

      setName('')
      setDescription('')
      setCoverUrl('')
      setAvatarUrl('')
      setShowCreateModal(false)
      fetchCommunities()
    } else if (error) {
      alert(`Error creating community: ${error.message}`)
    }
    setCreating(false)
  }

  const filteredCommunities = communities.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(searchFilter.toLowerCase())
    const matchesCat = categoryFilter === 'All' || (c.category || 'General').toLowerCase() === categoryFilter.toLowerCase()
    return matchesSearch && matchesCat
  })

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Grand Facebook / Telegram Style Communities Header */}
      <div className="card p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-brand-950 text-white rounded-3xl shadow-xl border-none relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-lg">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-indigo-300 bg-white/10 px-3 py-1 rounded-full backdrop-blur-xs">
              <Sparkles size={12} className="text-amber-300" />
              <span>Public Groups & Channels</span>
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Explore Communities
            </h1>
            <p className="text-xs text-indigo-200/90 leading-relaxed">
              Connect with like-minded creators, join private topic groups, or follow official broadcast channels.
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary text-xs py-3 px-5 font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-brand-500/20 active:scale-95 transition-all self-start sm:self-auto"
          >
            <Plus size={16} />
            <span>Create Community</span>
          </button>
        </div>

        {/* Search bar inside header */}
        <div className="relative z-10 mt-6 pt-4 border-t border-white/10 flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search communities by name, topic, or keyword..."
              className="w-full pl-9 pr-4 py-2.5 bg-white/10 text-white text-xs rounded-xl placeholder-white/50 border border-white/15 focus:outline-none focus:ring-2 focus:ring-white/30 backdrop-blur-md"
            />
          </div>
        </div>
      </div>

      {/* Community Grid */}
      {loading ? (
        <div className="card p-12 text-center text-gray-400">
          <p className="text-sm">Loading communities...</p>
        </div>
      ) : filteredCommunities.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <div className="text-5xl">👥</div>
          <h3 className="font-bold text-gray-900 text-base">No Communities Found</h3>
          <p className="text-xs text-gray-500 max-w-xs mx-auto">
            {searchFilter ? 'No communities match your search.' : 'Be the first to create a community around your favorite topic!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredCommunities.map((comm) => {
            const isJoined = joinedCommunityIds.includes(comm.id)
            const isPrivate = comm.privacy === 'private'
            const isBroadcast = comm.broadcast_mode

            return (
              <div
                key={comm.id}
                className="card overflow-hidden shadow-sm hover:shadow-md border border-gray-200/80 transition-all flex flex-col justify-between bg-white group"
              >
                <div>
                  {/* Card Cover Banner */}
                  <div className="h-28 bg-gradient-to-r from-slate-900 via-indigo-950 to-brand-900 relative overflow-hidden">
                    {comm.cover_url || comm.banner_url ? (
                      <img
                        src={comm.cover_url || comm.banner_url}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/20 font-black text-2xl uppercase tracking-widest">
                        {comm.name}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                    {/* Channel & Privacy Badges */}
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                      {isPrivate ? (
                        <span className="px-2 py-0.5 rounded-full bg-black/60 text-amber-300 text-[10px] font-bold backdrop-blur-md flex items-center gap-1 border border-white/10">
                          <Lock size={10} />
                          <span>Private</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-black/60 text-emerald-300 text-[10px] font-bold backdrop-blur-md flex items-center gap-1 border border-white/10">
                          <Globe size={10} />
                          <span>Public</span>
                        </span>
                      )}

                      {isBroadcast && (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-600/90 text-white text-[10px] font-bold backdrop-blur-md flex items-center gap-1">
                          <Radio size={10} />
                          <span>Channel</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Profile Info & Avatar */}
                  <div className="p-4 relative pt-0">
                    <div className="flex items-end justify-between -mt-8 mb-2.5">
                      <div className="w-14 h-14 rounded-2xl bg-white p-1 shadow-md border-2 border-white relative z-10 flex-shrink-0">
                        {comm.avatar_url ? (
                          <img
                            src={comm.avatar_url}
                            alt=""
                            className="w-full h-full rounded-xl object-cover"
                          />
                        ) : (
                          <div className="w-full h-full rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white font-bold text-lg flex items-center justify-center shadow-inner">
                            {comm.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-gray-100 px-2 py-0.5 rounded-md">
                        {comm.category || 'General'}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-extrabold text-gray-900 text-base group-hover:text-brand-600 transition-colors">
                        {comm.name}
                      </h3>
                      <p className="text-[11px] text-brand-600 font-mono font-semibold">
                        c/{comm.slug}
                      </p>
                      <p className="text-xs text-gray-600 line-clamp-2 mt-1.5 leading-relaxed">
                        {comm.description || 'Welcome to our community. Tap view to explore posts and discussions.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="px-4 pb-4 pt-1 flex items-center gap-2 border-t border-gray-100">
                  <button
                    onClick={() => handleToggleJoin(comm.id, isPrivate)}
                    className={`flex-1 text-xs font-bold py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
                      isJoined
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                        : 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm'
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
                        <span>Join Group</span>
                      </>
                    )}
                  </button>

                  <Link
                    href={`/community/${comm.slug}`}
                    className="px-4 text-xs font-bold py-2 rounded-xl bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200 transition-colors flex items-center justify-center active:scale-95"
                  >
                    View
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Facebook & Telegram Style Community Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="card w-full max-w-lg p-6 bg-white space-y-4 shadow-2xl my-8 rounded-3xl border border-gray-100">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-base font-extrabold text-gray-900">Create New Community</h2>
                <p className="text-[11px] text-gray-500">Facebook-style group or Telegram-style broadcast channel</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCommunity} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Community Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lagos Tech Founders, Campus Voices, Abuja Creatives"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="What is this community about? Who should join?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input-field text-xs resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Category Topic</label>
                  <input
                    type="text"
                    placeholder="e.g. Technology, Education, Music"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="input-field text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Privacy Level</label>
                  <select
                    value={privacy}
                    onChange={(e) => setPrivacy(e.target.value as 'public' | 'private')}
                    className="input-field text-xs w-full font-medium"
                  >
                    <option value="public">🌐 Public (Anyone can discover & join)</option>
                    <option value="private">🔒 Private (Members-only, join by request)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Posting Mode</label>
                <select
                  value={broadcastMode ? 'broadcast' : 'discussion'}
                  onChange={(e) => setBroadcastMode(e.target.value === 'broadcast')}
                  className="input-field text-xs w-full font-medium"
                >
                  <option value="discussion">👥 Open Group (All members can post discussions)</option>
                  <option value="broadcast">📢 Broadcast Channel (Only Admins can broadcast voices)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Avatar Image URL (Optional)</label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    className="input-field text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Cover Banner URL (Optional)</label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={coverUrl}
                    onChange={(e) => setCoverUrl(e.target.value)}
                    className="input-field text-xs"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary flex-1 text-xs py-2.5 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !name.trim()}
                  className="btn-primary flex-1 text-xs py-2.5 font-bold shadow-sm"
                >
                  {creating ? 'Creating Community…' : 'Create Community'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

