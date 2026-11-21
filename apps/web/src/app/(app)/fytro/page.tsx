'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  Send,
  Trash2,
  ShieldCheck,
  Compass,
  Flame,
  Lightbulb,
  ArrowLeft,
  Bot,
  RefreshCw,
  Smile,
  Lock,
  Brain,
  Eye,
  Plus,
  Check,
  History,
  MessageSquare,
  Pin,
  X,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { FytroMode, FytroMemory } from '@private-voices/shared'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface FytroSession {
  id: string
  title: string
  mode: FytroMode
  pinned: boolean
  created_at: string
  updated_at: string
}

const FYTRO_PROMPTS = [
  {
    icon: '💭',
    title: 'Safe Venting Room',
    desc: 'Speak without holding back. No judgment, total privacy.',
    starter: "I've been holding something inside and need a safe place to untangle my thoughts without anyone judging me...",
  },
  {
    icon: '🛡️',
    title: 'Anonymity Shield Check',
    desc: 'Paste a draft confession to see if it accidentally leaks your identity.',
    starter: 'Here is a draft thought I want to post anonymously. Please check if I accidentally revealed identifying details: ',
  },
  {
    icon: '🧭',
    title: 'Moral or Life Dilemma',
    desc: 'Explore different angles of a tough decision you are facing.',
    starter: "I have a difficult personal decision to make and nobody I know can give me unbiased perspective. Here is what's happening: ",
  },
  {
    icon: '💡',
    title: 'Philosophy of the Day',
    desc: 'Deep questions about purpose, emotion, and human connection.',
    starter: 'Give me one introspective, deep question to think about today, and help me reflect on my answer.',
  },
]

const DEFAULT_WELCOME_MSG: Message = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Welcome to your Mind Space. I'm Fytro.\n\nHere, you can think freely, untangle difficult feelings, or review confidential thoughts before sharing them. Powered by high-speed intelligence and user-sovereign memory.",
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
}

export default function FytroPage(): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const [messages, setMessages] = useState<Message[]>([DEFAULT_WELCOME_MSG])
  const [input, setInput] = useState('')
  const [activeMode, setActiveMode] = useState<FytroMode>('sanctuary')
  const [thinking, setThinking] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Multi-Session Chat History State
  const [sessions, setSessions] = useState<FytroSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(false)

  // Memory Vault State
  const [showVault, setShowVault] = useState(false)
  const [memories, setMemories] = useState<FytroMemory[]>([])
  const [vaultLoading, setVaultLoading] = useState(false)
  const [newMemoryText, setNewMemoryText] = useState('')
  const [newMemoryCategory, setNewMemoryCategory] = useState<'perspective' | 'value' | 'dilemma' | 'goal' | 'context'>('perspective')
  const [savingMemory, setSavingMemory] = useState(false)

  // Load memories
  const loadMemories = async () => {
    setVaultLoading(true)
    try {
      const res = await fetch('/api/fytro/memories')
      const data = await res.json()
      if (data.memories) {
        setMemories(data.memories)
      }
    } catch (err) {
      console.error('Failed to load memories:', err)
    } finally {
      setVaultLoading(false)
    }
  }

  // Load Sessions
  const loadSessions = async () => {
    setLoadingSessions(true)
    try {
      const res = await fetch('/api/fytro/sessions')
      const data = await res.json()
      if (data.sessions) {
        setSessions(data.sessions)
      }
    } catch (err) {
      console.error('Failed to load sessions:', err)
    } finally {
      setLoadingSessions(false)
    }
  }

  // Switch or open a session
  const selectSession = async (session: FytroSession) => {
    setCurrentSessionId(session.id)
    setActiveMode(session.mode || 'sanctuary')
    setShowHistoryDrawer(false)
    setShowVault(false)
    try {
      const res = await fetch(`/api/fytro/messages?sessionId=${session.id}`)
      const data = await res.json()
      if (data.messages && data.messages.length > 0) {
        setMessages(
          data.messages.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }))
        )
      } else {
        setMessages([DEFAULT_WELCOME_MSG])
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Create a brand new session
  const startNewSession = async () => {
    try {
      const res = await fetch('/api/fytro/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'New Exploration',
          mode: activeMode,
        }),
      })
      const data = await res.json()
      if (data.session) {
        setSessions((prev) => [data.session, ...prev])
        setCurrentSessionId(data.session.id)
        setMessages([DEFAULT_WELCOME_MSG])
        setShowHistoryDrawer(false)
        setShowVault(false)
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Delete a session
  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Permanently delete this chat exploration?')) return
    try {
      await fetch(`/api/fytro/sessions?id=${id}`, { method: 'DELETE' })
      setSessions((prev) => prev.filter((s) => s.id !== id))
      if (currentSessionId === id) {
        setCurrentSessionId(null)
        setMessages([DEFAULT_WELCOME_MSG])
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentUserId(data.user.id)
        loadMemories()
        loadSessions()
      }
    })
  }, [supabase])

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMemoryText.trim() || savingMemory) return

    setSavingMemory(true)
    try {
      const res = await fetch('/api/fytro/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memoryText: newMemoryText.trim(),
          category: newMemoryCategory,
        }),
      })
      const data = await res.json()
      if (data.memory) {
        setMemories((prev) => [data.memory, ...prev])
        setNewMemoryText('')
      }
    } catch (err) {
      console.error('Failed to add memory:', err)
    } finally {
      setSavingMemory(false)
    }
  }

  const handleDeleteMemory = async (id: string) => {
    try {
      await fetch(`/api/fytro/memories?id=${id}`, { method: 'DELETE' })
      setMemories((prev) => prev.filter((m) => m.id !== id))
    } catch (err) {
      console.error('Failed to delete memory:', err)
    }
  }

  const handleBurnMemories = async () => {
    if (!confirm('Burn Memory Vault? Fytro will forget everything stored about your perspective.')) return
    try {
      await fetch('/api/fytro/memories?burnAll=true', { method: 'DELETE' })
      setMemories([])
    } catch (err) {
      console.error('Failed to burn memories:', err)
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input.trim()
    if (!text || thinking) return

    // Auto-create session if not yet existing
    let activeSid = currentSessionId
    if (!activeSid && currentUserId) {
      try {
        const titleSnippet = text.length > 30 ? text.slice(0, 30) + '...' : text
        const sRes = await fetch('/api/fytro/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: titleSnippet,
            mode: activeMode,
          }),
        })
        const sData = await sRes.json()
        if (sData.session) {
          activeSid = sData.session.id
          setCurrentSessionId(activeSid)
          setSessions((prev) => [sData.session, ...prev])
        }
      } catch (err) {
        console.error('Failed auto-session creation:', err)
      }
    }

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    if (!textToSend) setInput('')
    setThinking(true)

    // Persist user message to DB if session exists
    if (activeSid) {
      fetch('/api/fytro/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSid,
          role: 'user',
          content: text,
        }),
      }).catch(console.error)
    }

    // Prepare assistant message placeholder for live streaming
    const botMsgId = `b-${Date.now()}`
    const botTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    let accumulatedContent = ''

    try {
      const res = await fetch('/api/fytro/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          mode: activeMode,
          memories: memories.map((m) => ({
            category: m.category,
            memoryText: m.memoryText,
          })),
        }),
      })

      if (!res.ok || !res.body) {
        throw new Error('Inference connection failed')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      // Add initial empty bot message
      setMessages((prev) => [
        ...prev,
        {
          id: botMsgId,
          role: 'assistant',
          content: '',
          timestamp: botTimestamp,
        },
      ])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        accumulatedContent += chunk

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMsgId ? { ...msg, content: accumulatedContent } : msg
          )
        )
      }

      // Persist completed bot message
      if (activeSid && accumulatedContent.trim()) {
        fetch('/api/fytro/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: activeSid,
            role: 'assistant',
            content: accumulatedContent,
          }),
        }).catch(console.error)
      }
    } catch (err) {
      console.error('Error during streaming Fytro response:', err)
      setMessages((prev) => [
        ...prev,
        {
          id: botMsgId,
          role: 'assistant',
          content:
            "I'm here with you. Something momentarily disrupted my response stream, but your mind space is safe. What were you thinking?",
          timestamp: botTimestamp,
        },
      ])
    } finally {
      setThinking(false)
    }
  }

  const handleClear = () => {
    if (confirm('Burn this view? All messages will be cleared from your screen.')) {
      setMessages([
        {
          id: 'welcome-fresh',
          role: 'assistant',
          content: 'Session cleared cleanly. Your Mind Space is fresh and unburdened.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
      setCurrentSessionId(null)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-2xl mx-auto border-x border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm relative">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-2.5">
          <Link
            href="/feed"
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-rose-500 flex items-center justify-center text-white shadow-sm">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-sm text-gray-900 dark:text-white tracking-tight">
                  Fytro
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
                  Mind Space
                </span>
              </div>
              <p className="text-[10px] text-gray-400">Think freely. Explore deeply.</p>
            </div>
          </div>
        </div>

        {/* History, Mode Selector Chips, Memory Vault & Burn */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Multi-Session History Drawer Button */}
          <button
            onClick={() => {
              setShowHistoryDrawer(!showHistoryDrawer)
              setShowVault(false)
            }}
            title="Chat History & Sessions"
            className={`p-2 rounded-full transition-all text-xs flex items-center gap-1 font-semibold ${
              showHistoryDrawer
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            <History size={16} />
            <span className="hidden sm:inline">Sessions</span>
          </button>

          <div className="hidden md:flex items-center bg-gray-100 dark:bg-slate-800/80 p-0.5 rounded-full border border-gray-200/60 dark:border-slate-700/60 text-[11px]">
            <button
              onClick={() => setActiveMode('sanctuary')}
              className={`px-2.5 py-1 rounded-full font-bold transition-all ${
                activeMode === 'sanctuary'
                  ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-300 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Sanctuary
            </button>
            <button
              onClick={() => setActiveMode('challenger')}
              className={`px-2.5 py-1 rounded-full font-bold transition-all ${
                activeMode === 'challenger'
                  ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-300 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Challenger
            </button>
            <button
              onClick={() => setActiveMode('creative')}
              className={`px-2.5 py-1 rounded-full font-bold transition-all ${
                activeMode === 'creative'
                  ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-300 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Creative
            </button>
          </div>

          <button
            onClick={() => {
              setShowVault(!showVault)
              setShowHistoryDrawer(false)
            }}
            title="Memory Vault (User-Governed Memory)"
            className={`p-2 rounded-full transition-all text-xs flex items-center gap-1 font-semibold ${
              showVault
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40'
            }`}
          >
            <Brain size={16} />
            <span className="hidden sm:inline">Vault ({memories.length})</span>
          </button>

          <button
            onClick={handleClear}
            title="Clear Screen"
            className="p-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-full transition-all text-xs flex items-center gap-1 font-semibold"
          >
            <Flame size={16} />
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </div>

      {/* Slide-over Drawer: Sessions History */}
      {showHistoryDrawer && (
        <div className="absolute inset-y-0 right-0 w-80 bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 z-30 shadow-xl flex flex-col p-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <History size={18} className="text-purple-600" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Past Explorations</h3>
            </div>
            <button
              onClick={() => setShowHistoryDrawer(false)}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X size={16} />
            </button>
          </div>

          <button
            onClick={startNewSession}
            className="mt-3 w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs"
          >
            <Plus size={14} />
            <span>Start Fresh Exploration</span>
          </button>

          <div className="flex-1 overflow-y-auto mt-4 space-y-1.5">
            {sessions.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">
                No past sessions yet. Start typing to begin an exploration.
              </p>
            ) : (
              sessions.map((s) => {
                const isSelected = currentSessionId === s.id
                return (
                  <div
                    key={s.id}
                    onClick={() => selectSession(s)}
                    className={`p-2.5 rounded-xl cursor-pointer text-xs flex items-center justify-between group transition-all ${
                      isSelected
                        ? 'bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200 font-semibold'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-800/60 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <MessageSquare size={14} className="text-purple-500 shrink-0" />
                      <span className="truncate">{s.title}</span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-rose-500 rounded transition-all"
                      title="Delete session"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Messages or Memory Vault View */}
      {showVault ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                <Brain size={18} className="text-purple-600" />
                <span>Self-Sovereign Memory Vault</span>
              </h2>
              <p className="text-xs text-gray-500">
                You control everything Fytro remembers about you. Review, add, or delete individual memories at any time.
              </p>
            </div>
            {memories.length > 0 && (
              <button
                onClick={handleBurnMemories}
                className="text-xs font-bold text-rose-500 hover:text-rose-600 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              >
                Burn All Memories
              </button>
            )}
          </div>

          {/* Add New Memory Card */}
          <form onSubmit={handleAddMemory} className="p-3.5 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                <Plus size={14} />
                <span>Teach Fytro a Core Memory</span>
              </span>
              <select
                value={newMemoryCategory}
                onChange={(e) => setNewMemoryCategory(e.target.value as any)}
                className="text-[11px] font-semibold bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800/60 rounded-lg px-2 py-1 text-purple-800 dark:text-purple-200"
              >
                <option value="perspective">Perspective</option>
                <option value="value">Value</option>
                <option value="dilemma">Dilemma</option>
                <option value="goal">Goal</option>
                <option value="context">Context</option>
              </select>
            </div>
            <textarea
              value={newMemoryText}
              onChange={(e) => setNewMemoryText(e.target.value)}
              placeholder="e.g., 'I value direct honesty and skepticism toward mainstream consensus' or 'I am building an anonymous social space...'"
              className="w-full text-xs p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800/60 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none h-16"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!newMemoryText.trim() || savingMemory}
                className="text-xs font-bold bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white px-3.5 py-1.5 rounded-xl transition-all shadow-xs flex items-center gap-1.5"
              >
                <Check size={13} />
                <span>{savingMemory ? 'Saving...' : 'Add to Vault'}</span>
              </button>
            </div>
          </form>

          {/* List of active memories */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Active Context Items ({memories.length})
            </h3>
            {vaultLoading ? (
              <p className="text-xs text-gray-400">Loading memory vault...</p>
            ) : memories.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-gray-200 dark:border-slate-800 text-center space-y-1">
                <Brain size={24} className="mx-auto text-gray-400 mb-1" />
                <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Vault is empty</p>
                <p className="text-[11px] text-gray-400">
                  Fytro remembers nothing across sessions until you store thoughts above.
                </p>
              </div>
            ) : (
              memories.map((m) => (
                <div
                  key={m.id}
                  className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-900/60 border border-gray-200/80 dark:border-slate-800 flex items-start justify-between gap-3 group"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                      {m.category}
                    </span>
                    <p className="text-xs text-gray-800 dark:text-gray-200 leading-relaxed pt-0.5">
                      {m.memoryText}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteMemory(m.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-rose-500 rounded-lg transition-all"
                    title="Forget this memory"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* Conversation Stream */
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Quick thought starter cards */}
          {messages.length <= 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 my-3">
              {FYTRO_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(prompt.starter)}
                  className="text-left p-3 rounded-2xl border border-purple-100 dark:border-slate-800 bg-purple-50/40 dark:bg-slate-900/40 hover:bg-purple-50 dark:hover:bg-slate-800/60 transition-all hover:scale-[1.01] shadow-2xs group"
                >
                  <div className="text-lg mb-1">{prompt.icon}</div>
                  <div className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-purple-600 transition-colors">
                    {prompt.title}
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                    {prompt.desc}
                  </div>
                </button>
              ))}
            </div>
          )}

          {messages.map((m) => {
            const isUser = m.role === 'user'
            return (
              <div
                key={m.id}
                className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-rose-500 flex items-center justify-center text-white shrink-0 shadow-2xs mt-0.5">
                    <Sparkles size={13} />
                  </div>
                )}
                <div
                  className={`max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-purple-600 text-white rounded-br-xs shadow-xs'
                      : 'bg-gray-100 dark:bg-slate-800/80 text-gray-800 dark:text-gray-100 rounded-bl-xs border border-gray-200/50 dark:border-slate-700/50'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.content}</div>
                  <div
                    className={`text-[9px] mt-1 text-right ${
                      isUser ? 'text-purple-200' : 'text-gray-400'
                    }`}
                  >
                    {m.timestamp}
                  </div>
                </div>
              </div>
            )
          })}

          {thinking && (
            <div className="flex gap-2.5 items-center text-gray-400 text-xs pl-9">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
              <span>Fytro is reflecting via Groq...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input Tray */}
      <div className="p-3 border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex items-center gap-2 bg-gray-50 dark:bg-slate-800/80 rounded-2xl px-3.5 py-1.5 border border-gray-200/80 dark:border-slate-700/80 focus-within:ring-2 focus-within:ring-purple-500/50 focus-within:border-purple-500 transition-all"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell Fytro what's on your mind..."
            className="flex-1 bg-transparent py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || thinking}
            className="p-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white transition-all shadow-xs flex items-center justify-center"
          >
            <Send size={15} />
          </button>
        </form>
        <p className="text-[10px] text-center text-gray-400 mt-1.5">
          Fytro by Private Voices • Powered by Groq • Think freely. Explore deeply. Discover more.
        </p>
      </div>
    </div>
  )
}
