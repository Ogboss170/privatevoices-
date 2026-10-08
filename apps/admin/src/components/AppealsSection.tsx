'use client'

import React, { useState } from 'react'
import {
  ShieldAlert,
  CheckCircle,
  XCircle,
  Clock,
  RotateCcw,
  UserCheck,
  AlertTriangle
} from 'lucide-react'

interface AppealsSectionProps {
  appeals: any[]
  onRefresh: () => void
  onReviewAppeal: (appealId: string, status: string, notes: string) => Promise<boolean>
}

export function AppealsSection({ appeals, onRefresh, onReviewAppeal }: AppealsSectionProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'under_review' | 'approved' | 'rejected'>('pending')
  const [reviewNotes, setReviewNotes] = useState<{ [key: string]: string }>({})
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleDecision = async (appealId: string, status: 'approved' | 'rejected' | 'under_review') => {
    const notes = reviewNotes[appealId] || `Appeal marked as ${status} after administrative review.`
    setLoadingId(appealId)
    await onReviewAppeal(appealId, status, notes)
    setLoadingId(null)
    onRefresh()
  }

  const pendingCount = appeals.filter((a) => a.status === 'pending').length

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldAlert size={16} className="text-amber-400" />
            <span>Moderation Appeals Queue</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Review user appeals challenging account suspensions, strikes, and removed content.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'pending', 'under_review', 'approved', 'rejected'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                filter === st
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {appeals.length === 0 ? (
          <div className="p-8 text-center text-slate-500 font-mono bg-slate-900/60 rounded-2xl border border-slate-800/80">
            No moderation appeals recorded.
          </div>
        ) : (
          appeals
            .filter((a) => filter === 'all' || a.status === filter)
            .map((a) => (
              <div
                key={a.id}
                className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-4 hover:border-slate-700/80 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-white">
                        Appeal for: {a.action_type?.replace('_', ' ').toUpperCase()}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-semibold ${
                          a.status === 'approved'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : a.status === 'rejected'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {a.status?.toUpperCase()}
                      </span>
                    </div>

                    <div className="mt-2 p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 text-xs">
                      <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider mb-1">
                        Original Decision:
                      </span>
                      <p className="text-slate-300 italic">{a.original_decision_summary || 'Account policy violation enforcement'}</p>
                    </div>

                    <div className="mt-2 p-3 bg-purple-950/20 rounded-xl border border-purple-900/30 text-xs">
                      <span className="text-purple-400 block text-[10px] uppercase font-bold tracking-wider mb-1">
                        Appellant Reason:
                      </span>
                      <p className="text-purple-200">{a.appeal_reason}</p>
                    </div>

                    <span className="text-[10px] text-slate-500 font-mono block mt-2">
                      Appellant ID: {a.user_id} &bull; Submitted {new Date(a.created_at).toLocaleString()}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleDecision(a.id, 'approved')}
                        disabled={loadingId === a.id || a.status === 'approved'}
                        className="px-3 py-1 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/60 rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40"
                      >
                        <CheckCircle size={13} />
                        <span>Approve & Restore</span>
                      </button>
                      <button
                        onClick={() => handleDecision(a.id, 'rejected')}
                        disabled={loadingId === a.id || a.status === 'rejected'}
                        className="px-3 py-1 bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/60 rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40"
                      >
                        <XCircle size={13} />
                        <span>Reject</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Reviewer justification note..."
                      value={reviewNotes[a.id] || ''}
                      onChange={(e) => setReviewNotes({ ...reviewNotes, [a.id]: e.target.value })}
                      className="w-56 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  )
}
