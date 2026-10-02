'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Search, TrendingUp, Users, Hash, User } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function ExplorePage(): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [profiles, setProfiles] = useState<any[]>([])
  const [communities, setCommunities] = useState<any[]>([])
  const [hashtags, setHashtags] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function loadPopularData() {
      setLoading(true)
      const [{ data: profs }, { data: comms }, { data: tags }] = await Promise.all([
        supabase.from('profiles').select('*').limit(6),
        supabase.from('communities').select('*').limit(6),
        supabase.from('hashtags').select('*').limit(8),
      ])

      setProfiles(profs ?? [])
      setCommunities(comms ?? [])
      setHashtags(tags ?? [])
      setLoading(false)
    }

    loadPopularData()
  }, [supabase])

  async function handleSearch(term: string) {
    setSearchTerm(term)
    if (!term.trim()) return

    const { data: matchedProfiles } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
      .limit(10)

    if (matchedProfiles) setProfiles(matchedProfiles)
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Search Bar */}
      <div className="relative">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search people, hashtags, topics..."
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          className="input-field pl-10 text-sm py-3 rounded-xl shadow-sm"
        />
      </div>

      {/* Trending Hashtags */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-2 text-brand-600 font-bold text-sm">
          <TrendingUp size={18} />
          <span>Trending Hashtags</span>
        </div>

        {hashtags.length === 0 ? (
          <p className="text-xs text-gray-400">No hashtags trending yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {hashtags.map((tag) => (
              <span
                key={tag.id}
                className="px-3 py-1.5 rounded-lg bg-gray-100 text-xs font-semibold text-gray-700 hover:bg-brand-50 hover:text-brand-700 transition-colors cursor-pointer"
              >
                #{tag.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* People Discovery */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 font-bold text-gray-900 text-sm">
          <User size={18} className="text-gray-500" />
          <span>People to Discover</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {profiles.map((user) => (
            <Link
              key={user.id}
              href={`/@${user.username}`}
              className="card p-4 flex items-center justify-between hover:border-gray-300 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-600 flex-shrink-0">
                  {user.display_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-sm text-gray-900 truncate group-hover:text-brand-600 transition-colors">
                    {user.display_name}
                  </h4>
                  <p className="text-xs text-gray-500 truncate">@{user.username}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Community Discovery */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 font-bold text-gray-900 text-sm">
          <Users size={18} className="text-gray-500" />
          <span>Recommended Communities</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {communities.map((comm) => (
            <div key={comm.id} className="card p-4 flex items-center justify-between hover:border-gray-300 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold flex-shrink-0">
                  <Hash size={18} />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-sm text-gray-900 truncate">{comm.name}</h4>
                  <p className="text-xs text-gray-500 truncate">{comm.description || 'Community'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
