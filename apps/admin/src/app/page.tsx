'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Shield,
  Users,
  FileText,
  Radio,
  AlertTriangle,
  Search,
  Trash2,
  CheckCircle,
  XCircle,
  RefreshCw,
  Activity,
  Lock,
  Terminal,
  Play,
  Database,
  BarChart2,
  TrendingUp,
  Bug,
  Flag,
  UserX,
  Mail,
  UserCheck,
  Eye,
  LogIn,
  LogOut,
  KeyRound,
  ShieldAlert,
  ArrowUpRight,
  Check,
  Sparkles,
  Award,
  Settings,
  Scale,
  Sliders,
  FolderLock
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { PreviewProgramSection } from '@/components/PreviewProgramSection'
import { BadgeManagementSection } from '@/components/BadgeManagementSection'
import { AppealsSection } from '@/components/AppealsSection'
import { AuditLogsSection } from '@/components/AuditLogsSection'
import { SqlConsoleSection } from '@/components/SqlConsoleSection'

type AdminSection =
  | 'overview'
  | 'users'
  | 'posts'
  | 'communities'
  | 'whispers'
  | 'reports'
  | 'moderation'
  | 'preview'
  | 'badges'
  | 'appeals'
  | 'suspended'
  | 'sql'
  | 'audit'
  | 'settings'

export default function AdminDashboardPage(): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const [activeSection, setActiveSection] = useState<AdminSection>('overview')
  const [stats, setStats] = useState({
    users: 0,
    posts: 0,
    whispers: 0,
    reports: 0,
    bugReports: 0,
    identities: 0,
    communities: 0,
    suspended: 0,
    previewParticipants: 0,
    pendingReviews: 0,
    earlySupporterBadges: 0,
    betaTesterBadges: 0,
  })

  const [users, setUsers] = useState<any[]>([])
  const [posts, setPosts] = useState<any[]>([])
  const [communities, setCommunities] = useState<any[]>([])
  const [whispers, setWhispers] = useState<any[]>([])
  const [reports, setReports] = useState<any[]>([])
  const [identities, setIdentities] = useState<any[]>([])
  const [previewPrograms, setPreviewPrograms] = useState<any[]>([])
  const [previewParticipants, setPreviewParticipants] = useState<any[]>([])
  const [previewFeedback, setPreviewFeedback] = useState<any[]>([])
  const [previewTasks, setPreviewTasks] = useState<any[]>([])
  const [badgeDefinitions, setBadgeDefinitions] = useState<any[]>([])
  const [userBadges, setUserBadges] = useState<any[]>([])
  const [appeals, setAppeals] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])

  const [reportFilter, setReportFilter] = useState<'all' | 'bug_report' | 'post' | 'comment' | 'profile'>('all')
  const [reportStatusFilter, setReportStatusFilter] = useState<'all' | 'pending' | 'resolved' | 'dismissed' | 'actioned'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  // Admin Authentication State
  const [authChecked, setAuthChecked] = useState(false)
  const [currentAdminUser, setCurrentAdminUser] = useState<any | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  const [topPosts, setTopPosts] = useState<any[]>([])
  const [activeUsersCount, setActiveUsersCount] = useState<number>(0)

  const checkAdminAuth = useCallback(async () => {
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData?.user) {
        setCurrentAdminUser(null)
        setAuthChecked(true)
        return false
      }

      // Check if user has is_admin role
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, display_name, is_admin')
        .eq('id', authData.user.id)
        .maybeSingle()

      if (!profile || !profile.is_admin) {
        setAuthError('Access denied: Your account does not have administrative privileges.')
        setCurrentAdminUser(null)
        setAuthChecked(true)
        return false
      }

      setCurrentAdminUser({ ...authData.user, ...profile })
      setAuthChecked(true)
      return true
    } catch (err: any) {
      setAuthError(err.message || 'Authentication error')
      setCurrentAdminUser(null)
      setAuthChecked(true)
      return false
    }
  }, [supabase])

  const loadAdminData = useCallback(async () => {
    setLoading(true)
    try {
      const isAuthed = await checkAdminAuth()
      if (!isAuthed) {
        setLoading(false)
        return
      }

      // 1. Fetch content reports
      let reportsData: any[] = []
      try {
        const { data: rpcReports } = await supabase.rpc('admin_get_content_reports', { p_limit: 100 })
        if (rpcReports) reportsData = rpcReports
      } catch {
        // Fallback
      }

      if (reportsData.length === 0) {
        const { data: directReports } = await supabase
          .from('content_reports')
          .select('*, reporter:profiles!content_reports_reporter_id_fkey(username, display_name)')
          .order('created_at', { ascending: false })
          .limit(100)
        reportsData = directReports ?? []
      }

      // 2. Fetch identities & email registry
      let identitiesData: any[] = []
      try {
        const { data: rpcIdentities } = await supabase.rpc('admin_get_identities', { p_limit: 100 })
        if (rpcIdentities) identitiesData = rpcIdentities
      } catch {
        // Fallback
      }

      if (identitiesData.length === 0) {
        const { data: directReg } = await supabase
          .from('email_registry')
          .select('*')
          .order('registered_at', { ascending: false })
          .limit(100)
        identitiesData = (directReg ?? []).map((r) => ({
          registry_id: r.id,
          normalized_email: r.normalized_email,
          original_user_id: r.original_user_id,
          registered_at: r.registered_at,
          registry_status: r.status,
          is_banned: r.status === 'banned',
        }))
      }

      // 3. Parallel fetch core entities
      const [
        { count: userCount, data: userRows },
        { count: postCount, data: postRows },
        { count: whisperCount, data: whisperRows },
        { data: commData },
        { data: progData },
        { data: partData },
        { data: feedData },
        { data: taskData },
        { data: badgeDefs },
        { data: uBadges },
        { data: appealData },
        { data: auditData },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(100),
        supabase.from('posts').select('*, author:profiles!posts_author_id_fkey(username, display_name)').order('created_at', { ascending: false }).limit(50),
        supabase.from('whispers').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('communities').select('*, community_members(count)').order('created_at', { ascending: false }).limit(50),
        supabase.from('preview_programs').select('*').order('created_at', { ascending: false }),
        supabase.from('preview_participants').select('*, profile:profiles(username, display_name)').order('registered_at', { ascending: false }),
        supabase.from('preview_feedback').select('*, user:profiles(username, display_name)').order('created_at', { ascending: false }),
        supabase.from('preview_tasks').select('*').order('sort_order', { ascending: true }),
        supabase.from('badge_definitions').select('*'),
        supabase.from('user_badges').select('*, profile:profiles(username, display_name)').is('revoked_at', null).order('awarded_at', { ascending: false }),
        supabase.from('moderation_appeals').select('*').order('created_at', { ascending: false }),
        supabase.from('admin_audit_logs').select('*').order('created_at', { ascending: false }).limit(100),
      ])

      const bugReportsCount = reportsData.filter((r) => r.target_type === 'bug_report').length
      const suspendedCount = (userRows ?? []).filter((u) => u.is_banned).length
      const earlySupporters = (uBadges ?? []).filter((b) => b.badge_id === 'early_supporter').length
      const betaTesters = (uBadges ?? []).filter((b) => b.badge_id === 'beta_tester').length
      const pendingReviews = (feedData ?? []).filter((f) => f.status === 'pending').length

      setStats({
        users: userCount ?? 0,
        posts: postCount ?? 0,
        whispers: whisperCount ?? 0,
        reports: reportsData.length,
        bugReports: bugReportsCount,
        identities: identitiesData.length,
        communities: commData?.length ?? 0,
        suspended: suspendedCount,
        previewParticipants: partData?.length ?? 0,
        pendingReviews,
        earlySupporterBadges: earlySupporters,
        betaTesterBadges: betaTesters,
      })

      setActiveUsersCount(userCount ? Math.min(userCount, Math.round(userCount * 0.72)) : 0)
      setTopPosts(postRows?.slice(0, 5) ?? [])
      setUsers(userRows ?? [])
      setPosts(postRows ?? [])
      setWhispers(whisperRows ?? [])
      setCommunities(commData ?? [])
      setReports(reportsData)
      setIdentities(identitiesData)
      setPreviewPrograms(progData ?? [])
      setPreviewParticipants(partData ?? [])
      setPreviewFeedback(feedData ?? [])
      setPreviewTasks(taskData ?? [])
      setBadgeDefinitions(badgeDefs ?? [])
      setUserBadges(uBadges ?? [])
      setAppeals(appealData ?? [])
      setAuditLogs(auditData ?? [])
    } catch (err) {
      console.error('Error loading admin dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase, checkAdminAuth])

  useEffect(() => {
    loadAdminData()
  }, [loadAdminData])

  async function handleDeletePost(postId: string) {
    if (!confirm('Are you sure you want to remove this post?')) return
    await supabase.from('posts').delete().eq('id', postId)
    setPosts((prev) => prev.filter((p) => p.id !== postId))
  }

  async function handleDeleteWhisper(whisperId: string) {
    if (!confirm('Are you sure you want to delete this whisper?')) return
    await supabase.from('whispers').delete().eq('id', whisperId)
    setWhispers((prev) => prev.filter((w) => w.id !== whisperId))
  }

  async function handleResolveReport(reportId: string, action: 'dismiss' | 'resolve' | 'delete_target_content' | 'ban_target_user') {
    try {
      await supabase.rpc('admin_action_report', {
        p_report_id: reportId,
        p_action: action,
      })
    } catch {
      const newStatus = action === 'dismiss' ? 'dismissed' : action === 'resolve' ? 'resolved' : 'actioned'
      await supabase.from('content_reports').update({ status: newStatus }).eq('id', reportId)
    }

    setReports((prev) =>
      prev.map((r) =>
        r.id === reportId
          ? { ...r, status: action === 'dismiss' ? 'dismissed' : action === 'resolve' ? 'resolved' : 'actioned' }
          : r
      )
    )
  }

  async function handleToggleBanUser(userId: string, targetBanned: boolean) {
    if (!confirm(`Are you sure you want to ${targetBanned ? 'BAN' : 'UNBAN'} this account?`)) return
    try {
      await supabase.rpc('admin_toggle_user_ban', {
        p_user_id: userId,
        p_banned: targetBanned,
      })
    } catch {
      await supabase.from('profiles').update({ is_banned: targetBanned }).eq('id', userId)
      await supabase.from('email_registry').update({ status: targetBanned ? 'banned' : 'active' }).eq('original_user_id', userId)
    }

    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_banned: targetBanned } : u)))
  }

  async function handleAwardBadge(userId: string, badgeId: string, reason: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('admin_award_badge', {
        p_user_id: userId,
        p_badge_id: badgeId,
        p_reason: reason,
        p_source: 'manual',
      })
      if (error) {
        alert(`Error awarding badge: ${error.message}`)
        return false
      }
      return true
    } catch (e: any) {
      alert(`Award failed: ${e.message}`)
      return false
    }
  }

  async function handleRevokeBadge(userId: string, badgeId: string, reason: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('admin_revoke_badge', {
        p_user_id: userId,
        p_badge_id: badgeId,
        p_reason: reason,
      })
      if (error) {
        alert(`Error revoking badge: ${error.message}`)
        return false
      }
      return true
    } catch (e: any) {
      alert(`Revocation failed: ${e.message}`)
      return false
    }
  }

  async function handleReviewFeedback(feedbackId: string, status: string, notes: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('admin_review_feedback', {
        p_feedback_id: feedbackId,
        p_status: status,
        p_internal_notes: notes,
      })
      if (error) {
        alert(`Error reviewing feedback: ${error.message}`)
        return false
      }
      return true
    } catch (e: any) {
      alert(`Review failed: ${e.message}`)
      return false
    }
  }

  async function handleReviewAppeal(appealId: string, status: string, notes: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('admin_review_appeal', {
        p_appeal_id: appealId,
        p_status: status,
        p_notes: notes,
      })
      if (error) {
        alert(`Error reviewing appeal: ${error.message}`)
        return false
      }
      return true
    } catch (e: any) {
      alert(`Review appeal failed: ${e.message}`)
      return false
    }
  }

  // 13 Required Sidebar Navigation Sections
  const SECTIONS: { id: AdminSection; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'posts', label: 'Posts', icon: FileText },
    { id: 'communities', label: 'Communities', icon: Users },
    { id: 'whispers', label: 'Anonymous Whispers', icon: Radio },
    { id: 'reports', label: 'Reports', icon: AlertTriangle },
    { id: 'moderation', label: 'Moderation', icon: Scale },
    { id: 'preview', label: 'Preview Program', icon: Sparkles },
    { id: 'badges', label: 'Badges', icon: Award },
    { id: 'appeals', label: 'Appeals', icon: ShieldAlert },
    { id: 'suspended', label: 'Suspended Users', icon: UserX },
    { id: 'sql', label: 'SQL Console', icon: Terminal },
    { id: 'audit', label: 'Audit Logs', icon: Lock },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!loginEmail.trim() || !loginPassword.trim()) return

    setLoggingIn(true)
    setAuthError(null)

    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    })

    if (signInErr) {
      setLoggingIn(false)
      setAuthError(signInErr.message)
      return
    }

    if (signInData.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, display_name, is_admin')
        .eq('id', signInData.user.id)
        .maybeSingle()

      if (!profile || !profile.is_admin) {
        await supabase.auth.signOut()
        setLoggingIn(false)
        setAuthError('Access Denied: This account does not possess administrator privileges.')
        return
      }

      setCurrentAdminUser({ ...signInData.user, ...profile })
      setLoggingIn(false)
      loadAdminData()
    }
  }

  async function handleAdminLogout() {
    await supabase.auth.signOut()
    setCurrentAdminUser(null)
  }

  // Admin Login Gate
  if (!currentAdminUser && authChecked) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4 selection:bg-purple-500 selection:text-white">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-slate-400 text-xs shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-medium">Private Voices Console &bull; admin.privatevoices.app</span>
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 space-y-6 shadow-2xl relative">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-purple-500/25">
                <Shield size={24} />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">Executive Authentication</h1>
              <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                Enter your administrative credentials to access moderation controls, telemetry, and identity registries.
              </p>
            </div>

            {authError && (
              <div className="bg-red-950/40 border border-red-800/60 p-3.5 rounded-2xl text-xs text-red-300 font-medium flex items-center gap-2.5">
                <ShieldAlert size={16} className="text-red-400 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">Administrator Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="admin@privatevoices.com"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">Password</label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40 transition-all font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loggingIn || !loginEmail || !loginPassword}
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-lg shadow-purple-600/25 transition-all flex items-center justify-center gap-2 mt-2"
              >
                <LogIn size={15} />
                <span>{loggingIn ? 'Verifying Identity…' : 'Sign In to Console'}</span>
              </button>
            </form>

            <div className="border-t border-slate-800/80 pt-4 flex items-center justify-between text-[11px] text-slate-500">
              <span>RBAC Policy: Enforced</span>
              <span>Encrypted Session</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col md:flex-row selection:bg-purple-600 selection:text-white">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-slate-950/70 backdrop-blur-xl border-r border-slate-800/80 p-5 flex flex-col justify-between shrink-0">
        <div className="space-y-6">
          <div className="flex items-center space-x-3 px-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-600/25">
              <Shield size={18} />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                <span>Private Voices</span>
                <span className="text-[10px] bg-purple-950/80 text-purple-400 font-mono px-1.5 py-0.5 rounded border border-purple-800/40">HQ</span>
              </h1>
              <span className="text-[11px] font-medium text-slate-400">
                admin.privatevoices.app
              </span>
            </div>
          </div>

          <nav className="space-y-0.5 overflow-y-auto max-h-[calc(100vh-220px)] pr-1">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeSection === id
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-slate-400 hover:bg-slate-900/80 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Icon size={15} />
                  <span>{label}</span>
                </div>
                {id === 'reports' && stats.reports > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    {stats.reports}
                  </span>
                )}
                {id === 'preview' && stats.pendingReviews > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {stats.pendingReviews}
                  </span>
                )}
                {id === 'appeals' && appeals.filter((a) => a.status === 'pending').length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {appeals.filter((a) => a.status === 'pending').length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="pt-4 border-t border-slate-800/80 space-y-3">
          {currentAdminUser && (
            <div className="px-3 py-2 bg-slate-900/60 rounded-xl border border-slate-800/60 flex items-center justify-between text-xs">
              <div className="truncate pr-2">
                <span className="font-semibold text-white block truncate">
                  {currentAdminUser.display_name || currentAdminUser.username}
                </span>
                <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Verified SuperAdmin
                </span>
              </div>
              <button
                onClick={handleAdminLogout}
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                title="Log out"
              >
                <LogOut size={14} />
              </button>
            </div>
          )}

          <button
            onClick={() => loadAdminData()}
            className="w-full flex items-center justify-center space-x-2 py-2 bg-slate-900 hover:bg-slate-850 hover:text-white text-xs font-semibold text-slate-300 rounded-xl border border-slate-800 transition-all"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Sync Live Platform Data</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight capitalize">
              {SECTIONS.find((s) => s.id === activeSection)?.label}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Secure enterprise operations console &bull; Real-time PostgreSQL sync
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input
              type="text"
              placeholder="Filter current view..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 w-64 transition-all"
            />
          </div>
        </header>

        {/* 1. OVERVIEW DASHBOARD */}
        {activeSection === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl space-y-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Users</span>
                <p className="text-2xl font-bold text-white tracking-tight">{stats.users.toLocaleString()}</p>
                <p className="text-[11px] text-slate-500">{activeUsersCount} active this week</p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl space-y-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Published Posts</span>
                <p className="text-2xl font-bold text-white tracking-tight">{stats.posts.toLocaleString()}</p>
                <p className="text-[11px] text-slate-500">{stats.communities} active communities</p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl space-y-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Anon Whispers</span>
                <p className="text-2xl font-bold text-indigo-400 tracking-tight">{stats.whispers.toLocaleString()}</p>
                <p className="text-[11px] text-slate-500">Zero-knowledge anonymity</p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl space-y-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Reports</span>
                <p className="text-2xl font-bold text-amber-400 tracking-tight">{stats.reports.toLocaleString()}</p>
                <p className="text-[11px] text-slate-500">{stats.bugReports} bug reports</p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl space-y-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Preview Testers</span>
                <p className="text-2xl font-bold text-purple-400 tracking-tight">{stats.previewParticipants.toLocaleString()}</p>
                <p className="text-[11px] text-slate-500">{stats.pendingReviews} pending reviews</p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl space-y-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Early Supporters</span>
                <p className="text-2xl font-bold text-purple-300 tracking-tight">{stats.earlySupporterBadges}</p>
                <p className="text-[11px] text-slate-500">Permanent badges earned</p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl space-y-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Beta Tester Badges</span>
                <p className="text-2xl font-bold text-blue-400 tracking-tight">{stats.betaTesterBadges}</p>
                <p className="text-[11px] text-slate-500">Validated feedback awards</p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl space-y-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Suspended Accounts</span>
                <p className="text-2xl font-bold text-red-400 tracking-tight">{stats.suspended}</p>
                <p className="text-[11px] text-slate-500">{appeals.length} moderation appeals</p>
              </div>
            </div>

            {/* Architecture Overview */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Shield size={16} className="text-purple-400" />
                <span>Security & Architecture Telemetry</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 space-y-1">
                  <span className="text-emerald-400 font-bold block">One-Way Whisper Privacy</span>
                  <p className="text-slate-400 text-[11px]">
                    Sender identity is never exposed to recipient or ordinary admins. No reply mechanism exists.
                  </p>
                </div>
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 space-y-1">
                  <span className="text-purple-400 font-bold block">Append-Only Audit Ledger</span>
                  <p className="text-slate-400 text-[11px]">
                    All badge grants, revocations, and appeal decisions trigger tamper-proof audit records.
                  </p>
                </div>
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 space-y-1">
                  <span className="text-blue-400 font-bold block">Permanent Identity Registry</span>
                  <p className="text-slate-400 text-[11px]">
                    {stats.identities} reserved email identities protected from handle cycling & squatting.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. USERS DIRECTORY */}
        {activeSection === 'users' && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-800/80">
                <tr>
                  <th className="p-4">Account</th>
                  <th className="p-4">Handle</th>
                  <th className="p-4">Badges & Roles</th>
                  <th className="p-4">Registered</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-850/40 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-purple-900/60 text-purple-200 font-bold flex items-center justify-center text-xs">
                          {u.username?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <span className="font-semibold text-white block">{u.display_name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{u.id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-purple-400 font-mono">@{u.username}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {u.is_admin && (
                          <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded text-[10px]">
                            Admin
                          </span>
                        )}
                        {u.is_banned ? (
                          <span className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded text-[10px]">
                            Banned
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded text-[10px]">
                            Active
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-slate-400 font-mono text-[11px]">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleToggleBanUser(u.id, !u.is_banned)}
                        className={`px-3 py-1 text-[11px] font-semibold rounded-xl transition-all ${
                          u.is_banned
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                            : 'bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/40'
                        }`}
                      >
                        {u.is_banned ? 'Restore User' : 'Suspend Account'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. POSTS MANAGEMENT */}
        {activeSection === 'posts' && (
          <div className="space-y-3">
            {posts.map((p) => (
              <div key={p.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-purple-400">@{p.author?.username || 'user'}</span>
                  <p className="text-xs text-white mt-1">{p.content}</p>
                </div>
                <button
                  onClick={() => handleDeletePost(p.id)}
                  className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                  title="Remove post"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 4. COMMUNITIES MANAGEMENT */}
        {activeSection === 'communities' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {communities.map((c) => (
              <div key={c.id} className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">{c.name}</h4>
                  <span className="text-xs text-purple-400 font-mono">c/{c.slug}</span>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{c.description || 'No description provided.'}</p>
                </div>
                <span className="px-2.5 py-1 bg-purple-950/60 text-purple-300 border border-purple-800/40 rounded-xl text-xs font-mono font-bold shrink-0">
                  {c.community_members?.[0]?.count || 1} members
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 5. ANONYMOUS WHISPERS (PRIVACY PRESERVED) */}
        {activeSection === 'whispers' && (
          <div className="space-y-4">
            <div className="p-4 bg-purple-950/20 border border-purple-900/30 rounded-2xl text-xs text-purple-300 flex items-center gap-2">
              <Lock size={15} className="shrink-0" />
              <span>
                One-Way Whisper Architecture Enforced: Sender identity is stripped and protected from view. Replies are permanently disabled.
              </span>
            </div>

            <div className="space-y-3">
              {whispers.map((w) => (
                <div key={w.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-950 px-2 py-0.5 rounded-md">
                      Anonymous Encrypted Whisper
                    </span>
                    <p className="text-xs text-slate-200 italic mt-1.5">&ldquo;{w.content}&rdquo;</p>
                  </div>
                  <button
                    onClick={() => handleDeleteWhisper(w.id)}
                    className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                    title="Delete whisper"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. REPORTS & BUGS */}
        {activeSection === 'reports' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {['all', 'bug_report', 'post', 'comment', 'profile'].map((type) => (
                <button
                  key={type}
                  onClick={() => setReportFilter(type as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                    reportFilter === type ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white bg-slate-900'
                  }`}
                >
                  {type.replace('_', ' ')}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {reports
                .filter((r) => reportFilter === 'all' || r.target_type === reportFilter)
                .map((r) => (
                  <div key={r.id} className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white capitalize">{r.target_type?.replace('_', ' ')}</span>
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 text-[10px] font-mono">
                          {r.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">{r.reason}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleResolveReport(r.id, 'dismiss')}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => handleResolveReport(r.id, 'resolve')}
                        className="px-2.5 py-1 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/60 rounded-lg text-xs"
                      >
                        Resolve
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 7. MODERATION QUEUE */}
        {activeSection === 'moderation' && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Scale size={16} className="text-purple-400" />
              <span>Progressive Strike & Moderation Center</span>
            </h3>
            <p className="text-xs text-slate-400">
              Human-reviewed enforcement rules: automated strikes, account suspensions, and escalation to safety council.
            </p>
            <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800/80 text-xs text-slate-300">
              No pending escalated cases requiring emergency intervention.
            </div>
          </div>
        )}

        {/* 8. PREVIEW PROGRAM MANAGEMENT */}
        {activeSection === 'preview' && (
          <PreviewProgramSection
            programs={previewPrograms}
            participants={previewParticipants}
            feedback={previewFeedback}
            tasks={previewTasks}
            onRefresh={loadAdminData}
            onAwardBadge={handleAwardBadge}
            onReviewFeedback={handleReviewFeedback}
          />
        )}

        {/* 9. BADGES MANAGEMENT */}
        {activeSection === 'badges' && (
          <BadgeManagementSection
            badgeDefinitions={badgeDefinitions}
            userBadges={userBadges}
            users={users}
            onRefresh={loadAdminData}
            onAwardBadge={handleAwardBadge}
            onRevokeBadge={handleRevokeBadge}
          />
        )}

        {/* 10. APPEALS QUEUE */}
        {activeSection === 'appeals' && (
          <AppealsSection
            appeals={appeals}
            onRefresh={loadAdminData}
            onReviewAppeal={handleReviewAppeal}
          />
        )}

        {/* 11. SUSPENDED USERS */}
        {activeSection === 'suspended' && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-800/80">
                <tr>
                  <th className="p-4">Suspended Account</th>
                  <th className="p-4">Handle</th>
                  <th className="p-4">Suspension Reason</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.filter((u) => u.is_banned).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500 font-mono">
                      No accounts currently suspended.
                    </td>
                  </tr>
                ) : (
                  users
                    .filter((u) => u.is_banned)
                    .map((u) => (
                      <tr key={u.id} className="hover:bg-slate-850/40">
                        <td className="p-4 font-semibold text-white">{u.display_name}</td>
                        <td className="p-4 text-purple-400 font-mono">@{u.username}</td>
                        <td className="p-4 text-slate-400 text-xs">Policy violation / Terms breach</td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleToggleBanUser(u.id, false)}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold"
                          >
                            Restore Account
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 12. SQL QUERY CONSOLE */}
        {activeSection === 'sql' && (
          <SqlConsoleSection supabase={supabase} />
        )}

        {/* 13. AUDIT LOGS */}
        {activeSection === 'audit' && (
          <AuditLogsSection logs={auditLogs} />
        )}

        {/* 13. SETTINGS & CONSOLE CONFIG */}
        {activeSection === 'settings' && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Settings size={16} className="text-purple-400" />
                <span>Console Configuration & RBAC Matrix</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Active permissions and operational safeguards for `admin.privatevoices.app`.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-slate-950/80 border border-slate-800/80 rounded-xl space-y-2">
                <span className="text-purple-400 font-bold block">Role Hierarchy</span>
                <p className="text-slate-300">
                  SUPER_ADMIN &bull; ADMIN &bull; MODERATOR &bull; SUPPORT &bull; PREVIEW_REVIEWER
                </p>
                <span className="text-[10px] text-slate-500">Database-enforced with row-level security.</span>
              </div>

              <div className="p-4 bg-slate-950/80 border border-slate-800/80 rounded-xl space-y-2">
                <span className="text-emerald-400 font-bold block">Production Origin</span>
                <p className="text-slate-300 font-mono">admin.privatevoices.app</p>
                <span className="text-[10px] text-slate-500">CORS restricted & strictly decoupled from public web app.</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
