'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FlaskConical,
  Bug,
  Send,
  Star,
  Award,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  Lock,
  Layers,
  Check,
  X,
  Volume2,
  Radio,
  BarChart2,
  Bell
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useWebTheme } from '@/context/WebThemeContext'
import type { PreviewFeature, PreviewProgramTask, PreviewParticipantState } from '@private-voices/shared'

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; icon: any }> = {
  coming_soon: {
    label: 'Coming Soon',
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
    icon: Clock,
  },
  available_for_preview: {
    label: 'Available for Preview',
    badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
    icon: Sparkles,
  },
  testing: {
    label: 'Testing',
    badgeClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800/60',
    icon: FlaskConical,
  },
  released: {
    label: 'Released',
    badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
    icon: CheckCircle2,
  },
}

export default function AppPreviewPage(): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const { themeMode, t } = useWebTheme()

  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)

  // Features Roadmap State
  const [features, setFeatures] = useState<PreviewFeature[]>([])
  const [activeCategory, setActiveCategory] = useState<string>('all')

  // Preview Program State
  const [program, setProgram] = useState<any>(null)
  const [participant, setParticipant] = useState<PreviewParticipantState | null>(null)
  const [tasks, setTasks] = useState<PreviewProgramTask[]>([])
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
  const [programActionLoading, setProgramActionLoading] = useState(false)

  // Feedback State
  const [feedbackCategory, setFeedbackCategory] = useState<'suggestion' | 'ux' | 'bug' | 'performance'>('suggestion')
  const [feedbackTitle, setFeedbackTitle] = useState('')
  const [feedbackContent, setFeedbackContent] = useState('')
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)

      const { data: authData } = await supabase.auth.getUser()
      const currentUid = authData?.user?.id ?? null
      setUserId(currentUid)

      if (currentUid) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('id, username, display_name, is_banned')
          .eq('id', currentUid)
          .maybeSingle()
        setProfile(prof)
      }

      // 1. Fetch real Preview Features
      const { data: featureRows } = await supabase
        .from('preview_features')
        .select('*')
        .order('sort_order', { ascending: true })

      if (featureRows && featureRows.length > 0) {
        setFeatures(
          featureRows.map((f: any) => ({
            id: f.id,
            title: f.title,
            slug: f.slug,
            description: f.description,
            status: f.status,
            category: f.category,
            demoUrl: f.demo_url,
            badgeHighlight: f.badge_highlight,
            sortOrder: f.sort_order,
            isActive: f.is_active,
            createdAt: f.created_at,
          }))
        )
      }

      // 2. Fetch active Preview Program
      const { data: progData } = await supabase
        .from('preview_programs')
        .select('*')
        .eq('slug', 'genesis-preview')
        .maybeSingle()

      const activeProg = progData ?? null
      setProgram(activeProg)

      if (activeProg) {
        // Fetch tasks
        const { data: taskRows } = await supabase
          .from('preview_tasks')
          .select('*')
          .eq('program_id', activeProg.id)
          .eq('is_active', true)
          .order('sort_order', { ascending: true })

        // If user logged in, fetch participant record & task completions
        let userCompletions: Set<string> = new Set()
        if (currentUid) {
          const { data: partData } = await supabase
            .from('preview_participants')
            .select('*')
            .eq('program_id', activeProg.id)
            .eq('user_id', currentUid)
            .maybeSingle()

          if (partData) {
            setParticipant({
              id: partData.id,
              programId: partData.program_id,
              userId: partData.user_id,
              status: partData.status,
              tasksCompleted: partData.tasks_completed,
              validFeedbackCount: partData.valid_feedback_count,
              earlySupporterAwarded: partData.early_supporter_awarded,
              betaTesterAwarded: partData.beta_tester_awarded,
              registeredAt: partData.registered_at,
            })
          } else {
            setParticipant(null)
          }

          const { data: compRows } = await supabase
            .from('preview_task_completions')
            .select('task_id')
            .eq('program_id', activeProg.id)
            .eq('user_id', currentUid)

          if (compRows) {
            compRows.forEach((c: any) => userCompletions.add(c.task_id))
          }
        }

        setTasks(
          (taskRows ?? []).map((t: any) => ({
            id: t.id,
            programId: t.program_id,
            title: t.title,
            description: t.description,
            taskType: t.task_type,
            sortOrder: t.sort_order,
            isActive: t.is_active,
            isCompleted: userCompletions.has(t.id),
          }))
        )
      }
    } catch (err) {
      console.error('Error loading App Preview data:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleToggleMembership = async (join: boolean) => {
    if (!userId || !program?.id) return
    setProgramActionLoading(true)
    try {
      const { data, error } = await supabase.rpc('toggle_preview_program_membership', {
        p_program_id: program.id,
        p_join: join,
      })
      if (error) throw error
      if (data?.error === 'ACCOUNT_RESTRICTED') {
        alert('Your account is restricted from joining preview programs.')
      } else {
        await loadData()
      }
    } catch (err: any) {
      console.error('Failed to update membership:', err)
      alert(err.message || 'Could not update membership status.')
    } finally {
      setProgramActionLoading(false)
    }
  }

  const handleCompleteTask = async (taskId: string) => {
    if (!userId) return
    setCompletingTaskId(taskId)
    try {
      const { data, error } = await supabase.rpc('complete_preview_task', {
        p_task_id: taskId,
        p_notes: 'Verified via web App Preview client.',
      })
      if (error) throw error
      if (data?.error) {
        alert(`Could not complete task: ${data.error}`)
      } else {
        await loadData()
      }
    } catch (err: any) {
      console.error('Task completion error:', err)
      alert(err.message || 'Error recording task progress.')
    } finally {
      setCompletingTaskId(null)
    }
  }

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !feedbackTitle.trim() || !feedbackContent.trim() || !program?.id) return

    setSubmittingFeedback(true)
    try {
      const { error } = await supabase.from('preview_feedback').insert({
        program_id: program.id,
        user_id: userId,
        category: feedbackCategory,
        title: feedbackTitle.trim(),
        content: feedbackContent.trim(),
        device_info: {
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'web',
          platform: 'web',
        },
        status: 'pending',
      })

      if (error) throw error

      setFeedbackSubmitted(true)
      setFeedbackTitle('')
      setFeedbackContent('')
      setTimeout(() => setFeedbackSubmitted(false), 5000)
      await loadData()
    } catch (err: any) {
      console.error('Feedback submit error:', err)
      alert(err.message || 'Failed to submit preview feedback.')
    } finally {
      setSubmittingFeedback(false)
    }
  }

  const filteredFeatures =
    activeCategory === 'all'
      ? features
      : features.filter((f) => f.category === activeCategory)

  const isEnrolled = !!participant && participant.status !== 'disqualified'
  const completedTasksCount = tasks.filter((t) => t.isCompleted).length
  const totalTasksCount = tasks.length
  const progressPercent =
    totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0

  return (
    <div className="space-y-8 max-w-3xl mx-auto pb-20">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            href="/settings"
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            title="Back to Settings"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Sparkles size={20} className="text-purple-600 dark:text-purple-400" />
              <span>App Preview</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Explore and test upcoming features before general release
            </p>
          </div>
        </div>

        <Link
          href="/rate"
          className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 hover:bg-amber-100 transition-colors flex items-center gap-1.5"
        >
          <Star size={14} className="fill-amber-400 text-amber-500" />
          <span>Rate App</span>
        </Link>
      </div>

      {/* ── 1. PREMIUM INTRO HERO ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-950 p-7 sm:p-8 text-white shadow-xl border border-purple-500/20">
        <div className="relative z-10 space-y-3 max-w-xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-[11px] font-bold text-purple-200 uppercase tracking-wider">
            <Sparkles size={12} />
            <span>Pioneer Preview Channel</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Help Shape the Future of Private Voices
          </h2>

          <p className="text-xs sm:text-sm text-purple-100/80 leading-relaxed">
            Preview Program members get early access to audio features, real-time presence indicators, and advanced community capabilities. Complete hands-on testing tasks to earn the permanent <strong>Early Supporter</strong> distinction.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            {isEnrolled ? (
              <button
                type="button"
                onClick={() => handleToggleMembership(false)}
                disabled={programActionLoading}
                className="px-4 py-2 rounded-xl bg-purple-950/80 hover:bg-red-950/80 text-purple-200 hover:text-red-200 border border-purple-700/50 hover:border-red-700/50 text-xs font-bold transition-all disabled:opacity-50"
              >
                {programActionLoading ? 'Updating...' : 'Leave Preview Program'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleToggleMembership(true)}
                disabled={programActionLoading}
                className="px-5 py-2.5 rounded-xl bg-white text-purple-950 hover:bg-purple-50 font-bold text-xs shadow-lg transition-transform active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Sparkles size={14} className="text-purple-600" />
                <span>{programActionLoading ? 'Joining...' : 'Join Preview Program'}</span>
              </button>
            )}

            <Link
              href="/settings"
              className="px-4 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-200 text-xs font-semibold border border-purple-400/20 transition-colors"
            >
              Eligibility & Rules
            </Link>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* ── 2. PREVIEW PROGRAM & TESTING TASKS ── */}
      {program && (
        <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200 dark:border-slate-800 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Award size={18} className="text-purple-600" />
                <span>Preview Program Progress</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {program.description}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50">
                {isEnrolled ? `Status: ${participant?.status?.toUpperCase()}` : 'Not Enrolled'}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
              <span>Task Completion Progress</span>
              <span>
                {completedTasksCount} of {totalTasksCount} tasks ({progressPercent}%)
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Badge Milestone Requirements Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white shrink-0 mt-0.5">
                <Sparkles size={16} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-900 dark:text-white">Early Supporter Badge</span>
                  {participant?.earlySupporterAwarded && (
                    <span className="text-[10px] text-emerald-600 font-bold">Awarded</span>
                  )}
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  Requires 1+ testing task completion and 1+ verified feedback submission.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0 mt-0.5">
                <Bug size={16} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-900 dark:text-white">Beta Tester Badge</span>
                  {participant?.betaTesterAwarded && (
                    <span className="text-[10px] text-emerald-600 font-bold">Awarded</span>
                  )}
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  Awarded for reproducing glitches or submitting detailed technical logs.
                </p>
              </div>
            </div>
          </div>

          {/* Active Testing Tasks */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Available Testing Tasks ({tasks.length})
            </h3>

            {tasks.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No active testing tasks scheduled.</p>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {task.title}
                        </span>
                        {task.isCompleted && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center gap-1 border border-emerald-300/40">
                            <Check size={11} />
                            <span>Completed</span>
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          {task.description}
                        </p>
                      )}
                    </div>

                    {!task.isCompleted ? (
                      <button
                        type="button"
                        onClick={() => handleCompleteTask(task.id)}
                        disabled={!isEnrolled || completingTaskId === task.id}
                        className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition-colors shrink-0 disabled:opacity-40"
                      >
                        {completingTaskId === task.id ? 'Saving...' : 'Mark Done'}
                      </button>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 shrink-0">
                        <CheckCircle2 size={18} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── 3. REAL UPCOMING FEATURES ROADMAP ── */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200 dark:border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers size={18} className="text-purple-600" />
              <span>Feature Pipeline & Previews</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Production roadmap items actively in preview or testing
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {['all', 'audio', 'whispers', 'community', 'core'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold capitalize transition-colors ${
                  activeCategory === cat
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredFeatures.map((feat) => {
            const config = STATUS_CONFIG[feat.status] || STATUS_CONFIG.coming_soon
            const StatusIcon = config.icon

            return (
              <div
                key={feat.id}
                className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/30 flex flex-col justify-between space-y-4 hover:border-purple-300 dark:hover:border-purple-800/60 transition-all"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${config.badgeClass}`}
                    >
                      <StatusIcon size={11} />
                      <span>{config.label}</span>
                    </span>

                    {feat.badgeHighlight && (
                      <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-1">
                        <Sparkles size={10} />
                        <span>{feat.badgeHighlight}</span>
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {feat.title}
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {feat.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                  <span className="capitalize text-[11px] font-mono">Category: {feat.category}</span>
                  {feat.status === 'available_for_preview' && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                      Live in Build
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── 4. FEEDBACK & TESTING EXPERIENCES FORM ── */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200 dark:border-slate-800 space-y-5">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <MessageSquare size={18} className="text-purple-600" />
            <span>Tester Suggestions & Feedback</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Submit your testing thoughts or report reproducible glitches to earn valid feedback credit
          </p>
        </div>

        {feedbackSubmitted && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>Thank you! Your preview feedback has been submitted to staff for review.</span>
          </div>
        )}

        <form onSubmit={handleSubmitFeedback} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'suggestion', label: 'Suggestion' },
                { id: 'ux', label: 'User Experience' },
                { id: 'bug', label: 'Bug / Glitch' },
                { id: 'performance', label: 'Performance' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setFeedbackCategory(c.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    feedbackCategory === c.id
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Title
            </label>
            <input
              type="text"
              required
              value={feedbackTitle}
              onChange={(e) => setFeedbackTitle(e.target.value)}
              placeholder="Brief summary of your feedback or observation..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Detailed Description
            </label>
            <textarea
              required
              rows={4}
              value={feedbackContent}
              onChange={(e) => setFeedbackContent(e.target.value)}
              placeholder="Describe your testing experience, suggestions, or steps to reproduce if reporting an issue..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            />
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <ShieldCheck size={14} className="text-purple-600" />
              <span>Feedback is linked to your tester profile to count toward badge milestones.</span>
            </div>

            <button
              type="submit"
              disabled={submittingFeedback || !feedbackTitle.trim() || !feedbackContent.trim()}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Send size={13} />
              <span>{submittingFeedback ? 'Submitting...' : 'Submit Feedback'}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
