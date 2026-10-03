'use client'

import React, { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { X, Send, Loader2 } from 'lucide-react'
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
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      setMessages(data ?? [])
      setLoading(false)
      scrollToBottom()

      // Mark unread messages as read
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', currentUserId)
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
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
          scrollToBottom()

          // Mark newly received message as read if drawer is open
          if (payload.new.sender_id !== currentUserId) {
            supabase
              .from('messages')
              .update({ is_read: true })
              .eq('id', payload.new.id)
              .then(() => {})
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, conversationId, currentUserId])

  function scrollToBottom() {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 80)
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || sending) return

    const messageContent = text.trim()
    setText('')
    setSending(true)

    // Optimistic message
    const tempId = 'temp-' + Date.now()
    const optimisticMsg = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: messageContent,
      is_read: false,
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, optimisticMsg])
    scrollToBottom()

    try {
      const { data: newMsg, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: messageContent,
        })
        .select('*')
        .single()

      if (error) {
        console.error('Failed to send message:', error)
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        alert(`Failed to send message: ${error.message}`)
      } else if (newMsg) {
        // Replace temp message with confirmed message
        setMessages((prev) => prev.map((m) => (m.id === tempId ? newMsg : m)))

        // Update conversation last_message
        await supabase
          .from('conversations')
          .update({
            last_message: messageContent,
            last_message_at: new Date().toISOString(),
          })
          .eq('id', conversationId)
      }
    } catch (err) {
      console.error('Error sending message:', err)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {/* Backdrop for closing */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs md:bg-transparent"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-gray-200 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white/90 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-600 overflow-hidden border border-gray-100">
              {partner.avatarUrl ? (
                <Image
                  src={partner.avatarUrl}
                  alt={partner.displayName}
                  width={40}
                  height={40}
                  className="w-full h-full object-cover"
                />
              ) : (
                partner.displayName.charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-gray-900 truncate">{partner.displayName}</h3>
              <p className="text-xs text-gray-500 truncate">@{partner.username}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close chat"
          >
            <X size={20} />
          </button>
        </div>

        {/* Messages List */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-gray-50/70">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
              <Loader2 className="animate-spin text-brand-600" size={24} />
              <p className="text-xs">Loading messages…</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12 space-y-2">
              <div className="text-4xl mb-1">👋</div>
              <h4 className="font-bold text-sm text-gray-800">Say hello!</h4>
              <p className="text-xs text-gray-500 max-w-xs">
                Start your conversation with @{partner.username}. Messages are private and identity-verified.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === currentUserId
              const isTemp = msg.id.startsWith?.('temp-')

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-2xl text-xs leading-relaxed ${
                      isMe
                        ? 'bg-brand-600 text-white rounded-br-xs shadow-xs'
                        : 'bg-white text-gray-900 border border-gray-200/80 rounded-bl-xs shadow-xs'
                    } ${isTemp ? 'opacity-70' : ''}`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-gray-400 mt-1 px-1 flex items-center gap-1">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {isMe && !isTemp && (
                      <span className="text-brand-500 font-semibold">
                        {msg.is_read ? '✓✓' : '✓'}
                      </span>
                    )}
                  </span>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="p-3 border-t border-gray-100 bg-white flex gap-2 items-center">
          <input
            type="text"
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={sending}
            className="input-field text-xs py-2.5 px-3.5 flex-1 rounded-xl focus:border-brand-500"
            autoFocus
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="btn-primary text-xs py-2.5 px-4 rounded-xl flex items-center justify-center transition-all disabled:opacity-50"
          >
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </form>
      </div>
    </>
  )
}
