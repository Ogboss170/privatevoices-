'use client'

import React, { useState, useEffect } from 'react'
import { ShieldCheck, Award, AlertTriangle, Check, X, RefreshCw, Eye, Search, Filter } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { PlatformBadge } from '@/components/common/PlatformBadge'

interface ReferralAuditRow {
  id: string
  inviter_id: string
  referred_id: string
  status: 'pending' | 'qualified' | 'flagged_bot' | 'flagged_duplicate' | 'revoked'
  qualifying_reason: string
  client_ip: string | null
  created_at: string
  inviter?: {
    id: string
    username: string
    display_name: string
    avatar_url: string | null
  }
  referred?: {
    id: string
    username: string
    display_name: string
    avatar_url: string | null
  }
}

export default function AdminReferralReviewQueue(): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const [audits, setAudits] = useState<ReferralAuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [actionBusy, setActionBusy] = useState<string | null>(null)
  const [searchUsername, setSearchUsername] = useState('')

  useEffect(() => {
    loadAudits()
  }, [])

  async function loadAudits() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('referral_audits')
        .select(`
          id,
          inviter_id,
          referred_id,
          status,
          qualifying_reason,
          client_ip,
          created_at,
          inviter:profiles!referral_audits_inviter_id_fkey(id, username, display_name, avatar_url),
          referred:profiles!referral_audits_referred_id_fkey(id, username, display_name, avatar_url)
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (data && !error) {
        setAudits(data as any)
      } else if (error) {
        // Fallback simple query if FK joins are not exposed
        const simple = await supabase
          .from('referral_audits')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100)
        setAudits((simple.data as any) || [])
      }
    } catch (err) {
      console.error('Failed loading referral audits:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateStatus(auditId: string, newStatus: 'qualified' | 'flagged_bot' | 'flagged_duplicate' | 'revoked', inviterId: string) {
    setActionBusy(auditId)
    try {
      const { data: userRes } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('referral_audits')
        .update({
          status: newStatus,
          reviewed_by: userRes.user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', auditId)

      if (!error) {
        setAudits((prev) =>
          prev.map((a) => (a.id === auditId ? { ...a, status: newStatus } : a))
        )
        // Re-evaluate inviter's badges
        await supabase.rpc('evaluate_and_award_referral_badges', { p_inviter_id: inviterId })
      } else {
        alert(`Failed to update referral status: ${error.message}`)
      }
    } catch (err: any) {
      alert(`Error updating referral: ${err.message}`)
    } finally {
      setActionBusy(null)
    }
  }

  const filteredAudits = audits.filter((a) => {
    if (filterStatus !== 'all' && a.status !== filterStatus) return false
    if (searchUsername.trim()) {
      const q = searchUsername.toLowerCase()
      const invMatch = a.inviter?.username?.toLowerCase().includes(q) || a.inviter_id.includes(q)
      const refMatch = a.referred?.username?.toLowerCase().includes(q) || a.referred_id.includes(q)
      return invMatch || refMatch
    }
    return true
  })

  return (
    <div className="card p-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-brand-600 uppercase tracking-wider mb-1">
            <ShieldCheck size={14} />
            <span>Integrity & Growth Governance</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Referral Rewards Review Queue
          </h3>
          <p className="text-xs text-gray-500">
            Review invitations, audit bot flags, and verify Community Ambassador & Legendary Builder qualification.
          </p>
        </div>

        <button
          onClick={loadAudits}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 text-xs font-semibold text-gray-700 dark:text-gray-300 self-start sm:self-auto"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by username or user ID..."
            value={searchUsername}
            onChange={(e) => setSearchUsername(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white focus:outline-none"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-700 dark:text-gray-300 font-semibold focus:outline-none"
        >
          <option value="all">All Statuses ({audits.length})</option>
          <option value="qualified">Qualified</option>
          <option value="flagged_bot">Flagged Bot</option>
          <option value="flagged_duplicate">Duplicate</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>

      {/* Audits Table */}
      {loading ? (
        <div className="py-12 text-center text-xs text-gray-400">Loading referral audits...</div>
      ) : filteredAudits.length === 0 ? (
        <div className="py-12 text-center text-xs text-gray-400 bg-gray-50 dark:bg-slate-800/40 rounded-2xl">
          No referral records match your filters.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-800 text-gray-400 uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Inviter</th>
                <th className="py-2.5 px-3">Referred Member</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Reason / Details</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
              {filteredAudits.map((row) => {
                const isBusy = actionBusy === row.id
                return (
                  <tr key={row.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-3 font-medium text-gray-900 dark:text-white">
                      {row.inviter?.username ? `@${row.inviter.username}` : row.inviter_id.slice(0, 8)}
                    </td>
                    <td className="py-3 px-3 text-gray-700 dark:text-gray-300">
                      {row.referred?.username ? `@${row.referred.username}` : row.referred_id.slice(0, 8)}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.status === 'qualified'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : row.status === 'flagged_bot'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : row.status === 'flagged_duplicate'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-500 text-[11px] max-w-[200px] truncate">
                      {row.qualifying_reason}
                    </td>
                    <td className="py-3 px-3 text-gray-400 text-[11px]">
                      {new Date(row.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3 text-right space-x-1">
                      {row.status !== 'qualified' && (
                        <button
                          disabled={isBusy}
                          onClick={() => handleUpdateStatus(row.id, 'qualified', row.inviter_id)}
                          className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold text-[10px]"
                          title="Mark Qualified"
                        >
                          Approve
                        </button>
                      )}
                      {row.status !== 'flagged_bot' && (
                        <button
                          disabled={isBusy}
                          onClick={() => handleUpdateStatus(row.id, 'flagged_bot', row.inviter_id)}
                          className="px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 font-semibold text-[10px]"
                          title="Flag as Bot"
                        >
                          Flag Bot
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
