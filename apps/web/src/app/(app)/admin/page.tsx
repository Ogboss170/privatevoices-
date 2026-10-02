'use client'

import React, { useState, useEffect } from 'react'
import { Shield, Users, MessageSquare, AlertTriangle, CheckCircle, Trash2, XCircle, FileText, Ban } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function AdminDashboardPage(): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const [analytics, setAnalytics] = useState({ users: 0, posts: 0, whispers: 0, reports: 0 })
  const [reports, setReports] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'pending' | 'actioned' | 'audit'>('pending')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadAdminData() {
      setLoading(true)
      const [{ count: userCount }, { count: postCount }, { count: whisperCount }, { data: reportRows }, { data: logs }] =
        await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('posts').select('*', { count: 'exact', head: true }),
          supabase.from('whispers').select('*', { count: 'exact', head: true }),
          supabase
            .from('content_reports')
            .select('*, reporter:profiles!content_reports_reporter_id_fkey(id, username, display_name)')
            .eq('status', activeTab === 'audit' ? 'pending' : activeTab)
            .order('created_at', { ascending: false }),
          supabase
            .from('audit_logs')
            .select('*, actor:profiles!audit_logs_actor_id_fkey(id, username, display_name)')
            .order('created_at', { ascending: false })
            .limit(30),
        ])

      setAnalytics({
        users: userCount ?? 0,
        posts: postCount ?? 0,
        whispers: whisperCount ?? 0,
        reports: reportRows?.length ?? 0,
      })

      setReports(reportRows ?? [])
      setAuditLogs(logs ?? [])
      setLoading(false)
    }

    loadAdminData()
  }, [supabase, activeTab])

  async function handleAction(reportId: string, targetType: string, targetId: string, action: 'dismiss' | 'delete') {
    if (action === 'delete') {
      if (!confirm(`Are you sure you want to delete this ${targetType}?`)) return

      if (targetType === 'post') {
        await supabase.from('posts').delete().eq('id', targetId)
      } else if (targetType === 'comment') {
        await supabase.from('comments').delete().eq('id', targetId)
      } else if (targetType === 'whisper') {
        await supabase.from('whispers').delete().eq('id', targetId)
      }
    }

    const newStatus = action === 'dismiss' ? 'dismissed' : 'actioned'
    const { error } = await supabase
      .from('content_reports')
      .update({ status: newStatus })
      .eq('id', reportId)

    if (!error) {
      setReports((prev) => prev.filter((r) => r.id !== reportId))
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="text-brand-600" size={24} />
            Platform Safety & Audit Dashboard
          </h1>
          <p className="text-xs text-gray-500">Monitor abuse reports, system metrics, and audit logs</p>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 space-y-1">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
            <span>Total Users</span>
            <Users size={16} className="text-brand-600" />
          </div>
          <p className="text-2xl font-black text-gray-900">{analytics.users}</p>
        </div>

        <div className="card p-4 space-y-1">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
            <span>Social Posts</span>
            <MessageSquare size={16} className="text-brand-600" />
          </div>
          <p className="text-2xl font-black text-gray-900">{analytics.posts}</p>
        </div>

        <div className="card p-4 space-y-1">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
            <span>Whispers Sent</span>
            <span className="text-base">🤫</span>
          </div>
          <p className="text-2xl font-black text-gray-900">{analytics.whispers}</p>
        </div>

        <div className="card p-4 space-y-1">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
            <span>Pending Reports</span>
            <AlertTriangle size={16} className="text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600">{reports.length}</p>
        </div>
      </div>

      {/* Tab Filter */}
      <div className="flex border-b border-gray-200 bg-white rounded-xl p-1 gap-1 max-w-md">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
            activeTab === 'pending' ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Pending Queue
        </button>
        <button
          onClick={() => setActiveTab('actioned')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
            activeTab === 'actioned' ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Resolved
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 ${
            activeTab === 'audit' ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <FileText size={13} />
          <span>Audit Logs</span>
        </button>
      </div>

      {/* Section Content */}
      {loading ? (
        <div className="card p-12 text-center text-gray-400">
          <p className="text-sm">Loading moderation queue...</p>
        </div>
      ) : activeTab === 'audit' ? (
        /* Audit Logs List */
        <div className="card divide-y divide-gray-100">
          {auditLogs.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">No audit logs recorded yet.</p>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="p-4 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">@{log.actor?.username ?? 'System'}</span>
                    <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-mono text-[10px]">
                      {log.action}
                    </span>
                  </div>
                  <p className="text-gray-500">Target: {log.target_type ?? 'N/A'}</p>
                </div>
                <span className="text-gray-400">
                  {new Date(log.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Reports List */
        reports.length === 0 ? (
          <div className="card p-12 text-center space-y-2">
            <CheckCircle className="mx-auto text-emerald-500" size={40} />
            <h3 className="font-bold text-gray-900">All Clean!</h3>
            <p className="text-xs text-gray-500">There are no reports in the {activeTab} queue.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <div key={report.id} className="card p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px] uppercase">
                      {report.target_type}
                    </span>
                    <span className="text-xs text-gray-500">
                      Reported by <strong className="text-gray-900">@{report.reporter?.username ?? 'Anonymous'}</strong>
                    </span>
                  </div>

                  <span className="text-xs text-gray-400">
                    {new Date(report.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>

                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-gray-900">Reason: {report.reason}</h4>
                  {report.details && <p className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg">{report.details}</p>}
                </div>

                {activeTab === 'pending' && (
                  <div className="flex gap-2 pt-2 border-t border-gray-100 justify-end">
                    <button
                      onClick={() => handleAction(report.id, report.target_type, report.target_id, 'dismiss')}
                      className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                    >
                      <XCircle size={14} />
                      <span>Dismiss Report</span>
                    </button>

                    <button
                      onClick={() => handleAction(report.id, report.target_type, report.target_id, 'delete')}
                      className="btn-primary bg-red-600 hover:bg-red-700 text-xs py-1.5 px-3 flex items-center gap-1.5"
                    >
                      <Trash2 size={14} />
                      <span>Delete Content</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
