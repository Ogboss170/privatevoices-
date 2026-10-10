'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Search, Users, ArrowRight, ShieldCheck, Radio } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function RightSidebar(): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [trendingCommunities, setTrendingCommunities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSidebarData() {
      const { data } = await supabase
        .from('communities')
        .select('*')
        .order('member_count', { ascending: false })
        .limit(3)

      if (data) {
        setTrendingCommunities(data)
      }
      setLoading(false)
    }
    fetchSidebarData()
  }, [supabase])

  return (
    <aside className="hidden lg:flex flex-col w-80 sticky top-0 h-screen py-6 px-4 space-y-6 border-l border-gray-200/80 bg-white/50 backdrop-blur-md overflow-y-auto">
      {/* Search Input Widget */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search Private Voices..."
          className="w-full bg-gray-100/80 hover:bg-gray-100 focus:bg-white text-xs font-medium text-gray-900 rounded-full pl-9 pr-4 py-2.5 transition-all outline-none ring-1 ring-transparent focus:ring-brand-500 border border-gray-200/50"
        />
      </div>

      {/* Recommended Communities Widget */}
      <div className="bg-gradient-to-b from-purple-50/70 to-indigo-50/40 rounded-2xl p-4 border border-purple-100/60 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-purple-900 font-bold text-xs">
            <Radio size={16} className="text-purple-600 animate-pulse" />
            <span>Trending Spaces</span>
          </div>
          <Link href="/spaces" className="text-[11px] font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-0.5">
            Explore <ArrowRight size={12} />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2 py-2">
            <div className="h-10 bg-purple-100/60 rounded-xl animate-pulse" />
            <div className="h-10 bg-purple-100/60 rounded-xl animate-pulse" />
          </div>
        ) : trendingCommunities.length > 0 ? (
          <div className="space-y-2">
            {trendingCommunities.map((community) => (
              <Link
                key={community.id}
                href={`/community/${community.slug}`}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-white/80 transition-colors group"
              >
                <div className="min-w-0 pr-2">
                  <h4 className="text-xs font-bold text-gray-900 truncate group-hover:text-purple-600 transition-colors">
                    {community.name}
                  </h4>
                  <p className="text-[11px] text-gray-500 truncate">
                    {community.member_count ?? 0} members
                  </p>
                </div>
                <span className="text-[10px] font-semibold bg-purple-100 text-purple-700 px-2 py-1 rounded-full group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  Join
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-gray-500 py-1">Discover spaces to connect anonymously.</p>
        )}
      </div>

      {/* Privacy Guarantee Card */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200/70 shadow-sm space-y-2.5">
        <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs">
          <ShieldCheck size={16} className="text-emerald-600" />
          <span>Privacy Guaranteed</span>
        </div>
        <p className="text-[11px] text-gray-500 leading-relaxed">
          Your identity is protected across all anonymous whispers and community threads with end-to-end privacy controls.
        </p>
      </div>

      {/* Desktop Footer Links */}
      <footer className="pt-2 px-1 text-[11px] text-gray-400 space-y-2">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <Link href="/settings" className="hover:underline">Settings</Link>
          <Link href="/invite" className="hover:underline">Invite Friends</Link>
          <Link href="/communities" className="hover:underline">Communities</Link>
          <Link href="/settings" className="hover:underline">Privacy</Link>
        </div>
        <p className="text-[10px] font-mono text-gray-400">© 2026 Private Voices Inc.</p>
      </footer>
    </aside>
  )
}
