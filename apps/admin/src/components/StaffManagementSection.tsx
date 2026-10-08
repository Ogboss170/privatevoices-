'use client'

import React, { useState } from 'react'
import {
  ShieldAlert,
  UserCheck,
  UserX,
  KeyRound,
  Shield,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  History,
  Lock
} from 'lucide-react'
import { SupabaseClient } from '@supabase/supabase-js'

interface StaffManagementSectionProps {
  supabase: SupabaseClient
  staff: any[]
  users: any[]
  currentAdminUser: any
  onRefresh: () => void
}

export function StaffManagementSection({
  supabase,
  staff,
  users,
  currentAdminUser,
  onRefresh,
}: StaffManagementSectionProps) {
  const [targetUserId, setTargetUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState('ADMIN')
  const [assignReason, setAssignReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const isSuperAdmin = currentAdminUser?.is_super_admin || currentAdminUser?.roles?.includes('SUPER_ADMIN')

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetUserId || !assignReason.trim()) return

    if (selectedRole === 'SUPER_ADMIN' && !isSuperAdmin) {
      alert('Security Policy: Only an existing Super Admin can assign the SUPER_ADMIN role.')
      return
    }

    setSubmitting(true)
    try {
      const { data, error } = await supabase.rpc('admin_assign_role', {
        p_target_user_id: targetUserId,
        p_role: selectedRole,
        p_reason: assignReason.trim(),
      })

      if (error) {
        alert(`Error assigning role: ${error.message}`)
      } else if (!data?.success) {
        alert(`Role assignment denied: ${data?.error || 'Unauthorized'}`)
      } else {
        alert(`Successfully assigned ${selectedRole} role with audit logging.`)
        setTargetUserId('')
        setAssignReason('')
        onRefresh()
      }
    } catch (err: any) {
      alert(`Assignment failed: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRevokeRole = async (userId: string, role: string, username: string) => {
    const reason = prompt(`Enter mandatory reason to revoke ${role} from @${username}:`)
    if (!reason || !reason.trim()) {
      alert('Revocation canceled: Mandatory reason required.')
      return
    }

    setActionLoading(`${userId}-${role}`)
    try {
      const { data, error } = await supabase.rpc('admin_revoke_role', {
        p_target_user_id: userId,
        p_role: role,
        p_reason: reason.trim(),
      })

      if (error) {
        alert(`Error: ${error.message}`)
      } else if (!data?.success) {
        if (data?.error === 'CANNOT_REMOVE_LAST_SUPER_ADMIN') {
          alert('Security Violation Prevented: You cannot revoke the platform\'s last active Super Admin account.')
        } else {
          alert(`Revocation failed: ${data?.error}`)
        }
      } else {
        alert(`Role ${role} revoked successfully.`)
        onRefresh()
      }
    } catch (err: any) {
      alert(`Revocation failed: ${err.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDisableStaff = async (userId: string, username: string) => {
    const reason = prompt(`CRITICAL CONFIRMATION: Enter mandatory reason to completely DISABLE staff access for @${username}:`)
    if (!reason || !reason.trim()) {
      alert('Action aborted: Reason required.')
      return
    }

    setActionLoading(userId)
    try {
      const { data, error } = await supabase.rpc('admin_disable_staff', {
        p_target_user_id: userId,
        p_reason: reason.trim(),
      })

      if (error) {
        alert(`Error: ${error.message}`)
      } else if (!data?.success) {
        if (data?.error === 'CANNOT_DISABLE_LAST_SUPER_ADMIN') {
          alert('Security Lockout Prevented: Cannot disable the sole active Super Admin account.')
        } else {
          alert(`Failed: ${data?.error}`)
        }
      } else {
        alert(`Staff administrator @${username} disabled and removed from all roles.`)
        onRefresh()
      }
    } catch (err: any) {
      alert(`Action failed: ${err.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldAlert size={16} className="text-purple-400" />
            <span>Super Admin & Staff Governance Directory</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Server-enforced role assignments, granular permissions, session management, and last-Super-Admin lockout defense.
          </p>
        </div>
        <span className="text-xs px-2.5 py-1 bg-purple-950/60 text-purple-300 border border-purple-800/40 rounded-xl font-mono">
          Immutable RBAC Policies Active
        </span>
      </div>

      {/* Provisioning / Role Assignment Panel */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-4">
        <div className="border-b border-slate-800/80 pb-3 flex items-center justify-between">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <KeyRound size={15} className="text-purple-400" />
            <span>Assign Role or Provision Staff</span>
          </h4>
          <span className="text-[11px] font-mono text-slate-500">
            Audit logging: Mandatory reason enforced
          </span>
        </div>

        <form onSubmit={handleAssignRole} className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Select User Profile</label>
            <select
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
            >
              <option value="">-- Choose User --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  @{u.username} ({u.display_name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Administrative Role</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
            >
              <option value="SUPER_ADMIN">SUPER_ADMIN (Full Platform Authority)</option>
              <option value="ADMIN">ADMIN (Operations & Content Moderation)</option>
              <option value="MODERATOR">MODERATOR (Queue & Strikes)</option>
              <option value="SUPPORT">SUPPORT (Reports & Appeals)</option>
              <option value="PREVIEW_REVIEWER">PREVIEW_REVIEWER (Feedback & Badges)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Mandatory Audit Justification</label>
            <input
              type="text"
              required
              placeholder="e.g. Promoted to Head of Trust & Safety"
              value={assignReason}
              onChange={(e) => setAssignReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500 placeholder-slate-600"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting || !targetUserId || !assignReason.trim()}
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-purple-600/20 transition-all flex items-center justify-center gap-1.5"
            >
              <Plus size={14} />
              <span>{submitting ? 'Assigning...' : 'Assign Role'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Staff Roster */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Active Staff Directory ({staff.length})
          </span>
          <span className="text-[11px] font-mono text-emerald-400">
            Last-Super-Admin Lockout Protection Enabled
          </span>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-800/80">
            <tr>
              <th className="p-4">Administrator</th>
              <th className="p-4">Assigned Roles</th>
              <th className="p-4">Account Status</th>
              <th className="p-4">Notes / Reason</th>
              <th className="p-4 text-right">Privileged Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {staff.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500 font-mono">
                  No staff accounts provisioned yet.
                </td>
              </tr>
            ) : (
              staff.map((s) => (
                <tr key={s.user_id} className="hover:bg-slate-850/40 transition-colors">
                  <td className="p-4">
                    <span className="font-semibold text-white block">
                      @{s.username || s.user_id.substring(0, 8)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{s.user_id}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(!s.roles || s.roles.length === 0) ? (
                        <span className="text-slate-500 text-[10px]">Legacy Admin</span>
                      ) : (
                        s.roles.map((r: string) => (
                          <span
                            key={r}
                            className={`px-2 py-0.5 rounded-md font-semibold text-[10px] inline-flex items-center gap-1 ${
                              r === 'SUPER_ADMIN'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold'
                                : r === 'ADMIN'
                                ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            <span>{r}</span>
                            <button
                              onClick={() => handleRevokeRole(s.user_id, r, s.username)}
                              disabled={actionLoading === `${s.user_id}-${r}`}
                              className="text-slate-400 hover:text-red-400 ml-1"
                              title="Revoke role"
                            >
                              &times;
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    {s.is_banned ? (
                      <span className="px-2 py-0.5 bg-red-500/10 text-red-400 rounded text-[10px] font-semibold border border-red-500/20">
                        Suspended
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-semibold border border-emerald-500/20">
                        Active Staff
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-slate-400 text-xs italic max-w-xs truncate">
                    {s.notes || 'Platform staff assignment'}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleDisableStaff(s.user_id, s.username)}
                      disabled={actionLoading === s.user_id}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/40 rounded-lg transition-all disabled:opacity-40"
                    >
                      Disable Staff Access
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
