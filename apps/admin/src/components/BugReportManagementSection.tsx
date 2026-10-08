'use client'

import React, { useState } from 'react'
import {
  Bug,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  Filter,
  MessageSquare,
  ShieldAlert,
  Search,
  Plus,
  Send,
  ExternalLink
} from 'lucide-react'
import { SupabaseClient } from '@supabase/supabase-js'

interface BugReportManagementProps {
  supabase: SupabaseClient
  reports: any[]
  staff: any[]
  currentAdminUser: any
  onRefresh: () => void
  onOpenReportModal: () => void
}

export function BugReportManagementSection({
  supabase,
  reports,
  staff,
  currentAdminUser,
  onRefresh,
  onOpenReportModal,
}: BugReportManagementProps) {
  const [selectedReport, setSelectedReport] = useState<any | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [newComment, setNewComment] = useState('')
  const [updating, setUpdating] = useState(false)
  const [internalNotes, setInternalNotes] = useState('')

  const isSuperAdmin = currentAdminUser?.is_super_admin || currentAdminUser?.roles?.includes('SUPER_ADMIN')

  const filteredReports = reports.filter((r) => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter
    const matchesSeverity = severityFilter === 'all' || r.severity === severityFilter
    const matchesSearch =
      !search ||
      r.title?.toLowerCase().includes(search.toLowerCase()) ||
      r.category?.toLowerCase().includes(search.toLowerCase()) ||
      r.id?.toLowerCase().includes(search.toLowerCase())
    return matchesStatus && matchesSeverity && matchesSearch
  })

  const handleUpdateStatus = async (reportId: string, newStatus: string) => {
    setUpdating(true)
    try {
      const { data, error } = await supabase.rpc('admin_update_bug_report', {
        p_report_id: reportId,
        p_status: newStatus,
        p_internal_notes: internalNotes.trim() || `Status updated to ${newStatus}`,
      })

      if (error) {
        alert(`Error: ${error.message}`)
      } else if (!data?.success) {
        alert(`Failed: ${data?.error}`)
      } else {
        setInternalNotes('')
        onRefresh()
        if (selectedReport?.id === reportId) {
          setSelectedReport({ ...selectedReport, status: newStatus })
        }
      }
    } catch (err: any) {
      alert(`Update failed: ${err.message}`)
    } finally {
      setUpdating(false)
    }
  }

  const handleAssignOwner = async (reportId: string, assignedToId: string) => {
    setUpdating(true)
    try {
      const { data, error } = await supabase.rpc('admin_update_bug_report', {
        p_report_id: reportId,
        p_assigned_to_id: assignedToId || null,
        p_internal_notes: 'Owner reassigned',
      })

      if (error) {
        alert(`Error: ${error.message}`)
      } else if (!data?.success) {
        alert(`Failed: ${data?.error}`)
      } else {
        onRefresh()
      }
    } catch (err: any) {
      alert(`Assign failed: ${err.message}`)
    } finally {
      setUpdating(false)
    }
  }

  const handleAddComment = async (reportId: string) => {
    if (!newComment.trim()) return
    setUpdating(true)
    try {
      const { error } = await supabase.from('admin_bug_report_comments').insert({
        bug_report_id: reportId,
        author_id: currentAdminUser.id,
        body: newComment.trim(),
      })

      if (error) {
        alert(`Error: ${error.message}`)
      } else {
        setNewComment('')
        onRefresh()
      }
    } catch (err: any) {
      alert(`Failed: ${err.message}`)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Bug size={16} className="text-purple-400" />
            <span>Staff Bug Reports & Defect Pipeline</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Track, triage, and resolve technical issues filed by staff administrators with audit-logged resolution workflows.
          </p>
        </div>

        <button
          onClick={onOpenReportModal}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/25 transition-all flex items-center gap-2 shrink-0"
        >
          <Plus size={14} />
          <span>Report a Bug</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/40 p-3.5 rounded-2xl border border-slate-800/60 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400 font-semibold">Status:</span>
          {['all', 'Open', 'Triaged', 'In Progress', 'Resolved', 'Closed'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                statusFilter === s
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-white bg-slate-950'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-semibold">Severity:</span>
          {['all', 'Critical', 'High', 'Medium', 'Low'].map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                severityFilter === sev
                  ? 'bg-slate-800 text-white font-bold'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-800/80">
            <tr>
              <th className="p-4">Report Details</th>
              <th className="p-4">Category</th>
              <th className="p-4">Severity</th>
              <th className="p-4">Status</th>
              <th className="p-4">Assigned To</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredReports.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500 font-mono">
                  No bug reports matching current filters.
                </td>
              </tr>
            ) : (
              filteredReports.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelectedReport(r)}
                  className="hover:bg-slate-850/40 transition-colors cursor-pointer"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white block">{r.title}</span>
                      {r.is_security_sensitive && (
                        <span className="px-1.5 py-0.2 bg-red-950/80 text-red-300 text-[10px] rounded font-mono border border-red-800/50">
                          Security
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Filed {new Date(r.created_at).toLocaleDateString()} by @{r.reporter?.username || 'staff'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 bg-slate-800 rounded text-slate-300 font-mono text-[10px]">
                      {r.category}
                    </span>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                        r.severity === 'Critical'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : r.severity === 'High'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : r.severity === 'Medium'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {r.severity}
                    </span>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                        r.status === 'Resolved' || r.status === 'Closed'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : r.status === 'In Progress'
                          ? 'bg-blue-500/20 text-blue-300'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="p-4 text-slate-400 text-xs">
                    {r.assignee ? `@${r.assignee.username}` : <span className="text-slate-600">Unassigned</span>}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedReport(r)
                      }}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-semibold"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Selected Report Inspector Drawer/Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 md:p-8 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-800/80 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{selectedReport.title}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800/40">
                    {selectedReport.category}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  ID: {selectedReport.id} &bull; Created {new Date(selectedReport.created_at).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-slate-400 hover:text-white p-1 text-base font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <span className="text-slate-400 font-semibold block uppercase text-[10px] tracking-wider mb-1">
                  Description
                </span>
                <p className="p-3 bg-slate-950 rounded-xl text-slate-200 leading-relaxed border border-slate-800">
                  {selectedReport.description}
                </p>
              </div>

              {selectedReport.reproduction_steps && (
                <div>
                  <span className="text-slate-400 font-semibold block uppercase text-[10px] tracking-wider mb-1">
                    Reproduction Steps
                  </span>
                  <p className="p-3 bg-slate-950 rounded-xl text-purple-200 font-mono text-[11px] whitespace-pre-line border border-slate-800">
                    {selectedReport.reproduction_steps}
                  </p>
                </div>
              )}

              {/* Status & Assignment Quick Triage */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-950/80 rounded-2xl border border-slate-800">
                <div className="space-y-1.5">
                  <span className="text-slate-400 font-semibold block">Update Status</span>
                  <div className="flex flex-wrap gap-1.5">
                    {['Open', 'Triaged', 'In Progress', 'Resolved', 'Closed'].map((st) => (
                      <button
                        key={st}
                        onClick={() => handleUpdateStatus(selectedReport.id, st)}
                        disabled={updating}
                        className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                          selectedReport.status === st
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-slate-400 font-semibold block">Assign Owner</span>
                  <select
                    value={selectedReport.assigned_to_id || ''}
                    onChange={(e) => handleAssignOwner(selectedReport.id, e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white"
                  >
                    <option value="">-- Unassigned --</option>
                    {staff.map((s) => (
                      <option key={s.user_id} value={s.user_id}>
                        @{s.username || s.user_id.substring(0, 8)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Internal Notes / Triage Justification */}
              <div className="space-y-1.5">
                <span className="text-slate-400 font-semibold block">Internal Triage Note</span>
                <input
                  type="text"
                  placeholder="Reason or investigation update..."
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
