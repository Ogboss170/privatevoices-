'use client'

import React, { useState } from 'react'
import {
  Bug,
  AlertOctagon,
  Send,
  CheckCircle2,
  AlertTriangle,
  Monitor,
  ShieldCheck,
  FileText
} from 'lucide-react'
import { SupabaseClient } from '@supabase/supabase-js'

interface BugReportFormProps {
  supabase: SupabaseClient
  currentAdminUser: any
  onSuccess: () => void
  onCancel?: () => void
}

export function BugReportFormModal({
  supabase,
  currentAdminUser,
  onSuccess,
  onCancel,
}: BugReportFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Dashboard')
  const [severity, setSeverity] = useState('Medium')
  const [steps, setSteps] = useState('')
  const [expectedBehavior, setExpectedBehavior] = useState('')
  const [actualBehavior, setActualBehavior] = useState('')
  const [affectedRoute, setAffectedRoute] = useState(
    typeof window !== 'undefined' ? window.location.pathname : '/admin'
  )
  const [consoleLogs, setConsoleLogs] = useState('')
  const [allowFollowUp, setAllowFollowUp] = useState(true)
  const [isSecuritySensitive, setIsSecuritySensitive] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submittedId, setSubmittedId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !description.trim()) {
      setErrorMsg('Please provide both a title and description.')
      return
    }

    setSubmitting(true)
    setErrorMsg(null)

    // Capture browser diagnostic metadata safely
    const envMetadata = typeof window !== 'undefined' ? {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      timestamp: new Date().toISOString(),
    } : {}

    try {
      const { data, error } = await supabase.rpc('admin_create_bug_report', {
        p_title: title.trim(),
        p_description: description.trim(),
        p_category: category,
        p_severity: severity,
        p_affected_route: affectedRoute,
        p_expected_behavior: expectedBehavior.trim() || null,
        p_actual_behavior: actualBehavior.trim() || null,
        p_reproduction_steps: steps.trim() || null,
        p_environment_metadata: envMetadata,
        p_console_logs: consoleLogs.trim() || null,
        p_allow_follow_up: allowFollowUp,
        p_is_security_sensitive: isSecuritySensitive || severity === 'Critical',
      })

      if (error) {
        setErrorMsg(error.message)
      } else if (!data?.success) {
        setErrorMsg(data?.error || 'Failed to file bug report')
      } else {
        setSubmittedId(data.bug_report_id)
        setTimeout(() => {
          onSuccess()
        }, 1200)
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Submission error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 md:p-8 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between border-b border-slate-800/80 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Bug size={20} className="text-purple-400" />
              <span>Report an Issue or Bug</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Submit technical glitches, platform anomalies, or security observations directly to staff engineering.
            </p>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-white p-1 rounded-lg"
            >
              &times;
            </button>
          )}
        </div>

        {submittedId ? (
          <div className="p-8 text-center space-y-3 bg-emerald-950/20 border border-emerald-800/40 rounded-2xl">
            <CheckCircle2 size={36} className="text-emerald-400 mx-auto" />
            <h4 className="text-sm font-bold text-white">Bug Report Successfully Filed</h4>
            <p className="text-xs text-slate-400">
              Report ID: <span className="font-mono text-purple-300">{submittedId}</span>
            </p>
            <p className="text-[11px] text-emerald-400">Recorded in administrative audit log.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {errorMsg && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 flex items-center gap-2">
                <AlertOctagon size={15} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-slate-300 font-semibold">
                Bug Summary / Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Whisper delivery audio fails to transcode on iOS safari"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-slate-300 font-semibold">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-purple-500"
                >
                  {[
                    'Authentication', 'Users', 'Posts', 'Communities', 'Whispers',
                    'Moderation', 'Preview Program', 'Badges', 'Notifications',
                    'Dashboard', 'Permissions', 'Performance', 'Other'
                  ].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-slate-300 font-semibold">Severity</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="Low">Low - Visual defect / minor inconvenience</option>
                  <option value="Medium">Medium - Feature malfunctioning with workaround</option>
                  <option value="High">High - Major feature broken or impaired</option>
                  <option value="Critical">Critical - Security vulnerability / Data exposure</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-slate-300 font-semibold">
                Detailed Problem Description <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain what happened in detail..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-slate-300 font-semibold">Expected Behavior</label>
                <input
                  type="text"
                  value={expectedBehavior}
                  onChange={(e) => setExpectedBehavior(e.target.value)}
                  placeholder="What was supposed to happen..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-slate-300 font-semibold">Actual Behavior</label>
                <input
                  type="text"
                  value={actualBehavior}
                  onChange={(e) => setActualBehavior(e.target.value)}
                  placeholder="What actually occurred..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-slate-300 font-semibold">Steps to Reproduce</label>
              <textarea
                rows={2}
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                placeholder="1. Open whisper composer&#10;2. Record voice note&#10;3. Tap send..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 font-mono text-[11px]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-slate-300 font-semibold">Affected Route / URL</label>
                <input
                  type="text"
                  value={affectedRoute}
                  onChange={(e) => setAffectedRoute(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 font-mono text-[11px]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-slate-300 font-semibold">Diagnostics / Error Stack (Secrets Redacted)</label>
                <input
                  type="text"
                  value={consoleLogs}
                  onChange={(e) => setConsoleLogs(e.target.value)}
                  placeholder="Error: status 500 at..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 font-mono text-[11px]"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSecuritySensitive}
                  onChange={(e) => setIsSecuritySensitive(e.target.checked)}
                  className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-slate-300 font-medium">Mark as Security Vulnerability</span>
              </label>
              <span className="text-[10px] text-slate-500">Restricts view to Super Admins</span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={submitting || !title || !description}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-purple-600/25 transition-all flex items-center gap-2"
              >
                <Send size={14} />
                <span>{submitting ? 'Submitting Report…' : 'Submit Bug Report'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
