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
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { FytroMode } from '@private-voices/shared'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
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

export default function FytroPage(): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Welcome to your Mind Space. I'm Fytro.\n\nHere, you can think freely, untangle difficult feelings, or review confidential thoughts before sharing them. Nothing you write here is shared with advertisers or attached to your public identity.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ])
  const [input, setInput] = useState('')
  const [activeMode, setActiveMode] = useState<FytroMode>('sanctuary')
  const [thinking, setThinking] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
  }, [supabase])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input.trim()
    if (!text || thinking) return

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
    if (confirm('Burn this session? All messages will be permanently wiped from your screen.')) {
      setMessages([
        {
          id: 'welcome-fresh',
          role: 'assistant',
          content: 'Session burned cleanly. Your Mind Space is fresh and clear.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-2xl mx-auto border-x border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
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

        {/* Mode Selector Chips & Burn */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="hidden sm:flex items-center bg-gray-100 dark:bg-slate-800/80 p-0.5 rounded-full border border-gray-200/60 dark:border-slate-700/60 text-[11px]">
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
              onClick={() => setActiveMode('shield')}
              className={`px-2.5 py-1 rounded-full font-bold transition-all ${
                activeMode === 'shield'
                  ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-300 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Shield
            </button>
          </div>

          <button
            onClick={handleClear}
            title="Burn Session (Instant Wipe)"
            className="p-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-full transition-all text-xs flex items-center gap-1 font-semibold"
          >
            <Flame size={16} />
            <span className="hidden sm:inline">Burn</span>
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Privacy Assurance Pill */}
        <div className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/40 rounded-2xl p-3 flex items-center gap-2.5 text-xs text-purple-900 dark:text-purple-200">
          <Lock size={16} className="text-purple-600 flex-shrink-0" />
          <p className="leading-snug">
            <span className="font-bold">Zero-Judgment Zone:</span> Your thoughts with Fytro are ephemeral and shielded by Private Voices. No ads, no profiles.
          </p>
        </div>

        {/* Quick Suggestion Cards (show when few messages) */}
        {messages.length <= 2 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
            {FYTRO_PROMPTS.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(p.starter)}
                className="text-left p-3 rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-900/50 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50/30 dark:hover:bg-purple-950/20 transition-all group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{p.icon}</span>
                  <span className="font-bold text-xs text-gray-800 dark:text-gray-200 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                    {p.title}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2">
                  {p.desc}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* Chat bubbles */}
        {messages.map((m) => {
          const isUser = m.role === 'user'
          return (
            <div
              key={m.id}
              className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white flex-shrink-0 mt-1 shadow-xs">
                  <Sparkles size={13} />
                </div>
              )}
              <div
                className={`max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  isUser
                    ? 'bg-purple-600 text-white rounded-tr-none'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100 rounded-tl-none border border-gray-200/50 dark:border-slate-700/50 whitespace-pre-wrap'
                }`}
              >
                {m.content}
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
            <span>Fytro is reflecting...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

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
          Fytro by Private Voices • Think freely. Explore deeply. Discover more.
        </p>
      </div>
    </div>
  )
}
