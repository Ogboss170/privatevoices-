'use client'

import React, { useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Eye,
  Trash2,
  Ban,
  ExternalLink,
  MessageSquare,
  FileText,
  User,
  Radio,
  Bug,
  ShieldAlert
} from 'lucide-react'

interface ContentReportsProps {
  reports: any[]
  onRefresh: () => void
  onActionReport: (
    reportId: string,
    action: 'dismiss' | 'resolve' | 'delete_target_content' | 'ban_target_user'
  ) => Promise<void>
}

export function ContentReportsSection({
  reports,
  onRefresh,
  onActionReport,
}: ContentReportsProps) {
  const [reportTypeFilter, setReportTypeFilter] = useState<'all' | 'bug_report' | 'post' | 'comment' | 'profile' | 'whisper'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved' | 'dismissed' | 'actioned'>('all')
  const [search, setSearch] = useState('')
  const [selectedReport, setSelectedReport] = useState<any | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const handleCopy = (text: string, fieldName: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handleExecuteAction = async (
    reportId: string,
    action: 'dismiss' | 'resolve' | 'delete_target_content' | 'ban_target_user'
  ) => {
    const actionLabel =
      action === 'resolve'
        ? 'mark this report as Resolved / Solved'
        : action === 'dismiss'
        ? 'Dismiss this report'
        : action === 'delete_target_content'
        ? 'Permanently Delete the reported target content'
        : 'Ban and suspend the reported target user'

    if (!confirm(`Are you sure you want to ${actionLabel}?`)) return

    setActionLoading(`${reportId}-${action}`)
    try {
      await onActionReport(reportId, action)
      if (selectedReport?.id === reportId) {
        setSelectedReport(null)
      }
      onRefresh()
    } finally {
      setActionLoading(null)
    }
  }

  const filteredReports = reports.filter((r) => {
    const matchesType = reportTypeFilter === 'all' || r.target_type === reportTypeFilter
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter
    const matchesSearch =
      !search ||
      r.id?.toLowerCase().includes(search.toLowerCase()) ||
      r.reason?.toLowerCase().includes(search.toLowerCase()) ||
      r.details?.toLowerCase().includes(search.toLowerCase()) ||
      r.reporter_username?.toLowerCase().includes(search.toLowerCase()) ||
      r.target_preview?.toLowerCase().includes(search.toLowerCase())
    return matchesType && matchesStatus && matchesSearch
  })

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-400" />
            <span>Reports & Content Flag Moderation Queue</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Click any report row to read complete evidence, copy diagnostics, resolve/solve the issue, or take enforcement action.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl">
            {reports.filter((r) => r.status === 'pending').length} Pending
          </span>
          <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
            {reports.filter((r) => r.status === 'resolved' || r.status === 'actioned').length} Solved
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/40 p-3.5 rounded-2xl border border-slate-800/60 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-400 font-semibold mr-1">Category:</span>
          {(['all', 'bug_report', 'post', 'comment', 'profile', 'whisper'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setReportTypeFilter(t)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                reportTypeFilter === t
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-white bg-slate-950'
              }`}
            >
              {t === 'bug_report' ? 'Bug Reports' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 font-semibold mr-1">Status:</span>
          {(['all', 'pending', 'resolved', 'dismissed', 'actioned'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                statusFilter === st
                  ? 'bg-slate-800 text-white font-bold'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {st === 'actioned' ? 'Actioned' : st.charAt(0).toUpperCase() + st.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Clickable Reports Table */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-800/80">
            <tr>
              <th className="p-4">Report & Evidence</th>
              <th className="p-4">Type</th>
              <th className="p-4">Reporter</th>
              <th className="p-4">Status</th>
              <th className="p-4">Submitted</th>
              <th className="p-4 text-right">Quick Solve / Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredReports.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500 font-mono">
                  No reports match the selected filters.
                </td>
              </tr>
            ) : (
              filteredReports.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelectedReport(r)}
                  className="hover:bg-slate-850/50 transition-colors cursor-pointer group"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white group-hover:text-purple-300 transition-colors">
                        {r.reason || 'Flagged violation'}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCopy(r.id, `id-${r.id}`)
                        }}
                        className="text-slate-500 hover:text-slate-300 p-0.5"
                        title="Copy Report ID"
                      >
                        {copiedField === `id-${r.id}` ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                      </button>
                    </div>
                    {r.details && (
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                        {r.details}
                      </p>
                    )}
                    {r.target_preview && (
                      <p className="text-[10px] text-purple-300/80 font-mono mt-0.5 truncate max-w-sm">
                        Preview: &ldquo;{r.target_preview}&rdquo;
                      </p>
                    )}
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 uppercase">
                      {r.target_type}
                    </span>
                  </td>
                  <td className="p-4 text-slate-300">
                    {r.reporter_username ? (
                      <span className="text-purple-400 font-mono">@{r.reporter_username}</span>
                    ) : (
                      <span className="text-slate-500 font-mono">System</span>
                    )}
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                        r.status === 'resolved' || r.status === 'actioned'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : r.status === 'pending'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {r.status?.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-slate-400 text-[11px]">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleExecuteAction(r.id, 'resolve')}
                        disabled={actionLoading === `${r.id}-resolve` || r.status === 'resolved'}
                        className="px-2.5 py-1 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/60 rounded-lg text-[10px] font-bold flex items-center gap-1 disabled:opacity-40 transition-all"
                        title="Solve / Resolve report"
                      >
                        <CheckCircle2 size={11} />
                        <span>Solve</span>
                      </button>
                      <button
                        onClick={() => handleExecuteAction(r.id, 'dismiss')}
                        disabled={actionLoading === `${r.id}-dismiss` || r.status === 'dismissed'}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-medium disabled:opacity-40"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => setSelectedReport(r)}
                        className="p-1 bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-800/50 rounded-lg"
                        title="Read Full Report"
                      >
                        <Eye size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Clickable Full Report Details Drawer / Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 md:p-8 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800/80 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-white">
                    {selectedReport.reason || 'Content Report'}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950 text-purple-300 uppercase border border-purple-800/40">
                    {selectedReport.target_type}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      selectedReport.status === 'resolved' || selectedReport.status === 'actioned'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {selectedReport.status?.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-1">
                  <span>Report ID: {selectedReport.id}</span>
                  <button
                    onClick={() => handleCopy(selectedReport.id, 'modal-id')}
                    className="hover:text-purple-300 flex items-center gap-1"
                  >
                    {copiedField === 'modal-id' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    <span>{copiedField === 'modal-id' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-slate-400 hover:text-white p-1 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            {/* Modal Content & Evidence */}
            <div className="space-y-4 text-xs">
              {/* Evidence / Reason Box */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                    Violation Reason & Details
                  </span>
                  <button
                    onClick={() => handleCopy(selectedReport.details || selectedReport.reason, 'modal-details')}
                    className="text-slate-500 hover:text-purple-300 flex items-center gap-1 text-[10px]"
                  >
                    {copiedField === 'modal-details' ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                    <span>{copiedField === 'modal-details' ? 'Copied Details' : 'Copy Text'}</span>
                  </button>
                </div>
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-slate-200 leading-relaxed space-y-2">
                  <p className="font-semibold text-white">{selectedReport.reason}</p>
                  {selectedReport.details && (
                    <p className="text-slate-300 whitespace-pre-line">{selectedReport.details}</p>
                  )}
                </div>
              </div>

              {/* Target Preview Context */}
              {selectedReport.target_preview && (
                <div>
                  <span className="text-slate-400 font-semibold block uppercase text-[10px] tracking-wider mb-1">
                    Target Content Preview
                  </span>
                  <div className="p-3 bg-purple-950/20 border border-purple-900/40 rounded-xl text-purple-200 font-mono text-[11px] flex items-center justify-between">
                    <span className="truncate mr-2">&ldquo;{selectedReport.target_preview}&rdquo;</span>
                    <button
                      onClick={() => handleCopy(selectedReport.target_preview, 'target-preview')}
                      className="shrink-0 hover:text-white"
                      title="Copy preview text"
                    >
                      {copiedField === 'target-preview' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    </button>
                  </div>
                </div>
              )}

              {/* Entity IDs & Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-950/80 rounded-xl border border-slate-800 font-mono text-[11px]">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Target Entity ID</span>
                  <div className="flex items-center gap-1.5 text-slate-300 mt-0.5">
                    <span className="truncate">{selectedReport.target_id || 'N/A'}</span>
                    {selectedReport.target_id && (
                      <button
                        onClick={() => handleCopy(selectedReport.target_id, 'target-id')}
                        className="hover:text-purple-300 shrink-0"
                      >
                        {copiedField === 'target-id' ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Reporter</span>
                  <span className="text-purple-400 mt-0.5 block truncate">
                    @{selectedReport.reporter_username || 'anonymous / staff'}
                  </span>
                </div>
              </div>

              {/* Action Buttons: Solve, Dismiss, Content Removal, Ban */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <span className="text-slate-400 font-semibold block uppercase text-[10px] tracking-wider">
                  Enforcement & Resolution Controls
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    onClick={() => handleExecuteAction(selectedReport.id, 'resolve')}
                    disabled={selectedReport.status === 'resolved'}
                    className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 size={13} />
                    <span>Solve / Resolve</span>
                  </button>

                  <button
                    onClick={() => handleExecuteAction(selectedReport.id, 'dismiss')}
                    disabled={selectedReport.status === 'dismissed'}
                    className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    <XCircle size={13} />
                    <span>Dismiss</span>
                  </button>

                  <button
                    onClick={() => handleExecuteAction(selectedReport.id, 'delete_target_content')}
                    className="py-2.5 px-3 bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-800/60 font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    <Trash2 size={13} />
                    <span>Delete Content</span>
                  </button>

                  <button
                    onClick={() => handleExecuteAction(selectedReport.id, 'ban_target_user')}
                    className="py-2.5 px-3 bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/60 font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    <Ban size={13} />
                    <span>Ban User</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
