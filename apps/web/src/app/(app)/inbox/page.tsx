'use client'

import React, { useState, useEffect, useCallback, Suspense } from 'react'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { Trash2, Share2, Shield, Flag, Check, Copy, MessageCircle, Loader2, UserPlus, Search, X, Users, Plus } from 'lucide-react'
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

  // Inbox Conversations Search state
  const [inboxSearchQuery, setInboxSearchQuery] = useState('')
  const [isSearchActive, setIsSearchActive] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const searchInputRef = React.useRef<HTMLInputElement | null>(null)

  // New Chat Modal state
  const [showNewChatModal, setShowNewChatModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)

  // New Group Chat Modal state
  const [showNewGroupModal, setShowNewGroupModal] = useState(false)
  const [newGroupTitle, setNewGroupTitle] = useState('')
  const [selectedGroupUsers, setSelectedGroupUsers] = useState<any[]>([])
  const [creatingGroup, setCreatingGroup] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentUserId(data.user.id)
      }
    })
  }, [supabase])

  // Focus search input when search mode is opened
  useEffect(() => {
    if (isSearchActive) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    }
  }, [isSearchActive])

  // Handle typing in inbox search with debounce simulation for searching indicator
  const handleInboxSearchChange = (query: string) => {
    setInboxSearchQuery(query)
    setSearchError(null)
    if (query.trim()) {
      setSearchLoading(true)
      const timer = setTimeout(() => {
        setSearchLoading(false)
      }, 150)
      return () => clearTimeout(timer)
    } else {
      setSearchLoading(false)
    }
  }

  const handleClearInboxSearch = () => {
    setInboxSearchQuery('')
    setSearchLoading(false)
    setSearchError(null)
    searchInputRef.current?.focus()
  }

  const handleCloseInboxSearch = () => {
    setIsSearchActive(false)
    setInboxSearchQuery('')
    setSearchLoading(false)
    setSearchError(null)
  }

  const handleSearchUsers = async (query: string) => {
    setSearchQuery(query)
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .neq('id', currentUserId || '')
        .or(`username.ilike.%${query.trim()}%,display_name.ilike.%${query.trim()}%`)
        .limit(10)

      if (!error && data) {
        setSearchResults(data)
      }
    } catch (err) {
      console.error('Error searching users for chat:', err)
    } finally {
      setSearching(false)
    }
  }

  const handleToggleSelectGroupUser = (user: any) => {
    setSelectedGroupUsers((prev) => {
      const exists = prev.some((u) => u.id === user.id)
      if (exists) {
        return prev.filter((u) => u.id !== user.id)
      } else {
        return [...prev, user]
      }
    })
  }

  const handleCreateGroup = async () => {
    if (!currentUserId || !newGroupTitle.trim() || selectedGroupUsers.length === 0) return
    setCreatingGroup(true)
    try {
      const memberIds = [currentUserId, ...selectedGroupUsers.map((u) => u.id)]
      
      // Try RPC first
      const { data: convId, error: rpcErr } = await supabase.rpc('create_group_conversation', {
        p_title: newGroupTitle.trim(),
        p_member_ids: memberIds,
      })

      let finalConvId = convId

      if (rpcErr || !finalConvId) {
        // Fallback: direct insert
        const { data: newConv, error: convErr } = await supabase
          .from('conversations')
          .insert({
            is_group: true,
            title: newGroupTitle.trim(),
            created_by: currentUserId,
            last_message: 'Group created',
            last_message_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (convErr || !newConv) {
          throw convErr || new Error('Failed to create group conversation')
        }

        finalConvId = newConv.id

        // Add creator as admin
        await supabase.from('conversation_members').insert({
          conversation_id: finalConvId,
          user_id: currentUserId,
          role: 'admin',
        })

        // Add members
        const memberRows = selectedGroupUsers.map((u) => ({
          conversation_id: finalConvId,
          user_id: u.id,
          role: 'member',
        }))
        await supabase.from('conversation_members').insert(memberRows)
      }

      // Close modal and reset state
      setShowNewGroupModal(false)
      const groupName = newGroupTitle.trim()
      setNewGroupTitle('')
      setSelectedGroupUsers([])
      setSearchQuery('')
      setSearchResults([])

      // Open new group chat drawer
      setActiveConversation({
        id: finalConvId,
        isGroup: true,
        title: groupName,
        partner: {
          id: 'group',
          username: 'group',
          displayName: groupName,
          avatarUrl: null,
        },
      })

      fetchInboxData()
    } catch (err: any) {
      console.error('Error creating group chat:', err)
      alert(err.message || 'Could not create group')
    } finally {
      setCreatingGroup(false)
    }
  }

  const handleStartNewChat = async (targetUser: any) => {
    if (!currentUserId) return
    setShowNewChatModal(false)
    setSearchQuery('')
    setSearchResults([])

    // Check if conversation already exists between currentUserId and targetUser.id
    const userA = currentUserId < targetUser.id ? currentUserId : targetUser.id
    const userB = currentUserId < targetUser.id ? targetUser.id : currentUserId

    const { data: existingConv } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_a_id', userA)
      .eq('user_b_id', userB)
      .single()

    if (existingConv) {
      setActiveConversation({
        id: existingConv.id,
        partner: {
          id: targetUser.id,
          username: targetUser.username,
          displayName: targetUser.display_name,
          avatarUrl: targetUser.avatar_url,
        },
      })
    } else {
      const { data: newConv, error } = await supabase
        .from('conversations')
        .insert({
          user_a_id: userA,
          user_b_id: userB,
          last_message: 'Started a new conversation',
          last_message_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (!error && newConv) {
        setActiveConversation({
          id: newConv.id,
          partner: {
            id: targetUser.id,
            username: targetUser.username,
            displayName: targetUser.display_name,
            avatarUrl: targetUser.avatar_url,
          },
        })
        fetchInboxData()
      }
    }
  }

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
        // 1. Fetch conversations where user is user_a or user_b (1-on-1)
        const { data: directData } = await supabase
          .from('conversations')
          .select(`
            *,
            user_a:profiles!conversations_user_a_id_fkey(id, username, display_name, avatar_url),
            user_b:profiles!conversations_user_b_id_fkey(id, username, display_name, avatar_url)
          `)
          .or(`user_a_id.eq.${currentUserId},user_b_id.eq.${currentUserId}`)
          .order('last_message_at', { ascending: false })

        // 2. Fetch group conversations user is a member of
        let groupConvs: any[] = []
        try {
          const { data: memberRows } = await supabase
            .from('conversation_members')
            .select('conversation_id')
            .eq('user_id', currentUserId)

          if (memberRows && memberRows.length > 0) {
            const groupIds = memberRows.map((r: any) => r.conversation_id)
            const { data: groupData } = await supabase
              .from('conversations')
              .select('*')
              .in('id', groupIds)
              .eq('is_group', true)
              .order('last_message_at', { ascending: false })

            groupConvs = groupData || []
          }
        } catch (groupErr) {
          console.warn('Group conversations query notice:', groupErr)
        }

        // Merge and sort all conversations
        const directList = (directData ?? []).filter((c: any) => !c.is_group)
        const convs = [...groupConvs, ...directList].sort(
          (a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
        )
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

  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchInboxData()

    if (!currentUserId) return

    // Presence channel for online badges across conversation list
    const presenceChannel = supabase.channel('online_presence', {
      config: { presence: { key: currentUserId } },
    })

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState()
        const onlineSet = new Set<string>()
        Object.values(state).forEach((presences: any) => {
          presences.forEach((p: any) => {
            if (p.user_id) onlineSet.add(p.user_id)
          })
        })
        setOnlineUsers(onlineSet)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ user_id: currentUserId, online: true })
        }
      })

    // Realtime listener for incoming messages to update conversation previews & unread badges
    const channel = supabase
      .channel('public:inbox_messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => {
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
      supabase.removeChannel(presenceChannel)
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
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          {!isSearchActive ? (
            <>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Inbox</h1>
                <p className="text-xs text-gray-500">One-way anonymous Whispers & direct 1-on-1 chats</p>
              </div>
              <div className="flex items-center gap-2">
                {activeTab === 'messages' && (
                  <>
                    <button
                      onClick={() => setIsSearchActive(true)}
                      className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 shadow-xs hover:border-brand-300 hover:text-brand-700 transition-all"
                      aria-label="Search conversations or people"
                      title="Search conversations"
                    >
                      <Search size={14} className="text-gray-500" />
                      <span className="hidden sm:inline">Search</span>
                    </button>
                    <button
                      onClick={() => setShowNewGroupModal(true)}
                      className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 shadow-xs"
                      aria-label="Create group chat"
                    >
                      <Users size={14} className="text-brand-600" />
                      <span>New Group</span>
                    </button>
                    <button
                      onClick={() => setShowNewChatModal(true)}
                      className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5 shadow-sm"
                      aria-label="Start new chat"
                    >
                      <UserPlus size={14} />
                      <span>New Chat</span>
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="w-full flex items-center gap-2 animate-in fade-in duration-150">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={inboxSearchQuery}
                  onChange={(e) => handleInboxSearchChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      handleCloseInboxSearch()
                    }
                  }}
                  placeholder="Search conversations or people..."
                  aria-label="Search conversations or people"
                  className="w-full pl-10 pr-9 py-2 text-sm bg-white border border-brand-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 shadow-xs text-gray-900 placeholder-gray-400"
                />
                {inboxSearchQuery ? (
                  <button
                    onClick={handleClearInboxSearch}
                    aria-label="Clear search input"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <X size={15} />
                  </button>
                ) : searchLoading ? (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 size={15} className="animate-spin text-brand-600" />
                  </div>
                ) : null}
              </div>
              <button
                onClick={handleCloseInboxSearch}
                aria-label="Close search"
                className="btn-secondary text-xs py-2 px-3 text-gray-600 hover:text-gray-900 whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          )}
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
        /* Direct & Group Messages List */
        (() => {
          const cleanQuery = inboxSearchQuery.trim().toLowerCase().replace(/^@/, '')
          const filteredConversations = cleanQuery
            ? conversations.filter((conv) => {
                if (conv.is_group) {
                  return (conv.title || 'Group Chat').toLowerCase().includes(cleanQuery)
                }
                const partner = conv.user_a?.id === currentUserId ? conv.user_b : conv.user_a
                if (!partner) return false
                const name = (partner.display_name || '').toLowerCase()
                const username = (partner.username || '').toLowerCase()
                return name.includes(cleanQuery) || username.includes(cleanQuery)
              })
            : conversations

          if (conversations.length === 0) {
            return (
              <div className="card p-12 text-center space-y-3">
                <div className="text-5xl">💬</div>
                <h3 className="font-bold text-gray-900">No Conversations Yet</h3>
                <p className="text-xs text-gray-500 max-w-xs mx-auto">
                  Start an identity-verified chat with users directly or create a group chat.
                </p>
                <div className="pt-2 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setShowNewGroupModal(true)}
                    className="btn-secondary text-xs py-2 px-3.5 inline-flex items-center gap-1.5 shadow-xs"
                  >
                    <Users size={14} className="text-brand-600" />
                    <span>Create Group</span>
                  </button>
                  <button
                    onClick={() => setShowNewChatModal(true)}
                    className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <UserPlus size={14} />
                    <span>Start New Chat</span>
                  </button>
                </div>
              </div>
            )
          }

          if (searchError) {
            return (
              <div className="card p-8 text-center space-y-3 border-red-100 bg-red-50/30">
                <p className="text-sm text-red-600 font-medium">{searchError}</p>
                <button
                  onClick={() => {
                    setSearchError(null)
                    handleInboxSearchChange(inboxSearchQuery)
                  }}
                  className="btn-secondary text-xs py-1.5 px-3 mx-auto"
                >
                  Retry Search
                </button>
              </div>
            )
          }

          if (cleanQuery && filteredConversations.length === 0) {
            return (
              <div className="card p-12 text-center space-y-3">
                <div className="text-4xl text-gray-400">🔍</div>
                <h3 className="font-bold text-gray-900">No conversations found</h3>
                <p className="text-xs text-gray-500 max-w-xs mx-auto">
                  We couldn't find any chats matching &ldquo;{inboxSearchQuery}&rdquo;. Check the spelling or start a new chat with them.
                </p>
                <div className="pt-2 flex items-center justify-center gap-2">
                  <button
                    onClick={handleClearInboxSearch}
                    className="btn-secondary text-xs py-1.5 px-3"
                  >
                    Clear Search
                  </button>
                  <button
                    onClick={() => {
                      setShowNewChatModal(true)
                      setSearchQuery(inboxSearchQuery)
                      handleSearchUsers(inboxSearchQuery)
                    }}
                    className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-sm"
                  >
                    <UserPlus size={13} />
                    <span>Search People</span>
                  </button>
                </div>
              </div>
            )
          }

          return (
            <div className="card divide-y divide-gray-100 overflow-hidden shadow-xs">
              {filteredConversations.map((conv) => {
                const isGroup = !!conv.is_group
                const partner = !isGroup
                  ? conv.user_a?.id === currentUserId
                    ? conv.user_b
                    : conv.user_a
                  : null

                if (!isGroup && !partner) return null

                const unread = unreadCounts[conv.id] || 0
                const isOnline = partner ? onlineUsers.has(partner.id) : false

                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      if (isGroup) {
                        setActiveConversation({
                          id: conv.id,
                          isGroup: true,
                          title: conv.title || 'Group Chat',
                          partner: {
                            id: 'group',
                            username: 'group',
                            displayName: conv.title || 'Group Chat',
                            avatarUrl: conv.avatar_url || null,
                          },
                        })
                      } else {
                        setActiveConversation({
                          id: conv.id,
                          isGroup: false,
                          partner: {
                            id: partner.id,
                            username: partner.username,
                            displayName: partner.display_name,
                            avatarUrl: partner.avatar_url,
                          },
                        })
                      }
                      // Clear unread badge locally
                      setUnreadCounts((prev) => ({ ...prev, [conv.id]: 0 }))
                    }}
                    className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative">
                        {isGroup ? (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white font-bold flex-shrink-0 shadow-xs">
                            <Users size={20} />
                          </div>
                        ) : (
                          <>
                            <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-600 flex-shrink-0 overflow-hidden border border-gray-100">
                              {partner.avatar_url ? (
                                <Image
                                  src={partner.avatar_url}
                                  alt={partner.display_name || partner.username || 'User'}
                                  width={48}
                                  height={48}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                partner.display_name?.charAt(0)?.toUpperCase() || '?'
                              )}
                            </div>
                            {isOnline && (
                              <span
                                className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-xs"
                                title="Active now"
                              />
                            )}
                          </>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-gray-900 truncate group-hover:text-brand-600 transition-colors">
                            {isGroup ? conv.title || 'Group Chat' : partner.display_name}
                          </h4>
                          {isGroup ? (
                            <span className="text-[10px] font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                              Group
                            </span>
                          ) : (
                            <>
                              <span className="text-xs text-gray-400">@{partner.username}</span>
                              {isOnline && (
                                <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded-full">
                                  Online
                                </span>
                              )}
                            </>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate max-w-sm mt-0.5">
                          {conv.last_message || (isGroup ? 'Tap to view group' : 'Tap to start chatting')}
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
        })()
      )}

      {/* Active Chat Drawer */}
      {activeConversation && currentUserId && (
        <ChatDrawer
          conversationId={activeConversation.id}
          partner={activeConversation.partner}
          isGroup={activeConversation.isGroup}
          groupTitle={activeConversation.title}
          currentUserId={currentUserId}
          onClose={() => setActiveConversation(null)}
        />
      )}

      {/* New Chat User Search Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <UserPlus size={18} className="text-brand-600" />
                <span>Start a New Chat</span>
              </h3>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative">
              <Search size={16} className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search by username or name..."
                value={searchQuery}
                onChange={(e) => handleSearchUsers(e.target.value)}
                autoFocus
                className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all"
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1 divide-y divide-gray-50">
              {searching ? (
                <div className="py-8 text-center text-gray-400">
                  <Loader2 size={20} className="animate-spin text-brand-600 mx-auto mb-1" />
                  <span className="text-xs">Searching users...</span>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-xs">
                  {searchQuery.trim()
                    ? 'No users found matching query.'
                    : 'Type a username or display name to search.'}
                </div>
              ) : (
                searchResults.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => handleStartNewChat(user)}
                    className="p-3 flex items-center justify-between hover:bg-brand-50/50 rounded-xl transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-600 overflow-hidden">
                        {user.avatar_url ? (
                          <Image
                            src={user.avatar_url}
                            alt={user.display_name || user.username}
                            width={40}
                            height={40}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          (user.display_name || user.username).charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 group-hover:text-brand-600 transition-colors">
                          {user.display_name || user.username}
                        </h4>
                        <p className="text-xs text-gray-400">@{user.username}</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-brand-600 bg-brand-50 group-hover:bg-brand-600 group-hover:text-white px-3 py-1 rounded-full transition-colors">
                      Chat
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Group Modal */}
      {showNewGroupModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <Users size={18} className="text-brand-600" />
                <span>Create Group Chat</span>
              </h3>
              <button
                onClick={() => {
                  setShowNewGroupModal(false)
                  setNewGroupTitle('')
                  setSelectedGroupUsers([])
                  setSearchQuery('')
                  setSearchResults([])
                }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Group Name Input */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Group Name
              </label>
              <input
                type="text"
                placeholder="e.g. Campus Study Group, Weekend Trip..."
                value={newGroupTitle}
                onChange={(e) => setNewGroupTitle(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all text-gray-900 placeholder-gray-400"
              />
            </div>

            {/* Selected Members Chips */}
            {selectedGroupUsers.length > 0 && (
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">
                  Selected Members ({selectedGroupUsers.length})
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-gray-50 rounded-xl border border-gray-100">
                  {selectedGroupUsers.map((user) => (
                    <span
                      key={user.id}
                      className="inline-flex items-center gap-1.5 bg-brand-50 border border-brand-200 text-brand-700 text-xs px-2.5 py-1 rounded-full font-medium"
                    >
                      <span>{user.display_name || user.username}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleSelectGroupUser(user)}
                        className="text-brand-500 hover:text-brand-800"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* User Search Input */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-gray-700">
                Add Participants
              </label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search members by username or name..."
                  value={searchQuery}
                  onChange={(e) => handleSearchUsers(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Search Results */}
            <div className="max-h-48 overflow-y-auto space-y-1 divide-y divide-gray-50 border border-gray-100 rounded-xl p-1 bg-white">
              {searching ? (
                <div className="py-6 text-center text-gray-400">
                  <Loader2 size={18} className="animate-spin text-brand-600 mx-auto mb-1" />
                  <span className="text-xs">Searching users...</span>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-6 text-center text-gray-400 text-xs">
                  {searchQuery.trim()
                    ? 'No users found matching query.'
                    : 'Search users to add them to your group.'}
                </div>
              ) : (
                searchResults.map((user) => {
                  const isSelected = selectedGroupUsers.some((u) => u.id === user.id)
                  return (
                    <div
                      key={user.id}
                      onClick={() => handleToggleSelectGroupUser(user)}
                      className={`p-2.5 flex items-center justify-between rounded-lg transition-colors cursor-pointer ${
                        isSelected ? 'bg-brand-50/70 border border-brand-200' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-600 overflow-hidden text-xs">
                          {user.avatar_url ? (
                            <Image
                              src={user.avatar_url}
                              alt={user.display_name || user.username}
                              width={32}
                              height={32}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            (user.display_name || user.username).charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-gray-900">
                            {user.display_name || user.username}
                          </h4>
                          <p className="text-[10px] text-gray-400">@{user.username}</p>
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-brand-600 text-white'
                            : 'border border-gray-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check size={12} />}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setShowNewGroupModal(false)
                  setNewGroupTitle('')
                  setSelectedGroupUsers([])
                }}
                className="btn-secondary text-xs py-2 px-3.5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateGroup}
                disabled={creatingGroup || !newGroupTitle.trim() || selectedGroupUsers.length === 0}
                className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingGroup ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Creating Group...</span>
                  </>
                ) : (
                  <>
                    <Users size={14} />
                    <span>Create Group ({selectedGroupUsers.length + 1})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
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
