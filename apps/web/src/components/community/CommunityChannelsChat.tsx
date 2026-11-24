'use client'

import React, { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Hash,
  Volume2,
  Bell,
  Send,
  Plus,
  Smile,
  Paperclip,
  Trash2,
  Pin,
  Lock,
  MessageSquare,
  Sparkles,
  ChevronDown,
  X,
  Info,
  Shield,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import GuestAuthModal from '@/components/auth/GuestAuthModal'

interface Channel {
  id: string
  community_id: string
  name: string
  slug: string
  description?: string
  type: 'text' | 'announcement' | 'voice'
  is_default: boolean
}

interface ChannelMessage {
  id: string
  channel_id: string
  content: string
  sender_id: string
  created_at: string
  is_pinned?: boolean
  sender?: {
    id: string
    username: string
    display_name?: string
    avatar_url?: string
  }
}

interface CommunityChannelsChatProps {
  communityId: string
  currentUserId?: string | null
  userRole?: 'owner' | 'moderator' | 'vip' | 'contributor' | 'member' | null
  isMember?: boolean
}

export default function CommunityChannelsChat({
  communityId,
  currentUserId,
  userRole,
  isMember = false,
}: CommunityChannelsChatProps) {
  const supabase = createSupabaseBrowserClient()
  const [channels, setChannels] = useState<Channel[]>([])
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  const [messages, setMessages] = useState<ChannelMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [loadingChannels, setLoadingChannels] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)

  // Create Channel Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelDesc, setNewChannelDesc] = useState('')
  const [newChannelType, setNewChannelType] = useState<'text' | 'announcement'>('text')
  const [creatingChannel, setCreatingChannel] = useState(false)

  // Guest modal state
  const [guestAuthOpen, setGuestAuthOpen] = useState(false)
  const [guestModalDesc, setGuestModalDesc] = useState('')

  // Fytro AI Facilitator & Safety state
  const [fytroGeneratingStarter, setFytroGeneratingStarter] = useState(false)
  const [fytroSummarizing, setFytroSummarizing] = useState(false)
  const [fytroSummaryText, setFytroSummaryText] = useState<string | null>(null)
  const [fytroModerationAudit, setFytroModerationAudit] = useState<any | null>(null)
  const [showFytroModal, setShowFytroModal] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const canManageChannels = userRole === 'owner' || userRole === 'moderator'

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // 1. Fetch Channels
  useEffect(() => {
    async function loadChannels() {
      setLoadingChannels(true)
      const { data, error } = await supabase
        .from('community_channels')
        .select('*')
        .eq('community_id', communityId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true })

      if (data && data.length > 0) {
        setChannels(data)
        setActiveChannel(data[0])
      } else {
        // Fallback demo/default channels if table not yet seeded
        const defaultChannels: Channel[] = [
          {
            id: 'fallback-general',
            community_id: communityId,
            name: 'general',
            slug: 'general',
            description: 'General discussions and welcome chat',
            type: 'text',
            is_default: true,
          },
          {
            id: 'fallback-announcements',
            community_id: communityId,
            name: 'announcements',
            slug: 'announcements',
            description: 'Official community announcements',
            type: 'announcement',
            is_default: false,
          },
          {
            id: 'fallback-venting',
            community_id: communityId,
            name: 'venting',
            slug: 'venting',
            description: 'A judgment-free space to let it out',
            type: 'text',
            is_default: false,
          },
        ]
        setChannels(defaultChannels)
        setActiveChannel(defaultChannels[0])
      }
      setLoadingChannels(false)
    }

    loadChannels()
  }, [communityId, supabase])

  // 2. Fetch Messages for Active Channel & Subscribe to Realtime
  useEffect(() => {
    if (!activeChannel) return

    let isSubscribed = true
    setLoadingMessages(true)

    const channelId = activeChannel.id
    async function loadMessages() {
      const { data } = await supabase
        .from('community_channel_messages')
        .select('*, sender:profiles!community_channel_messages_sender_id_fkey(id, username, display_name, avatar_url)')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })
        .limit(100)

      if (isSubscribed) {
        setMessages(data || [])
        setLoadingMessages(false)
        setTimeout(scrollToBottom, 100)
      }
    }

    loadMessages()

    // Realtime channel listener
    const channelSub = supabase
      .channel(`comm-channel:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'community_channel_messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          // Fetch sender details
          const { data: sender } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url')
            .eq('id', payload.new.sender_id)
            .maybeSingle()

          const newMsg: ChannelMessage = {
            ...payload.new,
            sender: sender || undefined,
          } as ChannelMessage

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
          setTimeout(scrollToBottom, 50)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'community_channel_messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => {
      isSubscribed = false
      supabase.removeChannel(channelSub)
    }
  }, [activeChannel, supabase])

  // 3. Send Message
  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!inputText.trim() || !activeChannel) return

    if (!currentUserId) {
      setGuestModalDesc('Sign in or create an account to chat with members in this channel.')
      setGuestAuthOpen(true)
      return
    }

    if (!isMember && userRole !== 'owner') {
      alert('You must be a member of this community to send messages.')
      return
    }

    if (activeChannel.type === 'announcement' && !canManageChannels) {
      alert('Only owners and moderators can post in the #announcements channel.')
      return
    }

    setSending(true)
    const textToSend = inputText.trim()
    setInputText('')

    try {
      const { error } = await supabase.from('community_channel_messages').insert({
        channel_id: activeChannel.id,
        community_id: communityId,
        sender_id: currentUserId,
        content: textToSend,
      })

      if (error) {
        console.error('Error sending channel message:', error)
        // Fallback local echo if table is being created
        const fakeMsg: ChannelMessage = {
          id: `local-${Date.now()}`,
          channel_id: activeChannel.id,
          content: textToSend,
          sender_id: currentUserId,
          created_at: new Date().toISOString(),
          sender: {
            id: currentUserId,
            username: 'You',
          },
        }
        setMessages((prev) => [...prev, fakeMsg])
        setTimeout(scrollToBottom, 50)
      }
    } finally {
      setSending(false)
    }
  }

  // 4. Create Sub-Channel
  async function handleCreateChannel(e: React.FormEvent) {
    e.preventDefault()
    if (!newChannelName.trim()) return

    const slug = newChannelName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
    setCreatingChannel(true)

    try {
      const { data, error } = await supabase
        .from('community_channels')
        .insert({
          community_id: communityId,
          name: newChannelName.trim().toLowerCase(),
          slug,
          description: newChannelDesc.trim() || null,
          type: newChannelType,
          created_by: currentUserId,
        })
        .select()
        .single()

      if (error) {
        alert(`Failed to create channel: ${error.message}`)
      } else if (data) {
        setChannels((prev) => [...prev, data])
        setActiveChannel(data)
        setShowCreateModal(false)
        setNewChannelName('')
        setNewChannelDesc('')
      }
    } finally {
      setCreatingChannel(false)
    }
  }

  // 5. Fytro AI Facilitator & Safety Actions
  async function handleFytroSparkDiscussion() {
    if (!activeChannel) return
    setFytroGeneratingStarter(true)
    try {
      const res = await fetch('/api/community/fytro-moderator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_starter',
          communityId,
          channelName: activeChannel.name,
        }),
      })
      const data = await res.json()
      if (data.starterTitle) {
        setInputText(`💡 Discussion Starter: ${data.starterTitle}\n${data.starterDescription || ''}`)
      }
    } catch (err) {
      console.error('Fytro starter error:', err)
    } finally {
      setFytroGeneratingStarter(false)
    }
  }

  async function handleFytroSummarizeRoom() {
    if (!messages.length) {
      alert('Not enough messages yet to summarize.')
      return
    }
    setFytroSummarizing(true)
    try {
      const recentChat = messages
        .slice(-20)
        .map((m) => `${m.sender?.username || 'Member'}: ${m.content}`)
        .join('\n')

      const res = await fetch('/api/community/fytro-moderator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'summarize_room',
          communityId,
          channelName: activeChannel?.name,
          content: recentChat,
        }),
      })
      const data = await res.json()
      setFytroSummaryText(data.summary || 'No summary available.')
      setShowFytroModal(true)
    } catch (err) {
      console.error('Fytro summarize error:', err)
    } finally {
      setFytroSummarizing(false)
    }
  }

  async function handleFytroAuditMessage(contentToAudit: string) {
    try {
      const res = await fetch('/api/community/fytro-moderator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'moderate_content',
          communityId,
          channelName: activeChannel?.name,
          content: contentToAudit,
        }),
      })
      const data = await res.json()
      setFytroModerationAudit(data)
      setShowFytroModal(true)
    } catch (err) {
      console.error('Fytro audit error:', err)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col md:flex-row h-[650px]">
      {/* Channels Sidebar */}
      <div className="w-full md:w-64 bg-gray-50/70 dark:bg-slate-900/60 border-r border-gray-100 dark:border-slate-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-brand-600" />
            <h4 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase tracking-wider">
              Chat Rooms
            </h4>
          </div>
          {canManageChannels && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="p-1.5 text-gray-400 hover:text-brand-600 dark:hover:text-white rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors"
              title="Create Channel"
            >
              <Plus size={16} />
            </button>
          )}
        </div>

        {/* Channel List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingChannels ? (
            <div className="p-4 text-center text-xs text-gray-400">Loading rooms...</div>
          ) : (
            channels.map((channel) => {
              const isActive = activeChannel?.id === channel.id
              return (
                <button
                  key={channel.id}
                  onClick={() => setActiveChannel(channel)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/60 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    {channel.type === 'announcement' ? (
                      <Bell size={15} className={isActive ? 'text-white' : 'text-amber-500'} />
                    ) : (
                      <Hash size={15} className={isActive ? 'text-white' : 'text-gray-400'} />
                    )}
                    <span className="truncate">{channel.name}</span>
                  </div>
                  {channel.type === 'announcement' && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        isActive ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      }`}
                    >
                      Read-only
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>

        {/* Member Status Footer */}
        <div className="p-3 border-t border-gray-100 dark:border-slate-800 text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isMember ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            <span>{isMember ? 'Joined Member' : 'Visitor Mode'}</span>
          </div>
          {userRole && <span className="capitalize font-bold text-brand-600">{userRole}</span>}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-950">
        {/* Active Channel Header */}
        <div className="px-6 py-3.5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hash size={20} className="text-gray-400 dark:text-gray-500" />
            <div>
              <h3 className="font-extrabold text-base text-gray-900 dark:text-white leading-tight">
                {activeChannel?.name || 'general'}
              </h3>
              {activeChannel?.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {activeChannel.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Fytro AI Community Moderator & Facilitator Toolbar */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleFytroSparkDiscussion}
                disabled={fytroGeneratingStarter}
                className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1 transition-all"
                title="Spark discussion with Fytro AI"
              >
                <Sparkles size={12} className={fytroGeneratingStarter ? 'animate-spin' : 'text-purple-600'} />
                <span>{fytroGeneratingStarter ? 'Sparking...' : 'Fytro Spark'}</span>
              </button>

              <button
                onClick={handleFytroSummarizeRoom}
                disabled={fytroSummarizing}
                className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-slate-800 dark:text-gray-300 flex items-center gap-1 transition-all"
                title="Summarize recent room messages"
              >
                <Info size={12} />
                <span>Recap</span>
              </button>
            </div>

            <div className="h-4 w-px bg-gray-200 dark:bg-slate-800 mx-1" />

            <div className="flex items-center gap-1 text-xs text-gray-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden sm:inline">Live Room</span>
            </div>
          </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {loadingMessages ? (
            <div className="h-full flex items-center justify-center text-xs text-gray-400">
              Loading conversation...
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-400 mb-2">
                <Hash size={24} />
              </div>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                Welcome to #{activeChannel?.name || 'general'}!
              </p>
              <p className="text-xs max-w-sm">
                This is the start of the #{activeChannel?.name} channel. Be the first to start the discussion!
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === currentUserId
              return (
                <div key={msg.id} className="flex items-start gap-3 group">
                  <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-slate-800 flex items-center justify-center text-brand-700 dark:text-brand-300 font-bold text-xs shrink-0 overflow-hidden ring-1 ring-gray-200 dark:ring-slate-700">
                    {msg.sender?.avatar_url ? (
                      <Image
                        src={msg.sender.avatar_url}
                        alt="Avatar"
                        width={36}
                        height={36}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      (msg.sender?.username?.[0] || 'U').toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-xs text-gray-900 dark:text-white">
                        {msg.sender?.display_name || msg.sender?.username || 'Member'}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="p-3 rounded-2xl rounded-tl-sm bg-gray-100/80 dark:bg-slate-800/80 text-gray-900 dark:text-gray-100 text-sm leading-relaxed max-w-2xl break-words inline-block">
                        {msg.content}
                      </div>
                      {canManageChannels && (
                        <button
                          onClick={() => handleFytroAuditMessage(msg.content)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-gray-400 hover:text-purple-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
                          title="Fytro Compliance Audit"
                        >
                          <Shield size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Box */}
        <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/40">
          {activeChannel?.type === 'announcement' && !canManageChannels ? (
            <div className="p-3 text-center text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-900">
              Only community moderators and owners can send updates to #{activeChannel.name}.
            </div>
          ) : (
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  currentUserId
                    ? isMember || userRole === 'owner'
                      ? `Message #${activeChannel?.name || 'channel'}...`
                      : 'Join this community to chat...'
                    : 'Sign in to join the discussion...'
                }
                className="flex-1 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white rounded-full px-4 py-3 outline-none ring-1 ring-gray-200 dark:ring-slate-700 focus:ring-brand-500 transition-all"
              />
              <button
                type="submit"
                disabled={sending || !inputText.trim()}
                className="p-3 rounded-full bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white shadow-md transition-all shrink-0"
              >
                <Send size={16} />
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Create Channel Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-gray-100 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-lg text-gray-900 dark:text-white">
                Create Chat Room
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-full"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateChannel} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Channel Name
                </label>
                <div className="relative">
                  <Hash size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    placeholder="e.g. venting, introductions"
                    className="w-full bg-gray-50 dark:bg-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-slate-700 focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  placeholder="What is this channel for?"
                  className="w-full bg-gray-50 dark:bg-slate-800 rounded-2xl px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-slate-700 focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Channel Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewChannelType('text')}
                    className={`p-3 rounded-2xl text-left border transition-all ${
                      newChannelType === 'text'
                        ? 'border-brand-600 bg-brand-50/50 dark:bg-brand-950/20'
                        : 'border-gray-200 dark:border-slate-800'
                    }`}
                  >
                    <p className="text-xs font-bold text-gray-900 dark:text-white"># Text Chat</p>
                    <p className="text-[11px] text-gray-500">All members can post</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewChannelType('announcement')}
                    className={`p-3 rounded-2xl text-left border transition-all ${
                      newChannelType === 'announcement'
                        ? 'border-brand-600 bg-brand-50/50 dark:bg-brand-950/20'
                        : 'border-gray-200 dark:border-slate-800'
                    }`}
                  >
                    <p className="text-xs font-bold text-gray-900 dark:text-white">📢 Announcement</p>
                    <p className="text-[11px] text-gray-500">Only mods can post</p>
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-full text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingChannel || !newChannelName.trim()}
                  className="px-5 py-2 rounded-full text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-sm disabled:opacity-50"
                >
                  {creatingChannel ? 'Creating...' : 'Create Channel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fytro AI Facilitator & Safety Intelligence Modal */}
      {showFytroModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-lg w-full border border-gray-100 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 flex items-center justify-center">
                  <Sparkles size={18} />
                </div>
                <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                  Fytro Community Intelligence
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowFytroModal(false)
                  setFytroSummaryText(null)
                  setFytroModerationAudit(null)
                }}
                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-full"
              >
                <X size={18} />
              </button>
            </div>

            {fytroSummaryText && (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 text-sm leading-relaxed text-gray-800 dark:text-gray-200">
                  <p className="font-bold text-xs text-purple-700 dark:text-purple-300 uppercase mb-1">
                    Room Discussion Recap
                  </p>
                  {fytroSummaryText}
                </div>
              </div>
            )}

            {fytroModerationAudit && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700">
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Compliance Status:</span>
                  <span
                    className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${
                      fytroModerationAudit.compliant
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                    }`}
                  >
                    {fytroModerationAudit.compliant ? '✓ Compliant' : '⚠ Flagged for Violation'}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-800/80 border border-gray-100 dark:border-slate-700 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Risk Assessment:</span>
                    <span className="font-bold text-gray-900 dark:text-white">{fytroModerationAudit.riskLevel || 'Low'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Suggested Action:</span>
                    <span className="font-bold text-purple-600">{fytroModerationAudit.recommendedAction || 'Approve'}</span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 pt-1 border-t border-gray-200 dark:border-slate-700">
                    {fytroModerationAudit.reason}
                  </p>
                  {fytroModerationAudit.guidanceForAuthor && (
                    <p className="text-[11px] text-gray-500 italic">
                      Author Guidance: &ldquo;{fytroModerationAudit.guidanceForAuthor}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  setShowFytroModal(false)
                  setFytroSummaryText(null)
                  setFytroModerationAudit(null)
                }}
                className="px-5 py-2 rounded-full text-xs font-bold bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:opacity-90"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guest Auth Prompt */}
      <GuestAuthModal
        isOpen={guestAuthOpen}
        onClose={() => setGuestAuthOpen(false)}
        actionTitle="Join the Discussion"
        actionDescription={guestModalDesc}
      />
    </div>
  )
}
