'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Trash2, Share2, Shield, Flag, Check, Copy } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import ChatDrawer from '@/components/messages/ChatDrawer'

export default function InboxPage(): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const [activeTab, setActiveTab] = useState<'whispers' | 'messages'>('whispers')
  const [whispers, setWhispers] = useState<any[]>([])
  const [conversations, setConversations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [activeConversation, setActiveConversation] = useState<any | null>(null)
  const [shareStatus, setShareStatus] = useState<{ [id: string]: 'copied' | 'shared' | 'error' | null }>({})

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentUserId(data.user.id)
      }
    })
  }, [supabase])

  const fetchInboxData = useCallback(async () => {
    if (!currentUserId) return
    setLoading(true)

    if (activeTab === 'whispers') {
      const { data } = await supabase
        .from('whispers')
        .select('*')
        .eq('recipient_id', currentUserId)
        .order('created_at', { ascending: false })

      setWhispers(data ?? [])
    } else {
      const { data } = await supabase
        .from('conversations')
        .select(`
          *,
          user_a:profiles!conversations_user_a_id_fkey(id, username, display_name, avatar_url),
          user_b:profiles!conversations_user_b_id_fkey(id, username, display_name, avatar_url)
        `)
        .or(`user_a_id.eq.${currentUserId},user_b_id.eq.${currentUserId}`)
        .order('last_message_at', { ascending: false })

      setConversations(data ?? [])
    }
    setLoading(false)
  }, [supabase, currentUserId, activeTab])

  useEffect(() => {
    fetchInboxData()
  }, [fetchInboxData])

  async function handleDeleteWhisper(whisperId: string) {
    if (!confirm('Delete this anonymous whisper?')) return
    const { error } = await supabase.from('whispers').delete().eq('id', whisperId)
    if (!error) {
      setWhispers((prev) => prev.filter((w) => w.id !== whisperId))
    }
  }

  async function handleShareWhisper(whisper: any) {
    const textToShare = `Anonymous Whisper:\n"${whisper.content}"\n\n— via Private Voices`

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Anonymous Whisper',
          text: textToShare,
        })
        setShareStatus((prev) => ({ ...prev, [whisper.id]: 'shared' }))
      } else {
        await navigator.clipboard.writeText(textToShare)
        setShareStatus((prev) => ({ ...prev, [whisper.id]: 'copied' }))
      }
    } catch {
      try {
        await navigator.clipboard.writeText(textToShare)
        setShareStatus((prev) => ({ ...prev, [whisper.id]: 'copied' }))
      } catch {
        setShareStatus((prev) => ({ ...prev, [whisper.id]: 'error' }))
      }
    }

    setTimeout(() => {
      setShareStatus((prev) => ({ ...prev, [whisper.id]: null }))
    }, 3000)
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Inbox</h1>
          <p className="text-xs text-gray-500">One-way anonymous Whispers & identity DMs</p>
        </div>
      </div>

      {/* Tab Filter */}
      <div className="flex border-b border-gray-200 bg-white rounded-xl p-1 gap-1">
        <button
          onClick={() => setActiveTab('whispers')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'whispers' ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <span>Anonymous Whispers</span>
          {whispers.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 text-white">
              {whispers.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('messages')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'messages' ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <span>Direct Messages</span>
        </button>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="card p-12 text-center text-gray-400">
          <p className="text-sm">Loading inbox...</p>
        </div>
      ) : activeTab === 'whispers' ? (
        whispers.length === 0 ? (
          <div className="card p-12 text-center space-y-3">
            <div className="text-5xl">🤫</div>
            <h3 className="font-bold text-gray-900">No Whispers Yet</h3>
            <p className="text-xs text-gray-500 max-w-xs mx-auto">
              Share your profile link to receive anonymous messages from friends and followers.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {whispers.map((whisper) => (
              <div key={whisper.id} className="card p-5 space-y-3 relative">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🤫</span>
                    <span className="text-xs font-bold text-brand-700">Anonymous Whisper</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{new Date(whisper.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                    <button
                      onClick={async () => {
                        const reason = prompt('Reason for reporting this whisper:')
                        if (reason !== null) {
                          const { error } = await supabase.from('reports').insert({
                            reporter_id: currentUserId,
                            target_id: whisper.id,
                            target_type: 'whisper',
                            reason: reason || 'Abusive anonymous whisper',
                          })
                          if (!error) alert('Whisper reported to moderators.')
                        }
                      }}
                      className="text-gray-400 hover:text-amber-600 p-1 transition-colors"
                      title="Report whisper"
                    >
                      <Flag size={15} />
                    </button>
                    <button
                      onClick={() => handleDeleteWhisper(whisper.id)}
                      className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                      title="Delete whisper"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <p className="text-sm text-gray-900 italic font-medium bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                  "{whisper.content}"
                </p>

                {/* One-Way Share Action & Inline Feedback */}
                <div className="pt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                    <Shield size={13} className="text-emerald-600" />
                    <span>Sender details completely hidden</span>
                  </div>

                  <button
                    onClick={() => handleShareWhisper(whisper)}
                    className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 transition-all"
                  >
                    {shareStatus[whisper.id] === 'copied' ? (
                      <>
                        <Copy size={13} className="text-emerald-600" />
                        <span className="text-emerald-700 font-bold">Link Copied!</span>
                      </>
                    ) : shareStatus[whisper.id] === 'shared' ? (
                      <>
                        <Check size={13} className="text-emerald-600" />
                        <span className="text-emerald-700 font-bold">Shared!</span>
                      </>
                    ) : shareStatus[whisper.id] === 'error' ? (
                      <span className="text-red-600 font-bold">Share Failed</span>
                    ) : (
                      <>
                        <Share2 size={13} />
                        <span>Share</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Direct Messages List */
        conversations.length === 0 ? (
          <div className="card p-12 text-center space-y-3">
            <div className="text-5xl">💬</div>
            <h3 className="font-bold text-gray-900">No Direct Conversations</h3>
            <p className="text-xs text-gray-500 max-w-xs mx-auto">
              Start an identity-based conversation with users from their public profiles.
            </p>
          </div>
        ) : (
          <div className="card divide-y divide-gray-100">
            {conversations.map((conv) => {
              const partner = conv.user_a.id === currentUserId ? conv.user_b : conv.user_a
              return (
                <div
                  key={conv.id}
                  onClick={() =>
                    setActiveConversation({
                      id: conv.id,
                      partner: {
                        id: partner.id,
                        username: partner.username,
                        displayName: partner.display_name,
                        avatarUrl: partner.avatar_url,
                      },
                    })
                  }
                  className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-600">
                      {partner.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">{partner.display_name}</h4>
                      <p className="text-xs text-gray-500 truncate max-w-xs">{conv.last_message || 'Tap to chat'}</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-gray-400">
                    {new Date(conv.last_message_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Active Chat Drawer */}
      {activeConversation && currentUserId && (
        <ChatDrawer
          conversationId={activeConversation.id}
          partner={activeConversation.partner}
          currentUserId={currentUserId}
          onClose={() => setActiveConversation(null)}
        />
      )}
    </div>
  )
}
