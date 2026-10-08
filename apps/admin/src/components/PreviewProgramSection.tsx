'use client'

import React, { useState } from 'react'
import {
  Sparkles,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Send,
  MessageSquare,
  Filter,
  Check,
  X,
  ExternalLink,
  ShieldCheck,
  ListOrdered
} from 'lucide-react'

interface PreviewProgramProps {
  programs: any[]
  participants: any[]
  feedback: any[]
  tasks: any[]
  onRefresh: () => void
  onAwardBadge: (userId: string, badgeId: string, reason: string) => Promise<boolean>
  onReviewFeedback: (feedbackId: string, status: string, notes: string) => Promise<boolean>
}

export function PreviewProgramSection({
  programs,
  participants,
  feedback,
  tasks,
  onRefresh,
  onAwardBadge,
  onReviewFeedback,
}: PreviewProgramProps) {
  const [tab, setTab] = useState<'programs' | 'participants' | 'feedback' | 'tasks'>('programs')
  const [feedbackFilter, setFeedbackFilter] = useState<string>('all')
  const [reviewNotes, setReviewNotes] = useState<{ [key: string]: string }>({})
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const activeProgram = programs[0] || {
    title: 'Genesis Preview Program',
    status: 'open',
    min_tasks_required: 1,
    min_valid_feedback_required: 1,
  }

  const validFeedbackCount = feedback.filter((f) => f.status === 'valid').length
  const pendingFeedbackCount = feedback.filter((f) => f.status === 'pending').length
  const eligibleParticipants = participants.filter(
    (p) =>
      p.status === 'eligible' ||
      (p.tasks_completed >= (activeProgram.min_tasks_required || 1) &&
        p.valid_feedback_count >= (activeProgram.min_valid_feedback_required || 1))
  )

  const handleReview = async (feedbackId: string, status: string) => {
    const notes = reviewNotes[feedbackId] || `Marked as ${status} by admin reviewer.`
    setActionLoading(feedbackId)
    await onReviewFeedback(feedbackId, status, notes)
    setActionLoading(null)
    onRefresh()
  }

  const handleGrantEarlySupporter = async (userId: string, username: string) => {
    if (!confirm(`Award permanent Early Supporter badge to @${username}?`)) return
    setActionLoading(userId)
    await onAwardBadge(userId, 'early_supporter', 'Completed Preview Program verification requirements.')
    setActionLoading(null)
    onRefresh()
  }

  const handleGrantBetaTester = async (userId: string, username: string) => {
    if (!confirm(`Award Beta Tester badge to @${username}?`)) return
    setActionLoading(userId)
    await onAwardBadge(userId, 'beta_tester', 'Submitted verified beta feedback and testing tasks.')
    setActionLoading(null)
    onRefresh()
  }

  return (
    <div className="space-y-6">
      {/* Metric Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase">Program Status</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              {activeProgram.status?.toUpperCase() || 'OPEN'}
            </span>
          </div>
          <p className="text-xl font-bold text-white mt-2 truncate">{activeProgram.title}</p>
          <p className="text-[11px] text-slate-500 mt-1">Min 1 Task &bull; Min 1 Valid Feedback</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase">Registered Testers</span>
            <span className="text-purple-400 font-bold font-mono">{participants.length}</span>
          </div>
          <p className="text-2xl font-bold text-white mt-2">{eligibleParticipants.length}</p>
          <p className="text-[11px] text-purple-400 mt-1">Eligible for Early Supporter Badge</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase">Pending Feedback</span>
            <span className="text-amber-400 font-mono font-bold">{pendingFeedbackCount}</span>
          </div>
          <p className="text-2xl font-bold text-amber-400 mt-2">{pendingFeedbackCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">Requires reviewer validation</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase">Valid Feedback</span>
            <span className="text-emerald-400 font-mono font-bold">{validFeedbackCount}</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-2">{validFeedbackCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">Validated triage submissions</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
        <button
          onClick={() => setTab('programs')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            tab === 'programs'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          Programs & Settings
        </button>
        <button
          onClick={() => setTab('participants')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            tab === 'participants'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          Participants ({participants.length})
        </button>
        <button
          onClick={() => setTab('feedback')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
            tab === 'feedback'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <span>Feedback Queue</span>
          {pendingFeedbackCount > 0 && (
            <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded-full text-[10px] border border-amber-500/30">
              {pendingFeedbackCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('tasks')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            tab === 'tasks'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          Testing Tasks ({tasks.length})
        </button>
      </div>

      {/* Tab 1: Programs & Configuration */}
      {tab === 'programs' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles size={16} className="text-purple-400" />
                  <span>Preview Program Architecture</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Server-enforced preview cycles, qualification rules, and badge milestones.
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 bg-purple-950/60 text-purple-300 border border-purple-800/40 rounded-xl font-mono">
                Auto-Award Engine: Active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-2">
                <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Early Supporter Rule</span>
                <p className="text-white font-medium">
                  Users who join the Genesis Preview, complete at least 1 verified test scenario, and have at least 1 validated feedback submission unlock the permanent Early Supporter distinction.
                </p>
                <div className="text-[11px] text-purple-400 font-mono">
                  &bull; Badges remain permanent after program closure.
                </div>
              </div>

              <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-2">
                <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Beta Tester Rule</span>
                <p className="text-white font-medium">
                  Users who submit reproducible bug reports or stress-test encrypted whispers receive the dedicated Beta Tester badge.
                </p>
                <div className="text-[11px] text-emerald-400 font-mono">
                  &bull; Transactional audit record logged on grant.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Participants */}
      {tab === 'participants' && (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-800/80">
              <tr>
                <th className="p-4">Participant</th>
                <th className="p-4">Tasks Done</th>
                <th className="p-4">Valid Feedback</th>
                <th className="p-4">Eligibility Status</th>
                <th className="p-4">Awarded Badges</th>
                <th className="p-4 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {participants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-mono">
                    No preview participants registered yet.
                  </td>
                </tr>
              ) : (
                participants.map((p) => {
                  const isEligible =
                    p.status === 'eligible' ||
                    (p.tasks_completed >= 1 && p.valid_feedback_count >= 1)
                  return (
                    <tr key={p.id} className="hover:bg-slate-850/40 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-purple-900/60 border border-purple-700/60 text-purple-200 font-bold flex items-center justify-center text-xs">
                            {p.profile?.username?.charAt(0).toUpperCase() || 'P'}
                          </div>
                          <div>
                            <span className="font-semibold text-white block">
                              @{p.profile?.username || 'user'}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Joined {new Date(p.registered_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-slate-300">{p.tasks_completed}</td>
                      <td className="p-4 font-mono text-slate-300">{p.valid_feedback_count}</td>
                      <td className="p-4">
                        {isEligible ? (
                          <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-md font-semibold text-[10px] inline-flex items-center gap-1">
                            <CheckCircle2 size={11} /> Eligible
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded-md text-[10px] font-medium inline-flex items-center gap-1">
                            <Clock size={11} /> In Progress
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {p.early_supporter_awarded && (
                            <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded text-[10px] border border-purple-500/30">
                              Early Supporter
                            </span>
                          )}
                          {p.beta_tester_awarded && (
                            <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded text-[10px] border border-blue-500/30">
                              Beta Tester
                            </span>
                          )}
                          {!p.early_supporter_awarded && !p.beta_tester_awarded && (
                            <span className="text-slate-500 text-[10px]">None</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleGrantEarlySupporter(p.user_id, p.profile?.username)}
                            disabled={actionLoading === p.user_id}
                            className="px-2.5 py-1 bg-purple-600/80 hover:bg-purple-600 text-white rounded-lg text-[10px] font-semibold transition-all disabled:opacity-50"
                          >
                            + Early Supporter
                          </button>
                          <button
                            onClick={() => handleGrantBetaTester(p.user_id, p.profile?.username)}
                            disabled={actionLoading === p.user_id}
                            className="px-2.5 py-1 bg-blue-600/80 hover:bg-blue-600 text-white rounded-lg text-[10px] font-semibold transition-all disabled:opacity-50"
                          >
                            + Beta Tester
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Feedback Queue */}
      {tab === 'feedback' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold">Filter:</span>
              {['all', 'pending', 'valid', 'duplicate', 'invalid'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFeedbackFilter(status)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium capitalize transition-all ${
                    feedbackFilter === status
                      ? 'bg-slate-800 text-white font-bold'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Total Submissions: {feedback.length}
            </span>
          </div>

          <div className="space-y-3">
            {feedback.length === 0 ? (
              <div className="p-8 text-center text-slate-500 font-mono bg-slate-900/60 rounded-2xl border border-slate-800/80">
                No feedback submitted yet.
              </div>
            ) : (
              feedback
                .filter((f) => feedbackFilter === 'all' || f.status === feedbackFilter)
                .map((f) => (
                  <div
                    key={f.id}
                    className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-3 hover:border-slate-700/80 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white">{f.title}</span>
                          <span className="px-2 py-0.5 rounded-md bg-purple-950/80 text-purple-300 font-mono text-[10px] border border-purple-800/40 uppercase">
                            {f.category}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-semibold ${
                              f.status === 'valid'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : f.status === 'pending'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {f.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-2 leading-relaxed">{f.content}</p>
                        <span className="text-[10px] text-slate-500 font-mono block mt-2">
                          Submitted by @{f.user?.username || 'user'} &bull; {new Date(f.created_at).toLocaleString()}
                        </span>
                      </div>

                      {/* Review Action Controls */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleReview(f.id, 'valid')}
                            disabled={actionLoading === f.id || f.status === 'valid'}
                            className="px-2.5 py-1 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/60 rounded-lg text-[11px] font-semibold flex items-center gap-1 disabled:opacity-40"
                          >
                            <Check size={12} />
                            <span>Mark Valid</span>
                          </button>
                          <button
                            onClick={() => handleReview(f.id, 'duplicate')}
                            disabled={actionLoading === f.id || f.status === 'duplicate'}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-semibold disabled:opacity-40"
                          >
                            Duplicate
                          </button>
                          <button
                            onClick={() => handleReview(f.id, 'invalid')}
                            disabled={actionLoading === f.id || f.status === 'invalid'}
                            className="px-2.5 py-1 bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-800/40 rounded-lg text-[11px] font-semibold flex items-center gap-1 disabled:opacity-40"
                          >
                            <X size={12} />
                            <span>Invalid</span>
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="Optional review note..."
                          value={reviewNotes[f.id] || ''}
                          onChange={(e) => setReviewNotes({ ...reviewNotes, [f.id]: e.target.value })}
                          className="w-48 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Testing Tasks */}
      {tab === 'tasks' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ListOrdered size={16} className="text-purple-400" />
              <span>Program Testing Milestones</span>
            </h3>
            <div className="space-y-2">
              <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white">1. Encrypted Whisper Delivery</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Send at least one anonymous voice or text whisper to another profile and verify one-way privacy.
                  </p>
                </div>
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-mono">Active</span>
              </div>

              <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white">2. Audio Story & Mentions Test</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Record a 24-hour audio story, tag a community member, and check push notification delivery.
                  </p>
                </div>
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-mono">Active</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
