'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

interface MentionAutocompleteProps {
  query: string
  visible: boolean
  onSelect: (username: string) => void
}

export default function MentionAutocomplete({
  query,
  visible,
  onSelect,
}: MentionAutocompleteProps): React.JSX.Element | null {
  const supabase = createSupabaseBrowserClient()
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!visible || !query) {
      setMatches([])
      return
    }

    let active = true

    async function searchUsers() {
      setLoading(true)
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .ilike('username', `${query}%`)
          .limit(5)

        if (active) {
          setMatches(data || [])
        }
      } catch (err) {
        console.error('Error searching mentions:', err)
      } finally {
        if (active) setLoading(false)
      }
    }

    const timer = setTimeout(searchUsers, 150)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [supabase, query, visible])

  if (!visible || (matches.length === 0 && !loading)) return null

  return (
    <div className="absolute bottom-full left-0 mb-1 w-64 bg-white border border-gray-200 rounded-xl shadow-xl p-1 z-30 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1">
        Mention user
      </div>
      {loading ? (
        <div className="p-2 text-xs text-gray-400 text-center">Searching…</div>
      ) : (
        matches.map((user) => (
          <button
            key={user.id}
            type="button"
            onClick={() => onSelect(user.username)}
            className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-brand-50 transition-colors text-left group"
          >
            <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center font-bold text-xs text-brand-600 overflow-hidden flex-shrink-0">
              {user.avatar_url ? (
                <Image
                  src={user.avatar_url}
                  alt={user.display_name}
                  width={28}
                  height={28}
                  className="w-full h-full object-cover"
                />
              ) : (
                (user.display_name || user.username).charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-900 truncate group-hover:text-brand-600">
                {user.display_name}
              </p>
              <p className="text-[11px] text-gray-500 truncate">@{user.username}</p>
            </div>
          </button>
        ))
      )}
    </div>
  )
}
