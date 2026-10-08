'use client'

import React, { useState } from 'react'
import {
  ShieldCheck,
  Sparkles,
  Bug,
  Award,
  Search,
  RotateCcw,
  Plus,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'

interface BadgeManagementProps {
  badgeDefinitions: any[]
  userBadges: any[]
  users: any[]
  onRefresh: () => void
  onAwardBadge: (userId: string, badgeId: string, reason: string) => Promise<boolean>
  onRevokeBadge: (userId: string, badgeId: string, reason: string) => Promise<boolean>
}

export function BadgeManagementSection({
  badgeDefinitions,
  userBadges,
  users,
  onRefresh,
  onAwardBadge,
  onRevokeBadge,
}: BadgeManagementProps) {
  const [targetUserId, setTargetUserId] = useState('')
  const [selectedBadge, setSelectedBadge] = useState('verified')
  const [awardReason, setAwardReason] = useState('')
  const [revokeReason, setRevokeReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [searchUser, setSearchUser] = useState('')

  const handleAward = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetUserId || !awardReason.trim()) return
    setSubmitting(true)
    const success = await onAwardBadge(targetUserId, selectedBadge, awardReason.trim())
    setSubmitting(false)
    if (success) {
      setAwardReason('')
      setTargetUserId('')
      onRefresh()
    }
  }

  const handleRevoke = async (userId: string, badgeId: string) => {
    const reason = prompt('Please enter the mandatory reason for badge revocation:')
    if (!reason || !reason.trim()) {
      alert('Revocation canceled: A mandatory reason is required for administrative audit logs.')
      return
    }
    const success = await onRevokeBadge(userId, badgeId, reason.trim())
    if (success) {
      onRefresh()
    }
  }

  return (
    <div className="space-y-6">
      {/* 3 Core Badge Types Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Verified Account</span>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              </h4>
              <span className="text-[11px] text-slate-400">Trust & Identity Verification</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3 leading-relaxed">
            Blue verification check granted exclusively through authorized Trust & Safety review. Preview participation alone never grants this badge.
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <Sparkles size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Early Supporter</span>
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              </h4>
              <span className="text-[11px] text-purple-400">Permanent Distinction</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3 leading-relaxed">
            Permanent badge for eligible preview participants. Remains active permanently after preview cycle closes.
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Bug size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Beta Tester</span>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              </h4>
              <span className="text-[11px] text-indigo-400">Rigorous Testing Distinction</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3 leading-relaxed">
            Awarded to testers who submit validated bug reports, stress tests, or UX triage feedback.
          </p>
        </div>
      </div>

      {/* Manual Award Modal/Panel */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-4">
        <div className="border-b border-slate-800/80 pb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Award size={16} className="text-purple-400" />
            <span>Authorized Badge Award Console</span>
          </h3>
          <span className="text-[11px] font-mono text-slate-500">
            Enforced: Duplicate Award Protection
          </span>
        </div>

        <form onSubmit={handleAward} className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Select User</label>
            <select
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
            >
              <option value="">-- Choose Account --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  @{u.username} ({u.display_name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Badge Type</label>
            <select
              value={selectedBadge}
              onChange={(e) => setSelectedBadge(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
            >
              <option value="verified">Verified (ShieldCheck)</option>
              <option value="early_supporter">Early Supporter (Permanent)</option>
              <option value="beta_tester">Beta Tester (Testing)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Mandatory Audit Reason</label>
            <input
              type="text"
              required
              placeholder="e.g. Identity verified via passport docs"
              value={awardReason}
              onChange={(e) => setAwardReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500 placeholder-slate-600"
            >
            </input>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting || !targetUserId || !awardReason.trim()}
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-purple-600/20 transition-all flex items-center justify-center gap-1.5"
            >
              <Plus size={14} />
              <span>{submitting ? 'Awarding...' : 'Award Badge'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Active User Badges Roster */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Active Badge Registry ({userBadges.length})
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            Append-only Audit Log Connected
          </span>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-800/80">
            <tr>
              <th className="p-4">User</th>
              <th className="p-4">Badge</th>
              <th className="p-4">Source</th>
              <th className="p-4">Awarded At</th>
              <th className="p-4 text-right">Revocation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {userBadges.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500 font-mono">
                  No active badges awarded in the database yet.
                </td>
              </tr>
            ) : (
              userBadges.map((b) => (
                <tr key={b.id} className="hover:bg-slate-850/40 transition-colors">
                  <td className="p-4">
                    <span className="font-semibold text-white block">
                      @{b.profile?.username || b.user_id.substring(0, 8)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{b.user_id}</span>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-0.5 rounded-md font-semibold text-[10px] inline-flex items-center gap-1.5 ${
                        b.badge_id === 'verified'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : b.badge_id === 'early_supporter'
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      }`}
                    >
                      {b.badge_id === 'verified' && <ShieldCheck size={12} />}
                      {b.badge_id === 'early_supporter' && <Sparkles size={12} />}
                      {b.badge_id === 'beta_tester' && <Bug size={12} />}
                      <span>{b.badge_id}</span>
                    </span>
                  </td>
                  <td className="p-4 font-mono text-slate-400 text-[11px]">{b.source}</td>
                  <td className="p-4 font-mono text-slate-400 text-[11px]">
                    {new Date(b.awarded_at).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleRevoke(b.user_id, b.badge_id)}
                      className="px-2.5 py-1 text-[10px] font-semibold bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/40 rounded-lg transition-all"
                    >
                      Revoke (Audited)
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
