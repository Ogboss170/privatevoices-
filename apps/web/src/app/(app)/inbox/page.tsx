'use client'

import React, { useState, useEffect, useCallback, Suspense } from 'react'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { Trash2, Share2, Shield, Flag, Check, Copy, MessageCircle, Loader2 } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import ChatDrawer from '@/components/messages/ChatDrawer'

function InboxContent(): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const searchParams = useSearchParams()
  const queryConversationId = searchParams.get('c')

  const [activeTab, setActiveTab] = useState<'whispers' | 'messages'>(
    queryConversationId ? 'messages' : 'whispers'
  )
  const [whispers, setWhispers] = useState<any[]>([])
  const [conversations, setConversations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [activeConversation, setActiveConversation] = useState<any | null>(null)
  const [shareStatus, setShareStatus] = useState<{ [id: string]: 'copied' | 'shared' | 'error' | null }>({})
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})

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

    try {
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

        const convs = data ?? []
        setConversations(convs)

        // Count unread messages per conversation
        if (convs.length > 0) {
          const convIds = convs.map((c: any) => c.id)
          const { data: unreadMsgs } = await supabase
            .from('messages')
            .select('conversation_id')
            .in('conversation_id', convIds)
            .eq('is_read', false)
            .neq('sender_id', currentUserId)

          const counts: Record<string, number> = {}
          for (const m of unreadMsgs || []) {
            counts[m.conversation_id] = (counts[m.conversation_id] || 0) + 1
          }
          setUnreadCounts(counts)
        }

        // If URL has ?c=conversation_id, open it immediately
        if (queryConversationId && !activeConversation) {
          const matched = convs.find((c: any) => c.id === queryConversationId)
          if (matched) {
            const partner = matched.user_a.id === currentUserId ? matched.user_b : matched.user_a
            setActiveConversation({
              id: matched.id,
              partner: {
                id: partner.id,
                username: partner.username,
                displayName: partner.display_name,
                avatarUrl: partner.avatar_url,
              },
            })
          }
        }
      }
    } catch (err) {
      console.error('Error fetching inbox:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase, currentUserId, activeTab, queryConversationId, activeConversation])

  useEffect(() => {
    fetchInboxData()

    // Realtime listener for incoming messages to update conversation previews & unread badges
    const channel = supabase
      .channel('public:inbox_messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          // If a new message arrived in any of our conversations, update conversation list
          fetchInboxData()
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whispers' },
        (payload) => {
          if (payload.new?.recipient_id === currentUserId) {
            fetchInboxData()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchInboxData, supabase, currentUserId])

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

  const totalUnreadMessages = Object.values(unreadCounts).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Inbox</h1>
          <p className="text-xs text-gray-500">One-way anonymous Whispers & direct 1-on-1 chats</p>
        </div>
      </div>

      {/* Tab Filter */}
      <div className="flex border-b border-gray-200 bg-white rounded-xl p-1 gap-1 shadow-xs">
        <button
          onClick={() => setActiveTab('whispers')}
          className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === 'whispers'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <span>Anonymous Whispers</span>
          {whispers.length > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'whispers' ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              {whispers.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('messages')}
          className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === 'messages'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <span>Direct Messages</span>
          {totalUnreadMessages > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-red-500 text-white font-bold animate-pulse">
              {totalUnreadMessages}
            </span>
          )}
        </button>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="card p-12 text-center text-gray-400">
          <Loader2 size={24} className="animate-spin text-brand-600 mx-auto mb-2" />
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
              <div key={whisper.id} className="card p-5 space-y-3 relative hover:border-gray-300 transition-colors">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🤫</span>
                    <span className="text-xs font-bold text-brand-700">Anonymous Whisper</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>
                      {new Date(whisper.created_at).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
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
              Start an identity-verified chat with users directly from their profile pages.
            </p>
          </div>
        ) : (
          <div className="card divide-y divide-gray-100 overflow-hidden shadow-xs">
            {conversations.map((conv) => {
              const partner = conv.user_a?.id === currentUserId ? conv.user_b : conv.user_a
              if (!partner) return null

              const unread = unreadCounts[conv.id] || 0

              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    setActiveConversation({
                      id: conv.id,
                      partner: {
                        id: partner.id,
                        username: partner.username,
                        displayName: partner.display_name,
                        avatarUrl: partner.avatar_url,
                      },
                    })
                    // Clear unread badge locally
                    setUnreadCounts((prev) => ({ ...prev, [conv.id]: 0 }))
                  }}
                  className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-600 flex-shrink-0 overflow-hidden border border-gray-100">
                      {partner.avatar_url ? (
                        <Image
                          src={partner.avatar_url}
                          alt={partner.display_name}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        partner.display_name?.charAt(0)?.toUpperCase() || '?'
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-gray-900 truncate group-hover:text-brand-600 transition-colors">
                          {partner.display_name}
                        </h4>
                        <span className="text-xs text-gray-400">@{partner.username}</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate max-w-sm mt-0.5">
                        {conv.last_message || 'Tap to start chatting'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="text-[11px] text-gray-400">
                      {conv.last_message_at
                        ? new Date(conv.last_message_at).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          })
                        : ''}
                    </span>
                    {unread > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-brand-600 text-white font-bold">
                        {unread}
                      </span>
                    )}
                  </div>
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

export default function InboxPage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="card p-12 text-center text-gray-400 max-w-2xl mx-auto">
          <Loader2 size={24} className="animate-spin text-brand-600 mx-auto mb-2" />
          <p className="text-sm">Loading inbox...</p>
        </div>
      }
    >
      <InboxContent />
    </Suspense>
  )
}
