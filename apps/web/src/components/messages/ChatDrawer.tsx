'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, Send } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

interface ChatDrawerProps {
  conversationId: string
  partner: {
    id: string
    username: string
    displayName: string
    avatarUrl: string | null
  }
  currentUserId: string
  onClose: () => void
}

export default function ChatDrawer({
  conversationId,
  partner,
  currentUserId,
  onClose,
}: ChatDrawerProps): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const [messages, setMessages] = useState<any[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadMessages() {
      setLoading(true)
      const { data } = await supabase
        .from('messages')
        .select('*, sender:profiles(id, username, display_name, avatar_url)')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      setMessages(data ?? [])
      setLoading(false)
      scrollToBottom()
    }

    loadMessages()

    // Subscribe to realtime messages
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new])
          scrollToBottom()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, conversationId])

  function scrollToBottom() {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return

    setSending(true)
    const messageContent = text.trim()
    setText('')

    const { data: newMsg, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        content: messageContent,
      })
      .select('*, sender:profiles(id, username, display_name, avatar_url)')
      .single()

    if (!error && newMsg) {
      // Update last message in conversation
      await supabase
        .from('conversations')
        .update({
          last_message: messageContent,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', conversationId)

      setMessages((prev) => (prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]))
      scrollToBottom()
    }
    setSending(false)
  }

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-600">
            {partner.displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-bold text-sm text-gray-900">{partner.displayName}</h3>
            <p className="text-xs text-gray-500">@{partner.username}</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Messages List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-gray-50">
        {loading ? (
          <p className="text-xs text-gray-400 text-center py-6">Loading messages…</p>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <div className="text-3xl">👋</div>
            <p className="text-xs text-gray-500">Say hello to @{partner.username}!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === currentUserId
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-2xl text-xs ${
                    isMe
                      ? 'bg-brand-600 text-white rounded-br-none'
                      : 'bg-white text-gray-900 border border-gray-200 rounded-bl-none shadow-sm'
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-gray-400 mt-1 px-1">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <form onSubmit={handleSend} className="p-3 border-t border-gray-200 bg-white flex gap-2">
        <input
          type="text"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="input-field text-xs py-2 flex-1 rounded-xl"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="btn-primary text-xs py-2 px-3 rounded-xl flex items-center justify-center"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  )
}
