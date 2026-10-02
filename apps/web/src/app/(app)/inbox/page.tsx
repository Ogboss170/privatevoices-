'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { MessageSquare, Lock, Trash2, Send, CornerDownRight, Share2 } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function InboxPage(): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const [activeTab, setActiveTab] = useState<'whispers' | 'messages'>('whispers')
  const [whispers, setWhispers] = useState<any[]>([])
  const [conversations, setConversations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({})
  const [replyingId, setReplyingId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

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

  async function handleReplyWhisper(whisperId: string) {
    const text = replyText[whisperId]
    if (!text || !text.trim()) return

    setReplyingId(whisperId)
    const { error } = await supabase
      .from('whispers')
      .update({
        reply_content: text.trim(),
        replied_at: new Date().toISOString(),
      })
      .eq('id', whisperId)

    if (!error) {
      setWhispers((prev) =>
        prev.map((w) =>
          w.id === whisperId ? { ...w, reply_content: text.trim(), replied_at: new Date().toISOString() } : w
        )
      )
      setReplyText((prev) => ({ ...prev, [whisperId]: '' }))
    }
    setReplyingId(null)
  }

  async function handleDeleteWhisper(whisperId: string) {
    if (!confirm('Delete this anonymous whisper?')) return
    const { error } = await supabase.from('whispers').delete().eq('id', whisperId)
    if (!error) {
      setWhispers((prev) => prev.filter((w) => w.id !== whisperId))
    }
  }

  async function handleShareWhisperAsPost(whisper: any) {
    const postContent = `Anonymous Whisper:\n"${whisper.content}"\n\nReply: ${whisper.reply_content || ''}`
    const { error } = await supabase.from('posts').insert({
      author_id: currentUserId,
      content: postContent,
    })

    if (!error) {
      alert('Whisper shared to your public feed!')
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Inbox</h1>
          <p className="text-xs text-gray-500">Manage your private messages and anonymous Whispers</p>
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

                {/* Existing Reply */}
                {whisper.reply_content && (
                  <div className="flex gap-2 text-xs bg-brand-50 p-3 rounded-xl border border-brand-100">
                    <CornerDownRight size={16} className="text-brand-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="font-semibold text-brand-900">Your Reply:</span>
                      <p className="text-brand-800">{whisper.reply_content}</p>
                    </div>
                  </div>
                )}

                {/* Reply Form */}
                <div className="pt-2 flex items-center justify-between gap-2">
                  {!whisper.reply_content ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        handleReplyWhisper(whisper.id)
                      }}
                      className="flex-1 flex gap-2"
                    >
                      <input
                        type="text"
                        placeholder="Write a reply..."
                        value={replyText[whisper.id] || ''}
                        onChange={(e) => setReplyText({ ...replyText, [whisper.id]: e.target.value })}
                        className="input-field text-xs py-2 flex-1"
                      />
                      <button
                        type="submit"
                        disabled={replyingId === whisper.id || !replyText[whisper.id]?.trim()}
                        className="btn-primary text-xs py-2 px-3 flex items-center gap-1"
                      >
                        <Send size={12} />
                        <span>Reply</span>
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => handleShareWhisperAsPost(whisper)}
                      className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 ml-auto"
                    >
                      <Share2 size={13} />
                      <span>Share as Post</span>
                    </button>
                  )}
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
                <div key={conv.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-600">
                      {partner.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">{partner.display_name}</h4>
                      <p className="text-xs text-gray-500 truncate max-w-xs">{conv.last_message || 'Start chatting'}</p>
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
    </div>
  )
}
