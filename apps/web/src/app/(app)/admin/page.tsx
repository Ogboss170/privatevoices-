'use client'

import React, { useState, useEffect } from 'react'
import {
  Shield,
  Users,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  Trash2,
  XCircle,
  FileText,
  Ban,
  Radio,
  Eye,
  Search,
  Filter,
  TrendingUp,
  Activity,
  Layers,
  BarChart3,
  UserCheck,
  UserX,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

type AdminSection =
  | 'dashboard'
  | 'users'
  | 'posts'
  | 'whispers'
  | 'reports'
  | 'communities'
  | 'moderation'
  | 'suspensions'
  | 'analytics'

export default function AdminDashboardPage(): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard')
  const [loading, setLoading] = useState(true)

  // Metrics
  const [stats, setStats] = useState({
    users: 0,
    posts: 0,
    whispers: 0,
    reports: 0,
    communities: 0,
    suspensions: 0,
    stories: 0,
  })

  // Data lists
  const [users, setUsers] = useState<any[]>([])
  const [posts, setPosts] = useState<any[]>([])
  const [whispers, setWhispers] = useState<any[]>([])
  const [reports, setReports] = useState<any[]>([])
  const [communities, setCommunities] = useState<any[]>([])
  const [suspensions, setSuspensions] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [reportFilter, setReportFilter] = useState<'pending' | 'actioned' | 'dismissed'>('pending')
  const [suspensionReason, setSuspensionReason] = useState('')
  const [selectedUserForSuspend, setSelectedUserForSuspend] = useState<string | null>(null)

  useEffect(() => {
    loadAdminData()
  }, [supabase, activeSection, reportFilter])

  async function loadAdminData() {
    setLoading(true)
    try {
      const [
        { count: userCount, data: userRows },
        { count: postCount, data: postRows },
        { count: whisperCount, data: whisperRows },
        { count: reportCount, data: reportRows },
        { count: communityCount, data: communityRows },
        { count: suspensionCount, data: suspensionRows },
        { data: logs },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(50),
        supabase.from('posts').select('*, author:profiles(username, display_name)').order('created_at', { ascending: false }).limit(50),
        supabase.from('whispers').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('content_reports').select('*, reporter:profiles!content_reports_reporter_id_fkey(username)').eq('status', reportFilter).order('created_at', { ascending: false }),
        supabase.from('communities').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(50),
        supabase.from('user_suspensions').select('*, user:profiles!user_suspensions_user_id_fkey(username, display_name)').order('suspended_at', { ascending: false }),
        supabase.from('audit_logs').select('*, actor:profiles!audit_logs_actor_id_fkey(username)').order('created_at', { ascending: false }).limit(50),
      ])

      setStats({
        users: userCount ?? 0,
        posts: postCount ?? 0,
        whispers: whisperCount ?? 0,
        reports: reportCount ?? 0,
        communities: communityCount ?? 0,
        suspensions: suspensionCount ?? 0,
        stories: 0,
      })

      setUsers(userRows ?? [])
      setPosts(postRows ?? [])
      setWhispers(whisperRows ?? [])
      setReports(reportRows ?? [])
      setCommunities(communityRows ?? [])
      setSuspensions(suspensionRows ?? [])
      setAuditLogs(logs ?? [])
    } catch (err) {
      console.error('Error loading admin dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Action handlers
  async function handleDeletePost(postId: string) {
    if (!confirm('Are you sure you want to delete this post?')) return
    await supabase.from('posts').delete().eq('id', postId)
    setPosts((prev) => prev.filter((p) => p.id !== postId))
  }

  async function handleDeleteWhisper(whisperId: string) {
    if (!confirm('Are you sure you want to delete this whisper?')) return
    await supabase.from('whispers').delete().eq('id', whisperId)
    setWhispers((prev) => prev.filter((w) => w.id !== whisperId))
  }

  async function handleReportAction(reportId: string, targetType: string, targetId: string, action: 'dismiss' | 'delete') {
    if (action === 'delete') {
      if (targetType === 'post') await supabase.from('posts').delete().eq('id', targetId)
      else if (targetType === 'comment') await supabase.from('comments').delete().eq('id', targetId)
      else if (targetType === 'whisper') await supabase.from('whispers').delete().eq('id', targetId)
    }
    const newStatus = action === 'dismiss' ? 'dismissed' : 'actioned'
    await supabase.from('content_reports').update({ status: newStatus }).eq('id', reportId)
    setReports((prev) => prev.filter((r) => r.id !== reportId))
  }

  async function handleSuspendUser() {
    if (!selectedUserForSuspend || !suspensionReason) return
    const { error } = await supabase.from('user_suspensions').insert({
      user_id: selectedUserForSuspend,
      reason: suspensionReason,
    })
    if (!error) {
      alert('User suspended successfully')
      setSelectedUserForSuspend(null)
      setSuspensionReason('')
      loadAdminData()
    }
  }

  async function handleUnsuspendUser(suspensionId: string) {
    await supabase.from('user_suspensions').delete().eq('id', suspensionId)
    setSuspensions((prev) => prev.filter((s) => s.id !== suspensionId))
  }

  const SECTIONS: { id: AdminSection; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Shield },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'posts', label: 'Posts', icon: MessageSquare },
    { id: 'whispers', label: 'Whispers', icon: Radio },
    { id: 'reports', label: 'Reports', icon: AlertTriangle },
    { id: 'communities', label: 'Communities', icon: Layers },
    { id: 'moderation', label: 'Moderation Queue', icon: CheckCircle },
    { id: 'suspensions', label: 'Suspensions', icon: Ban },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ]

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2.5">
            <Shield className="text-brand-600" size={28} />
            Admin & Safety Console
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Centralized platform control, real-time analytics, user security & content moderation
          </p>
        </div>
      </div>

      {/* Admin Sub-Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-gray-200 no-scrollbar">
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeSection === id
                ? 'bg-brand-600 text-white shadow-md shadow-brand-200'
                : 'bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-gray-200'
            }`}
          >
            <Icon size={15} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Section Content */}
      {loading ? (
        <div className="card p-12 text-center text-gray-400">
          <p className="text-xs font-medium">Loading administrative data...</p>
        </div>
      ) : (
        <>
          {/* 1. DASHBOARD OVERVIEW */}
          {activeSection === 'dashboard' && (
            <div className="space-y-6">
              {/* Stat Cards Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card p-4 space-y-1 bg-white border border-gray-200 rounded-2xl shadow-sm">
                  <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
                    <span>Total Users</span>
                    <Users size={18} className="text-brand-600" />
                  </div>
                  <p className="text-2xl font-black text-gray-900">{stats.users}</p>
                </div>
                <div className="card p-4 space-y-1 bg-white border border-gray-200 rounded-2xl shadow-sm">
                  <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
                    <span>Public Posts</span>
                    <MessageSquare size={18} className="text-brand-600" />
                  </div>
                  <p className="text-2xl font-black text-gray-900">{stats.posts}</p>
                </div>
                <div className="card p-4 space-y-1 bg-white border border-gray-200 rounded-2xl shadow-sm">
                  <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
                    <span>Whispers Sent</span>
                    <Radio size={18} className="text-purple-600" />
                  </div>
                  <p className="text-2xl font-black text-gray-900">{stats.whispers}</p>
                </div>
                <div className="card p-4 space-y-1 bg-white border border-gray-200 rounded-2xl shadow-sm">
                  <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
                    <span>Pending Reports</span>
                    <AlertTriangle size={18} className="text-amber-500" />
                  </div>
                  <p className="text-2xl font-black text-amber-600">{stats.reports}</p>
                </div>
              </div>

              {/* Audit Logs Summary */}
              <div className="card p-5 space-y-4 bg-white border border-gray-200 rounded-2xl shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <FileText size={16} className="text-brand-600" />
                  Recent System Audit Logs
                </h3>
                <div className="divide-y divide-gray-100">
                  {auditLogs.length === 0 ? (
                    <p className="text-xs text-gray-400 py-4 text-center">No recent audit logs recorded.</p>
                  ) : (
                    auditLogs.slice(0, 10).map((log) => (
                      <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">@{log.actor?.username ?? 'System'}</span>
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 font-mono text-[10px] text-gray-600">
                            {log.action}
                          </span>
                        </div>
                        <span className="text-gray-400 text-[11px]">
                          {new Date(log.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2. USERS MANAGEMENT */}
          {activeSection === 'users' && (
            <div className="card p-5 space-y-4 bg-white border border-gray-200 rounded-2xl shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Users size={16} className="text-brand-600" />
                User Profiles Directory ({users.length})
              </h3>
              <div className="divide-y divide-gray-100">
                {users.map((u) => (
                  <div key={u.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-900">{u.display_name || u.username}</p>
                      <p className="text-[11px] text-gray-400">@{u.username} • Joined {new Date(u.created_at).toLocaleDateString()}</p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedUserForSuspend(u.id)
                        setActiveSection('suspensions')
                      }}
                      className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1 text-red-600 hover:bg-red-50"
                    >
                      <Ban size={12} />
                      <span>Suspend</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. POSTS MANAGEMENT */}
          {activeSection === 'posts' && (
            <div className="card p-5 space-y-4 bg-white border border-gray-200 rounded-2xl shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <MessageSquare size={16} className="text-brand-600" />
                Public Feed Content ({posts.length})
              </h3>
              <div className="space-y-3">
                {posts.map((p) => (
                  <div key={p.id} className="p-3.5 bg-gray-50 rounded-xl flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <p className="text-xs font-bold text-gray-900">@{p.author?.username || 'Unknown Author'}</p>
                      <p className="text-xs text-gray-700">{p.content}</p>
                      <span className="text-[10px] text-gray-400">{new Date(p.created_at).toLocaleString()}</span>
                    </div>
                    <button
                      onClick={() => handleDeletePost(p.id)}
                      className="text-red-600 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. WHISPERS MANAGEMENT */}
          {activeSection === 'whispers' && (
            <div className="card p-5 space-y-4 bg-white border border-gray-200 rounded-2xl shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Radio size={16} className="text-purple-600" />
                Anonymous Whispers Monitor ({whispers.length})
              </h3>
              <div className="space-y-3">
                {whispers.map((w) => (
                  <div key={w.id} className="p-3.5 bg-purple-50/40 border border-purple-100 rounded-xl flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                        Anonymous Sender
                      </span>
                      <p className="text-xs text-gray-800 mt-1">{w.content}</p>
                      <span className="text-[10px] text-gray-400 block">{new Date(w.created_at).toLocaleString()}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteWhisper(w.id)}
                      className="text-red-600 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. REPORTS MANAGEMENT */}
          {activeSection === 'reports' && (
            <div className="card p-5 space-y-4 bg-white border border-gray-200 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-500" />
                  User Content Reports Queue
                </h3>
                <div className="flex gap-1">
                  {(['pending', 'actioned', 'dismissed'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setReportFilter(filter)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize transition-colors ${
                        reportFilter === filter ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {reports.length === 0 ? (
                  <p className="text-xs text-gray-400 py-8 text-center">No reports matching {reportFilter} status.</p>
                ) : (
                  reports.map((r) => (
                    <div key={r.id} className="p-4 border border-gray-200 rounded-xl space-y-2 bg-gray-50/50">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                          {r.target_type}
                        </span>
                        <span className="text-xs text-gray-400">Reported by @{r.reporter?.username || 'Anonymous'}</span>
                      </div>
                      <p className="text-xs font-bold text-gray-900">Reason: {r.reason}</p>
                      {r.details && <p className="text-xs text-gray-600 bg-white p-2 rounded border border-gray-100">{r.details}</p>}
                      {reportFilter === 'pending' && (
                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            onClick={() => handleReportAction(r.id, r.target_type, r.target_id, 'dismiss')}
                            className="btn-secondary text-[11px] py-1 px-3"
                          >
                            Dismiss
                          </button>
                          <button
                            onClick={() => handleReportAction(r.id, r.target_type, r.target_id, 'delete')}
                            className="btn-primary bg-red-600 hover:bg-red-700 text-[11px] py-1 px-3"
                          >
                            Delete Content
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 6. COMMUNITIES MANAGEMENT */}
          {activeSection === 'communities' && (
            <div className="card p-5 space-y-4 bg-white border border-gray-200 rounded-2xl shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Layers size={16} className="text-brand-600" />
                Active Communities ({communities.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {communities.map((c) => (
                  <div key={c.id} className="p-3.5 border border-gray-200 rounded-xl space-y-1">
                    <p className="text-xs font-bold text-gray-900">{c.name}</p>
                    <p className="text-[11px] text-gray-500 line-clamp-2">{c.description || 'No description'}</p>
                    <span className="text-[10px] text-gray-400 block pt-1">
                      Privacy: {c.is_private ? 'Private 🔒' : 'Public 🌐'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7. MODERATION QUEUE */}
          {activeSection === 'moderation' && (
            <div className="card p-5 space-y-4 bg-white border border-gray-200 rounded-2xl shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <CheckCircle size={16} className="text-emerald-600" />
                Active Moderation Queue
              </h3>
              <p className="text-xs text-gray-500">
                Review flagged items and automated platform safety filters in real time.
              </p>
              <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <CheckCircle size={32} className="mx-auto text-emerald-500 mb-2" />
                <p className="text-xs font-bold text-gray-700">Moderation Queue Clear</p>
                <p className="text-[11px] text-gray-400">No automated flags require manual review.</p>
              </div>
            </div>
          )}

          {/* 8. SUSPENSIONS MANAGEMENT */}
          {activeSection === 'suspensions' && (
            <div className="space-y-6">
              {/* Suspend Form */}
              <div className="card p-5 space-y-3 bg-white border border-gray-200 rounded-2xl shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Ban size={16} className="text-red-600" />
                  Suspend User Access
                </h3>
                <div className="space-y-2">
                  <select
                    value={selectedUserForSuspend || ''}
                    onChange={(e) => setSelectedUserForSuspend(e.target.value)}
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl"
                  >
                    <option value="">Select User to Suspend...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        @{u.username} ({u.display_name})
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Reason for suspension (e.g. Terms of Service violation)"
                    value={suspensionReason}
                    onChange={(e) => setSuspensionReason(e.target.value)}
                    className="w-full text-xs p-2.5 border border-gray-300 rounded-xl"
                  />
                  <button
                    onClick={handleSuspendUser}
                    disabled={!selectedUserForSuspend || !suspensionReason}
                    className="btn-primary bg-red-600 hover:bg-red-700 text-xs py-2 px-4 w-full disabled:opacity-50"
                  >
                    Enforce Suspension
                  </button>
                </div>
              </div>

              {/* Active Suspensions List */}
              <div className="card p-5 space-y-3 bg-white border border-gray-200 rounded-2xl shadow-sm">
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Active User Suspensions ({suspensions.length})
                </h4>
                <div className="divide-y divide-gray-100">
                  {suspensions.length === 0 ? (
                    <p className="text-xs text-gray-400 py-4 text-center">No active user suspensions.</p>
                  ) : (
                    suspensions.map((s) => (
                      <div key={s.id} className="py-3 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-gray-900">@{s.user?.username || 'Unknown'}</p>
                          <p className="text-[11px] text-gray-500">Reason: {s.reason}</p>
                          <span className="text-[10px] text-gray-400">Suspended on {new Date(s.suspended_at).toLocaleDateString()}</span>
                        </div>
                        <button
                          onClick={() => handleUnsuspendUser(s.id)}
                          className="btn-secondary text-[11px] py-1 px-3 text-emerald-600 hover:bg-emerald-50"
                        >
                          Lift Suspension
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 9. ANALYTICS DASHBOARD */}
          {activeSection === 'analytics' && (
            <div className="card p-5 space-y-4 bg-white border border-gray-200 rounded-2xl shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 size={16} className="text-brand-600" />
                Platform Growth & Engagement Analytics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-4 bg-brand-50/50 border border-brand-100 rounded-xl space-y-1">
                  <span className="text-xs font-bold text-brand-800">Total Registered Users</span>
                  <p className="text-2xl font-black text-brand-900">{stats.users}</p>
                </div>
                <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-1">
                  <span className="text-xs font-bold text-emerald-800">Total Public Content</span>
                  <p className="text-2xl font-black text-emerald-900">{stats.posts}</p>
                </div>
                <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-xl space-y-1">
                  <span className="text-xs font-bold text-purple-800">Anonymous Whispers Ratio</span>
                  <p className="text-2xl font-black text-purple-900">
                    {stats.posts > 0 ? ((stats.whispers / (stats.posts + stats.whispers)) * 100).toFixed(1) : 0}%
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
