'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import {
  Calendar,
  Clock,
  Users,
  Plus,
  HelpCircle,
  ThumbsUp,
  MessageSquare,
  Sparkles,
  CheckCircle,
  Share2,
  X,
  Radio,
  ExternalLink,
  ChevronRight,
  Shield,
  Send,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import GuestAuthModal from '@/components/auth/GuestAuthModal'

interface CommunityEvent {
  id: string
  community_id: string
  title: string
  description?: string
  event_type: 'ama' | 'voice_stage' | 'workshop' | 'hangout'
  host_id: string
  guest_name?: string
  guest_title?: string
  guest_avatar_url?: string
  start_time: string
  end_time?: string
  status: 'upcoming' | 'live' | 'ended'
  meeting_url?: string
  rsvp_count: number
  host?: {
    id: string
    username: string
    display_name?: string
    avatar_url?: string
  }
}

interface AMAQuestion {
  id: string
  event_id: string
  author_id: string
  question: string
  upvotes: number
  is_answered: boolean
  answer?: string
  answered_at?: string
  author?: {
    id: string
    username: string
    display_name?: string
    avatar_url?: string
  }
}

interface CommunityEventsManagerProps {
  communityId: string
  currentUserId?: string | null
  userRole?: 'owner' | 'moderator' | 'vip' | 'contributor' | 'member' | null
  isMember?: boolean
}

export default function CommunityEventsManager({
  communityId,
  currentUserId,
  userRole,
  isMember = false,
}: CommunityEventsManagerProps) {
  const supabase = createSupabaseBrowserClient()
  const [events, setEvents] = useState<CommunityEvent[]>([])
  const [selectedEvent, setSelectedEvent] = useState<CommunityEvent | null>(null)
  const [questions, setQuestions] = useState<AMAQuestion[]>([])
  const [userRsvps, setUserRsvps] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingQuestions, setLoadingQuestions] = useState(false)

  // Creation modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newType, setNewType] = useState<'ama' | 'voice_stage' | 'workshop'>('ama')
  const [newGuestName, setNewGuestName] = useState('')
  const [newGuestTitle, setNewGuestTitle] = useState('')
  const [newStartTime, setNewStartTime] = useState('')
  const [creating, setCreating] = useState(false)

  // Question submission state
  const [newQuestionText, setNewQuestionText] = useState('')
  const [submittingQuestion, setSubmittingQuestion] = useState(false)

  // Host answer state
  const [answeringQuestionId, setAnsweringQuestionId] = useState<string | null>(null)
  const [answerText, setAnswerText] = useState('')

  // Guest modal state
  const [guestAuthOpen, setGuestAuthOpen] = useState(false)
  const [guestModalDesc, setGuestModalDesc] = useState('')

  const isOwnerOrMod = userRole === 'owner' || userRole === 'moderator'

  // 1. Fetch Events
  useEffect(() => {
    async function loadEvents() {
      setLoading(true)
      const { data } = await supabase
        .from('community_events')
        .select('*, host:profiles!community_events_host_id_fkey(id, username, display_name, avatar_url)')
        .eq('community_id', communityId)
        .order('start_time', { ascending: true })

      if (data && data.length > 0) {
        setEvents(data)
        setSelectedEvent(data[0])
      } else {
        // Fallback demo events
        const demoEvents: CommunityEvent[] = [
          {
            id: 'demo-ama-1',
            community_id: communityId,
            title: 'Founders AMA: Navigating Seed Rounds & Product Launches',
            description: 'Ask anything about scaling early-stage startups, pitching angels, and avoiding early pitfalls.',
            event_type: 'ama',
            host_id: currentUserId || 'host-1',
            guest_name: 'Sarah Chen',
            guest_title: 'Founding Partner @ Horizon Ventures',
            start_time: new Date(Date.now() + 86400000 * 2).toISOString(),
            status: 'upcoming',
            rsvp_count: 34,
            host: {
              id: 'host-1',
              username: 'sarah_ventures',
              display_name: 'Sarah Chen',
            },
          },
          {
            id: 'demo-ama-2',
            community_id: communityId,
            title: 'Mental Resilience & Creative Flow Workshop',
            description: 'Interactive session exploring healthy boundaries, creative burnout recovery, and flow states.',
            event_type: 'voice_stage',
            host_id: currentUserId || 'host-2',
            guest_name: 'Dr. Marcus Vance',
            guest_title: 'Cognitive Psychologist & Author',
            start_time: new Date(Date.now() + 86400000 * 5).toISOString(),
            status: 'upcoming',
            rsvp_count: 58,
            host: {
              id: 'host-2',
              username: 'marcus_vance',
              display_name: 'Dr. Marcus Vance',
            },
          },
        ]
        setEvents(demoEvents)
        setSelectedEvent(demoEvents[0])
      }

      if (currentUserId) {
        const { data: rsvpData } = await supabase
          .from('community_event_rsvps')
          .select('event_id')
          .eq('user_id', currentUserId)

        if (rsvpData) {
          setUserRsvps(rsvpData.map((r) => r.event_id))
        }
      }
      setLoading(false)
    }

    loadEvents()
  }, [communityId, currentUserId, supabase])

  // 2. Fetch AMA Questions when selected event changes
  useEffect(() => {
    if (!selectedEvent) return

    async function loadQuestions() {
      setLoadingQuestions(true)
      const { data } = await supabase
        .from('community_ama_questions')
        .select('*, author:profiles!community_ama_questions_author_id_fkey(id, username, display_name, avatar_url)')
        .eq('event_id', selectedEvent!.id)
        .order('upvotes', { ascending: false })

      if (data && data.length > 0) {
        setQuestions(data)
      } else {
        // Fallback demo questions for first event
        setQuestions([
          {
            id: 'demo-q-1',
            event_id: selectedEvent!.id,
            author_id: 'user-1',
            question: 'What was the single most pivotal metric that convinced your first institutional investor?',
            upvotes: 18,
            is_answered: true,
            answer: 'Retention of our core 100 power users. Investors care far more about deep love from a few than shallow vanity signups.',
            author: { id: 'user-1', username: 'alex_codes', display_name: 'Alex Rivera' },
          },
          {
            id: 'demo-q-2',
            event_id: selectedEvent!.id,
            author_id: 'user-2',
            question: 'How do you handle co-founder equity splits before real traction is visible?',
            upvotes: 12,
            is_answered: false,
            author: { id: 'user-2', username: 'jordan_builds', display_name: 'Jordan Sparks' },
          },
        ])
      }
      setLoadingQuestions(false)
    }

    loadQuestions()
  }, [selectedEvent, supabase])

  // 3. Handle RSVP Toggle
  async function handleToggleRsvp(event: CommunityEvent) {
    if (!currentUserId) {
      setGuestModalDesc('Sign in or create an account to RSVP for community events and AMAs.')
      setGuestAuthOpen(true)
      return
    }

    const isGoing = userRsvps.includes(event.id)
    if (isGoing) {
      setUserRsvps((prev) => prev.filter((id) => id !== event.id))
      setEvents((prev) =>
        prev.map((e) => (e.id === event.id ? { ...e, rsvp_count: Math.max(0, e.rsvp_count - 1) } : e))
      )
      await supabase
        .from('community_event_rsvps')
        .delete()
        .match({ event_id: event.id, user_id: currentUserId })
    } else {
      setUserRsvps((prev) => [...prev, event.id])
      setEvents((prev) =>
        prev.map((e) => (e.id === event.id ? { ...e, rsvp_count: e.rsvp_count + 1 } : e))
      )
      await supabase.from('community_event_rsvps').insert({
        event_id: event.id,
        community_id: communityId,
        user_id: currentUserId,
        status: 'going',
      })
    }
  }

  // 4. Submit AMA Question
  async function handleSubmitQuestion(e: React.FormEvent) {
    e.preventDefault()
    if (!newQuestionText.trim() || !selectedEvent) return

    if (!currentUserId) {
      setGuestModalDesc('Sign in to submit questions for this AMA.')
      setGuestAuthOpen(true)
      return
    }

    setSubmittingQuestion(true)
    const text = newQuestionText.trim()
    setNewQuestionText('')

    try {
      const { data, error } = await supabase
        .from('community_ama_questions')
        .insert({
          event_id: selectedEvent.id,
          community_id: communityId,
          author_id: currentUserId,
          question: text,
        })
        .select('*, author:profiles!community_ama_questions_author_id_fkey(id, username, display_name, avatar_url)')
        .single()

      if (data) {
        setQuestions((prev) => [data, ...prev])
      } else {
        // Fallback local echo
        const fakeQ: AMAQuestion = {
          id: `local-q-${Date.now()}`,
          event_id: selectedEvent.id,
          author_id: currentUserId,
          question: text,
          upvotes: 1,
          is_answered: false,
          author: { id: currentUserId, username: 'You', display_name: 'You' },
        }
        setQuestions((prev) => [fakeQ, ...prev])
      }
    } finally {
      setSubmittingQuestion(false)
    }
  }

  // 5. Upvote Question
  function handleUpvoteQuestion(qId: string) {
    if (!currentUserId) {
      setGuestModalDesc('Sign in to upvote questions you want answered.')
      setGuestAuthOpen(true)
      return
    }

    setQuestions((prev) =>
      prev.map((q) => (q.id === qId ? { ...q, upvotes: q.upvotes + 1 } : q))
    )
  }

  // 6. Host Answer Question
  async function handleAnswerQuestion(qId: string) {
    if (!answerText.trim() || !selectedEvent) return

    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId
          ? {
              ...q,
              is_answered: true,
              answer: answerText.trim(),
              answered_at: new Date().toISOString(),
            }
          : q
      )
    )

    await supabase
      .from('community_ama_questions')
      .update({
        is_answered: true,
        answer: answerText.trim(),
        answered_at: new Date().toISOString(),
      })
      .eq('id', qId)

    setAnsweringQuestionId(null)
    setAnswerText('')
  }

  // 7. Create Event
  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim() || !newStartTime) return

    setCreating(true)
    try {
      const { data, error } = await supabase
        .from('community_events')
        .insert({
          community_id: communityId,
          title: newTitle.trim(),
          description: newDesc.trim() || null,
          event_type: newType,
          host_id: currentUserId,
          guest_name: newGuestName.trim() || null,
          guest_title: newGuestTitle.trim() || null,
          start_time: new Date(newStartTime).toISOString(),
          status: 'upcoming',
        })
        .select()
        .single()

      if (data) {
        setEvents((prev) => [...prev, data])
        setSelectedEvent(data)
        setShowCreateModal(false)
        setNewTitle('')
        setNewDesc('')
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
            <Calendar size={20} className="text-brand-600" />
            <span>Community Events & Live AMAs</span>
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Join interactive question & answer sessions, workshops, and guest stages.
          </p>
        </div>

        {isOwnerOrMod && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-sm"
          >
            <Plus size={15} />
            <span>Schedule Event</span>
          </button>
        )}
      </div>

      {/* Main Events Grid / Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Events Schedule List */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
            Upcoming Events ({events.length})
          </h4>

          {loading ? (
            <div className="p-8 text-center text-xs text-gray-400">Loading events...</div>
          ) : (
            events.map((event) => {
              const isSelected = selectedEvent?.id === event.id
              const isRsvpd = userRsvps.includes(event.id)
              const eventDate = new Date(event.start_time)

              return (
                <div
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className={`p-4 rounded-3xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-brand-50/60 dark:bg-brand-950/20 border-brand-500 shadow-sm'
                      : 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                        event.event_type === 'ama'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                          : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                      }`}
                    >
                      {event.event_type === 'ama' ? '🎙️ Live AMA' : '🎧 Voice Stage'}
                    </span>
                    <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                      <Clock size={12} />
                      {eventDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <h4 className="font-extrabold text-sm text-gray-900 dark:text-white leading-snug mb-1">
                    {event.title}
                  </h4>

                  {event.guest_name && (
                    <p className="text-xs text-brand-600 font-semibold mb-3">
                      Guest: {event.guest_name}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-800/80">
                    <span className="text-[11px] text-gray-500 flex items-center gap-1">
                      <Users size={12} />
                      <strong>{event.rsvp_count}</strong> attending
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleRsvp(event)
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                        isRsvpd
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {isRsvpd ? '✓ Going' : '+ RSVP'}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Selected Event Details & Interactive AMA Question Board */}
        <div className="lg:col-span-2 space-y-4">
          {selectedEvent ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-gray-100 dark:border-slate-800 shadow-sm space-y-6">
              {/* Event Header Banner */}
              <div className="space-y-3 pb-5 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-purple-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={14} />
                    <span>Featured Event Session</span>
                  </span>
                  <button
                    onClick={() => handleToggleRsvp(selectedEvent)}
                    className={`px-4 py-1.5 rounded-full text-xs font-extrabold transition-all ${
                      userRsvps.includes(selectedEvent.id)
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'bg-brand-600 hover:bg-brand-700 text-white shadow-md'
                    }`}
                  >
                    {userRsvps.includes(selectedEvent.id) ? '✓ Attending Session' : 'RSVP Now'}
                  </button>
                </div>

                <h2 className="text-xl font-black text-gray-900 dark:text-white leading-tight">
                  {selectedEvent.title}
                </h2>

                {selectedEvent.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    {selectedEvent.description}
                  </p>
                )}

                {selectedEvent.guest_name && (
                  <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm">
                      {selectedEvent.guest_name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-gray-900 dark:text-white">
                        {selectedEvent.guest_name}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {selectedEvent.guest_title || 'Guest Speaker'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* AMA Questions Board Header */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <HelpCircle size={18} className="text-brand-600" />
                    <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                      Ask Me Anything (AMA) Questions
                    </h3>
                  </div>
                  <span className="text-xs text-gray-400">
                    {questions.length} submitted
                  </span>
                </div>

                {/* Question Input Form */}
                <form onSubmit={handleSubmitQuestion} className="flex gap-2 mb-6">
                  <input
                    type="text"
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    placeholder="Ask a question for this session..."
                    className="flex-1 bg-gray-50 dark:bg-slate-800 rounded-full px-4 py-2.5 text-xs text-gray-900 dark:text-white outline-none ring-1 ring-gray-200 dark:ring-slate-700 focus:ring-brand-500"
                  />
                  <button
                    type="submit"
                    disabled={submittingQuestion || !newQuestionText.trim()}
                    className="px-4 py-2.5 rounded-full bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold disabled:opacity-40 shadow-sm transition-all flex items-center gap-1 shrink-0"
                  >
                    <Send size={13} />
                    <span>Ask</span>
                  </button>
                </form>

                {/* Questions List */}
                <div className="space-y-3">
                  {loadingQuestions ? (
                    <div className="p-6 text-center text-xs text-gray-400">Loading questions...</div>
                  ) : questions.length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-400 bg-gray-50 dark:bg-slate-800/40 rounded-2xl">
                      No questions submitted yet. Be the first to ask!
                    </div>
                  ) : (
                    questions.map((q) => (
                      <div
                        key={q.id}
                        className="p-4 rounded-2xl bg-gray-50/70 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800 space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-xs font-bold text-gray-900 dark:text-white leading-relaxed flex-1">
                            {q.question}
                          </p>

                          <button
                            onClick={() => handleUpvoteQuestion(q.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:border-brand-500 text-xs font-bold shadow-2xs shrink-0 transition-all active:scale-95"
                            title="Upvote this question"
                          >
                            <ThumbsUp size={12} className="text-brand-600" />
                            <span>{q.upvotes}</span>
                          </button>
                        </div>

                        {/* Author info */}
                        <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                          <span>Asked by @{q.author?.username || 'member'}</span>
                          {q.is_answered && (
                            <span className="text-emerald-600 font-bold flex items-center gap-1">
                              <CheckCircle size={12} />
                              Answered
                            </span>
                          )}
                        </div>

                        {/* Host Answer View */}
                        {q.is_answered && q.answer && (
                          <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 text-xs text-gray-800 dark:text-gray-200 leading-relaxed mt-2">
                            <strong className="text-purple-700 dark:text-purple-300 block mb-0.5 font-bold">
                              Speaker Answer:
                            </strong>
                            {q.answer}
                          </div>
                        )}

                        {/* Host Answer Composer (Host or Mod only) */}
                        {isOwnerOrMod && !q.is_answered && (
                          <div className="pt-2">
                            {answeringQuestionId === q.id ? (
                              <div className="space-y-2">
                                <textarea
                                  rows={2}
                                  value={answerText}
                                  onChange={(e) => setAnswerText(e.target.value)}
                                  placeholder="Write the speaker's answer..."
                                  className="w-full text-xs p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white resize-none"
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => setAnsweringQuestionId(null)}
                                    className="px-3 py-1 rounded-full text-xs text-gray-500"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleAnswerQuestion(q.id)}
                                    disabled={!answerText.trim()}
                                    className="btn-primary text-xs py-1 px-3"
                                  >
                                    Save Answer
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setAnsweringQuestionId(q.id)
                                  setAnswerText('')
                                }}
                                className="text-[11px] text-purple-600 font-bold hover:underline"
                              >
                                + Answer Question as Speaker
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-gray-400 bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800">
              Select an event to view details and AMA questions.
            </div>
          )}
        </div>
      </div>

      {/* Schedule Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-gray-100 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-lg text-gray-900 dark:text-white">
                Schedule Community Event
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-full"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Event Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Creator AMA, Product Breakdown"
                  className="w-full bg-gray-50 dark:bg-slate-800 rounded-2xl px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-slate-700 focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="What is this event about?"
                  className="w-full bg-gray-50 dark:bg-slate-800 rounded-2xl px-4 py-2.5 text-sm text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-slate-700 focus:border-brand-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Guest Speaker
                  </label>
                  <input
                    type="text"
                    value={newGuestName}
                    onChange={(e) => setNewGuestName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    className="w-full bg-gray-50 dark:bg-slate-800 rounded-2xl px-3.5 py-2 text-xs text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-slate-800 rounded-2xl px-3.5 py-2 text-xs text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-full text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newTitle.trim()}
                  className="btn-primary text-xs py-2 px-5"
                >
                  {creating ? 'Scheduling...' : 'Schedule Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Guest Auth Prompt */}
      <GuestAuthModal
        isOpen={guestAuthOpen}
        onClose={() => setGuestAuthOpen(false)}
        actionTitle="Join Community Events"
        actionDescription={guestModalDesc}
      />
    </div>
  )
}
