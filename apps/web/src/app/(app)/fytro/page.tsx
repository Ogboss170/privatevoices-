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
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Feather,
  Scale,
  Shield,
  Zap,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type {
  FytroMode,
  FytroMemory,
  FytroReaction,
  FytroVoiceId,
} from '@private-voices/shared'
import { FYTRO_VOICE_OPTIONS } from '@private-voices/shared'
import { FytroResponseActionBar } from '@/components/fytro/FytroResponseActionBar'

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
    icon: <Feather size={16} className="text-purple-500" />,
    badge: 'Sanctuary',
    title: 'Untangle raw feelings',
    desc: 'Speak honestly without judgment or performance.',
    starter: "I've been carrying something heavy today and need a safe place to untangle what I really feel...",
  },
  {
    icon: <Shield size={16} className="text-emerald-500" />,
    badge: 'Anonymity Shield',
    title: 'Audit draft for leaks',
    desc: 'Ensure no identifiable employers, names, or markers leak.',
    starter: 'Review this draft confession to verify that no identifying details, timestamps, or locations could expose who I am: ',
  },
  {
    icon: <Scale size={16} className="text-amber-500" />,
    badge: 'Challenger',
    title: 'Stress-test my viewpoint',
    desc: 'Steel-man opposing counter-arguments to find blind spots.',
    starter: "Here is a perspective I hold strongly. Give me the strongest, good-faith counter-arguments against it: ",
  },
  {
    icon: <Compass size={16} className="text-sky-500" />,
    badge: 'Life Dilemma',
    title: 'Explore difficult choices',
    desc: 'Unbiased Socratic clarity on personal or ethical decisions.',
    starter: "I have a difficult personal dilemma with conflicting values. Help me analyze the tradeoffs clearly: ",
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
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [activeMode, setActiveMode] = useState<FytroMode>('sanctuary')
  const [thinking, setThinking] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('')
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

  // Message feedback map: messageId -> reaction
  const [feedbackMap, setFeedbackMap] = useState<Record<string, FytroReaction>>({})

  // Voice Interaction State (Speech Recognition & Multi-Voice TTS)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [selectedVoice, setSelectedVoice] = useState<FytroVoiceId>('serene')
  const [showVoiceMenu, setShowVoiceMenu] = useState(false)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        setSpeechSupported(true)
        const reco = new SpeechRecognition()
        reco.continuous = false
        reco.interimResults = true
        reco.lang = 'en-US'

        reco.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((res: any) => res[0].transcript)
            .join('')
          setInput(transcript)
        }

        reco.onerror = (e: any) => {
          console.warn('Speech recognition error:', e)
          setIsListening(false)
        }

        reco.onend = () => {
          setIsListening(false)
        }

        recognitionRef.current = reco
      }
    }
  }, [])

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech-to-text is not supported by your current browser. Please try Chrome, Edge, or Safari.')
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      try {
        recognitionRef.current.start()
        setIsListening(true)
      } catch (err) {
        console.warn('Recognition start error:', err)
      }
    }
  }

  // Initialize voice from localStorage if available
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedVoice = localStorage.getItem('fytro_selected_voice') as FytroVoiceId
      if (savedVoice && FYTRO_VOICE_OPTIONS.some((v) => v.id === savedVoice)) {
        setSelectedVoice(savedVoice)
      }
    }
  }, [])

  const handleSelectVoice = (voiceId: FytroVoiceId) => {
    setSelectedVoice(voiceId)
    setShowVoiceMenu(false)
    if (typeof window !== 'undefined') {
      localStorage.setItem('fytro_selected_voice', voiceId)
    }
  }

  const speakText = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert('Text-to-speech is not supported by your browser.')
      return
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }

    window.speechSynthesis.cancel() // clear queue
    const cleanText = text.replace(/[#*`_~[\]()]/g, '').trim()
    const utterance = new SpeechSynthesisUtterance(cleanText)

    // Lookup chosen voice profile
    const voiceProfile = FYTRO_VOICE_OPTIONS.find((v) => v.id === selectedVoice) || FYTRO_VOICE_OPTIONS[0]
    utterance.rate = voiceProfile.rate
    utterance.pitch = voiceProfile.pitch

    // Find browser matching voice from preferred candidates
    const availableVoices = window.speechSynthesis.getVoices()
    let matchedVoice: SpeechSynthesisVoice | undefined

    for (const pref of voiceProfile.preferredVoices) {
      matchedVoice = availableVoices.find(
        (v) => v.name.toLowerCase().includes(pref.toLowerCase()) || v.voiceURI.toLowerCase().includes(pref.toLowerCase())
      )
      if (matchedVoice) break
    }

    // Fallback: match by language and gender preference
    if (!matchedVoice) {
      if (voiceProfile.gender === 'male') {
        matchedVoice = availableVoices.find(
          (v) => v.lang.startsWith('en') && (v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('david') || v.name.toLowerCase().includes('george'))
        )
      } else if (voiceProfile.gender === 'female') {
        matchedVoice = availableVoices.find(
          (v) => v.lang.startsWith('en') && (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('susan'))
        )
      }
    }

    if (matchedVoice) {
      utterance.voice = matchedVoice
    }

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    window.speechSynthesis.speak(utterance)
  }

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
        setMessages([])
      }

      // Also fetch user feedback for this session
      fetch(`/api/fytro/feedback?sessionId=${session.id}`)
        .then((r) => r.json())
        .then((fbData) => {
          if (fbData.feedback) {
            const map: Record<string, FytroReaction> = {}
            for (const fb of fbData.feedback) {
              map[fb.message_id] = fb.reaction
            }
            setFeedbackMap(map)
          }
        })
        .catch(console.warn)
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
        setMessages([])
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
        setMessages([])
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentUserId(data.user.id)
        const name =
          data.user.user_metadata?.full_name ||
          data.user.user_metadata?.display_name ||
          data.user.user_metadata?.username ||
          data.user.email?.split('@')[0] ||
          ''
        if (name) {
          // Capitalize first letter
          setUserName(name.charAt(0).toUpperCase() + name.slice(1))
        }
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
      // Only set error message if nothing was streamed yet
      if (!accumulatedContent.trim()) {
        setMessages((prev) => {
          const exists = prev.some((msg) => msg.id === botMsgId)
          if (exists) {
            return prev.map((msg) =>
              msg.id === botMsgId
                ? {
                    ...msg,
                    content:
                      "I'm here with you. Something momentarily disrupted my response stream, but your mind space is safe. What were you thinking?",
                  }
                : msg
            )
          }
          return [
            ...prev,
            {
              id: botMsgId,
              role: 'assistant',
              content:
                "I'm here with you. Something momentarily disrupted my response stream, but your mind space is safe. What were you thinking?",
              timestamp: botTimestamp,
            },
          ]
        })
      }
    } finally {
      setThinking(false)
    }
  }

  const handleClear = () => {
    if (confirm('Burn this view? All messages will be cleared from your screen.')) {
      setMessages([])
      setCurrentSessionId(null)
      setFeedbackMap({})
    }
  }

  // Regenerate last assistant response
  const handleRegenerate = async (botMsgId: string) => {
    if (thinking) return
    // Find index of bot message
    const botIdx = messages.findIndex((m) => m.id === botMsgId)
    if (botIdx === -1) return

    // Find preceding user message
    let precedingUserText = ''
    for (let i = botIdx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        precedingUserText = messages[i].content
        break
      }
    }

    if (!precedingUserText) return

    // Filter messages up to the user message
    const truncated = messages.slice(0, botIdx)
    setMessages(truncated)
    handleSend(precedingUserText)
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

          {/* Multi-Voice Selector Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => {
                setShowVoiceMenu(!showVoiceMenu)
                setShowVault(false)
                setShowHistoryDrawer(false)
              }}
              title="Voice Selection"
              className={`p-2 rounded-full transition-all text-xs flex items-center gap-1 font-semibold ${
                showVoiceMenu
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
              }`}
            >
              <Volume2 size={16} />
              <span className="hidden sm:inline capitalize">
                {FYTRO_VOICE_OPTIONS.find((v) => v.id === selectedVoice)?.name.split(' ')[0] || 'Voice'}
              </span>
            </button>

            {/* Voice Menu Popover */}
            {showVoiceMenu && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-200/80 dark:border-slate-800 p-2 z-40">
                <div className="px-3 py-2 border-b border-gray-100 dark:border-slate-800 mb-1">
                  <p className="text-xs font-bold text-gray-900 dark:text-white flex items-center justify-between">
                    <span>Fytro Voice Persona</span>
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold uppercase tracking-wider">
                      5 Voices
                    </span>
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    Select the vocal tone for reading answers aloud.
                  </p>
                </div>
                <div className="space-y-1">
                  {FYTRO_VOICE_OPTIONS.map((v) => {
                    const isSelected = selectedVoice === v.id
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => handleSelectVoice(v.id)}
                        className={`w-full text-left p-2 rounded-xl transition-all flex items-start justify-between gap-2 ${
                          isSelected
                            ? 'bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60'
                            : 'hover:bg-gray-50 dark:hover:bg-slate-800/70'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-gray-900 dark:text-white">
                              {v.name}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 capitalize">
                              {v.gender}
                            </span>
                          </div>
                          <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium truncate mt-0.5">
                            {v.tone}
                          </p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 line-clamp-1 mt-0.5">
                            {v.description}
                          </p>
                        </div>
                        {isSelected && (
                          <Check size={14} className="text-purple-600 dark:text-purple-400 shrink-0 mt-1" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
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
        /* Conversation Stream / Front Entry */
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col justify-between">
          {messages.length === 0 ? (
            /* Modern Gemini-inspired Entry Landing Screen */
            <div className="my-auto py-4 sm:py-8 max-w-xl mx-auto w-full space-y-6 sm:space-y-8 animate-in fade-in duration-300">
              {/* Hero Greeting */}
              <div className="space-y-2 text-center sm:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/60 text-xs font-semibold text-purple-700 dark:text-purple-300 shadow-2xs">
                  <Sparkles size={13} className="text-purple-500 animate-pulse" />
                  <span>Cognitive Sanctuary & Autonomous Mind Space</span>
                </div>

                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                  <span className="bg-gradient-to-r from-purple-600 via-indigo-600 to-rose-500 bg-clip-text text-transparent">
                    {userName ? `Hello, ${userName}.` : 'Hello.'}
                  </span>
                  <br />
                  <span className="text-gray-900 dark:text-white">
                    What would you like to explore?
                  </span>
                </h1>

                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-lg leading-relaxed">
                  Your private, sovereign space to test ideas, untangle complex dilemmas, review confidential drafts for leaks, or reflect freely without surveillance.
                </p>
              </div>

              {/* Mode Quick Switcher Pills */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mr-1">
                  Active Mode:
                </span>
                {(
                  [
                    { id: 'sanctuary', label: 'Sanctuary', icon: <Feather size={12} /> },
                    { id: 'challenger', label: 'Challenger', icon: <Scale size={12} /> },
                    { id: 'creative', label: 'Creative', icon: <Sparkles size={12} /> },
                    { id: 'shield', label: 'Anonymity Shield', icon: <Shield size={12} /> },
                  ] as const
                ).map((m) => {
                  const isActive = activeMode === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setActiveMode(m.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-purple-600 text-white shadow-xs scale-[1.02]'
                          : 'bg-gray-100 dark:bg-slate-800/80 hover:bg-gray-200/80 dark:hover:bg-slate-700/80 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {m.icon}
                      <span>{m.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Capability Cards / Thought Starters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FYTRO_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(prompt.starter)}
                    className="text-left p-3.5 rounded-2xl border border-gray-200/70 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/40 hover:bg-purple-50/50 dark:hover:bg-purple-950/20 hover:border-purple-300 dark:hover:border-purple-800/60 transition-all hover:scale-[1.01] shadow-2xs group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-1.5 rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700/60 shadow-2xs group-hover:scale-110 transition-transform">
                          {prompt.icon}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded-full border border-purple-200/60 dark:border-purple-800/60">
                          {prompt.badge}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        {prompt.title}
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-1 leading-relaxed">
                        {prompt.desc}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Security & Memory Trust Footer */}
              <div className="flex items-center justify-between text-[11px] text-gray-400 pt-2 border-t border-gray-100 dark:border-slate-800/80">
                <div className="flex items-center gap-1.5">
                  <Lock size={12} className="text-emerald-500" />
                  <span>Confidential session • Never shared with public training models</span>
                </div>
                <div className="flex items-center gap-1">
                  <Brain size={12} className="text-purple-500" />
                  <span>{memories.length} vault {memories.length === 1 ? 'memory' : 'memories'}</span>
                </div>
              </div>
            </div>
          ) : (
            /* Active Message Flow */
            <div className="space-y-4">
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
                    className={`text-[9px] mt-1.5 flex items-center justify-between ${
                      isUser ? 'text-purple-200' : 'text-gray-400'
                    }`}
                  >
                    <span />
                    <span>{m.timestamp}</span>
                  </div>

                  {/* Clean, responsive Fytro response action bar */}
                  {!isUser && (
                    <FytroResponseActionBar
                      messageId={m.id}
                      sessionId={currentSessionId}
                      content={m.content}
                      isStreaming={thinking && messages[messages.length - 1]?.id === m.id}
                      isSpeaking={isSpeaking}
                      currentReaction={feedbackMap[m.id] || null}
                      onRegenerate={() => handleRegenerate(m.id)}
                      onToggleSpeech={speakText}
                      onReactionChange={(reaction) => {
                        setFeedbackMap((prev) => {
                          const updated = { ...prev }
                          if (reaction) {
                            updated[m.id] = reaction
                          } else {
                            delete updated[m.id]
                          }
                          return updated
                        })
                      }}
                    />
                  )}
                </div>
              </div>
            )
          })}

          {thinking && (
            <div className="flex gap-2.5 items-center text-gray-400 text-xs pl-9">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
              <span>Thinking...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      )}

      {/* Input Tray */}
      <div className="p-3 border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex items-center gap-2 bg-gray-50/90 dark:bg-slate-800/90 rounded-2xl px-4 py-2 border border-gray-200/80 dark:border-slate-700/80 focus-within:ring-2 focus-within:ring-purple-500/40 focus-within:border-purple-500/80 shadow-xs transition-all"
        >
          <div className="p-1.5 rounded-lg bg-gradient-to-tr from-purple-500/20 to-indigo-500/20 text-purple-600 dark:text-purple-400 shrink-0">
            <Sparkles size={16} />
          </div>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? 'Listening to your voice...' : "Ask Fytro, test an idea, or untangle a dilemma..."}
            className="flex-1 bg-transparent py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none"
          />
          {speechSupported && (
            <button
              type="button"
              onClick={toggleListening}
              className={`p-2 rounded-xl transition-all flex items-center justify-center ${
                isListening
                  ? 'bg-rose-500 text-white animate-pulse shadow-sm'
                  : 'text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-slate-700/50'
              }`}
              title={isListening ? 'Stop listening' : 'Speak to Fytro'}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          )}
          <button
            type="submit"
            disabled={!input.trim() || thinking}
            className="p-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white transition-all shadow-xs flex items-center justify-center hover:scale-105 active:scale-95"
          >
            <Send size={15} />
          </button>
        </form>
        <p className="text-[10px] text-center text-gray-400 mt-1.5">
          Think freely. Discover more.
        </p>
      </div>
    </div>
  )
}
