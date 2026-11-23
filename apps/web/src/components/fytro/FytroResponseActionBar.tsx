'use client'

import React, { useState } from 'react'
import {
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RotateCw,
  Share2,
  Volume2,
  VolumeX,
  Flag,
  MoreHorizontal,
  X,
  Sparkles,
  AlertTriangle,
} from 'lucide-react'
import type { FytroReaction, FytroFeedbackReason } from '@private-voices/shared'

export interface FytroResponseActionBarProps {
  messageId: string
  sessionId?: string | null
  content: string
  isStreaming?: boolean
  isSpeaking?: boolean
  currentReaction?: FytroReaction | null
  onRegenerate?: () => void
  onToggleSpeech?: (content: string) => void
  onReactionChange?: (reaction: FytroReaction | null) => void
}

const FEEDBACK_REASONS: Array<{ key: FytroFeedbackReason; label: string; desc: string }> = [
  { key: 'repetitive', label: 'Repetitive / Generic', desc: 'Gave a canned or repeated answer' },
  { key: 'not_helpful', label: 'Not Helpful', desc: 'Did not address my thought or question' },
  { key: 'inaccurate', label: 'Factually Incorrect', desc: 'Contained false or misleading details' },
  { key: 'hallucination', label: 'Made Things Up', desc: 'Fabricated facts or details' },
  { key: 'out_of_character', label: 'Out of Character', desc: 'Did not reflect Fytro Socratic tone' },
  { key: 'harmful_or_unsafe', label: 'Harmful or Unsafe', desc: 'Dangerous or offensive content' },
  { key: 'other', label: 'Other', desc: 'Different reason' },
]

export function FytroResponseActionBar({
  messageId,
  sessionId,
  content,
  isStreaming = false,
  isSpeaking = false,
  currentReaction = null,
  onRegenerate,
  onToggleSpeech,
  onReactionChange,
}: FytroResponseActionBarProps) {
  const [copied, setCopied] = useState(false)
  const [activeReaction, setActiveReaction] = useState<FytroReaction | null>(currentReaction)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)

  // Feedback form state
  const [selectedReasons, setSelectedReasons] = useState<FytroFeedbackReason[]>([])
  const [feedbackComment, setFeedbackComment] = useState('')
  const [submittingFeedback, setSubmittingFeedback] = useState(false)

  // Report form state
  const [reportReason, setReportReason] = useState('Inappropriate content')
  const [reportDetails, setReportDetails] = useState('')
  const [submittingReport, setSubmittingReport] = useState(false)
  const [reportSuccess, setReportSuccess] = useState(false)

  // Don't render action bar while generating or if empty
  if (isStreaming || !content.trim()) {
    return null
  }

  // 1. Copy
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.warn('Copy failed', e)
    }
  }

  // 2. Share
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Thought reflection via Fytro (Private Voices)',
          text: content,
        })
      } catch (e) {
        // user dismissed or not supported
      }
    } else {
      handleCopy()
    }
  }

  // 3. Reactions (Thumbs up / down)
  const handleToggleReaction = async (reaction: FytroReaction) => {
    const isRemoving = activeReaction === reaction
    const newReaction = isRemoving ? null : reaction
    setActiveReaction(newReaction)
    onReactionChange?.(newReaction)

    if (isRemoving) {
      // DELETE reaction
      try {
        await fetch(`/api/fytro/feedback?messageId=${encodeURIComponent(messageId)}`, {
          method: 'DELETE',
        })
      } catch (err) {
        console.error('Failed to remove feedback:', err)
      }
    } else {
      // POST reaction
      try {
        await fetch('/api/fytro/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId,
            sessionId,
            reaction,
          }),
        })
      } catch (err) {
        console.error('Failed to save feedback:', err)
      }

      // If thumbs down, open feedback dialog to collect reasons
      if (reaction === 'dislike') {
        setShowFeedbackModal(true)
      }
    }
  }

  // Submit thumbs-down detailed reasons
  const handleSubmitDetailedFeedback = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittingFeedback(true)
    try {
      await fetch('/api/fytro/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          sessionId,
          reaction: 'dislike',
          reasons: selectedReasons,
          comment: feedbackComment.trim() || null,
        }),
      })
      setShowFeedbackModal(false)
    } catch (err) {
      console.error('Failed to submit detailed feedback:', err)
    } finally {
      setSubmittingFeedback(false)
    }
  }

  // Submit report
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reportReason) return
    setSubmittingReport(true)
    try {
      const res = await fetch('/api/fytro/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          sessionId,
          reason: reportReason,
          details: reportDetails.trim() || null,
        }),
      })
      if (res.ok) {
        setReportSuccess(true)
        setTimeout(() => {
          setShowReportModal(false)
          setReportSuccess(false)
          setReportDetails('')
        }, 1500)
      }
    } catch (err) {
      console.error('Failed to submit report:', err)
    } finally {
      setSubmittingReport(false)
    }
  }

  return (
    <div className="relative mt-2 pt-1 border-t border-gray-100/60 dark:border-slate-800/60">
      {/* Action Icons Bar */}
      <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap text-gray-400 dark:text-gray-500">
        {/* Copy */}
        <button
          type="button"
          onClick={handleCopy}
          className="p-1 rounded-lg hover:bg-gray-200/60 dark:hover:bg-slate-700/60 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          title={copied ? 'Copied to clipboard' : 'Copy response'}
          aria-label="Copy response"
        >
          {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
        </button>

        {/* Read aloud */}
        {onToggleSpeech && (
          <button
            type="button"
            onClick={() => onToggleSpeech(content)}
            className={`p-1 rounded-lg hover:bg-gray-200/60 dark:hover:bg-slate-700/60 transition-colors ${
              isSpeaking
                ? 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40'
                : 'hover:text-gray-700 dark:hover:text-gray-200'
            }`}
            title={isSpeaking ? 'Stop reading' : 'Read aloud'}
            aria-label="Read aloud"
          >
            {isSpeaking ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
        )}

        {/* Thumbs up */}
        <button
          type="button"
          onClick={() => handleToggleReaction('like')}
          className={`p-1 rounded-lg transition-colors ${
            activeReaction === 'like'
              ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 font-bold'
              : 'hover:bg-gray-200/60 dark:hover:bg-slate-700/60 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
          title="Good response"
          aria-label="Good response"
        >
          <ThumbsUp size={13} className={activeReaction === 'like' ? 'fill-current' : ''} />
        </button>

        {/* Thumbs down */}
        <button
          type="button"
          onClick={() => handleToggleReaction('dislike')}
          className={`p-1 rounded-lg transition-colors ${
            activeReaction === 'dislike'
              ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 font-bold'
              : 'hover:bg-gray-200/60 dark:hover:bg-slate-700/60 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
          title="Bad response"
          aria-label="Bad response"
        >
          <ThumbsDown size={13} className={activeReaction === 'dislike' ? 'fill-current' : ''} />
        </button>

        {/* Regenerate */}
        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            className="p-1 rounded-lg hover:bg-gray-200/60 dark:hover:bg-slate-700/60 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            title="Regenerate response"
            aria-label="Regenerate response"
          >
            <RotateCw size={13} />
          </button>
        )}

        {/* Share */}
        <button
          type="button"
          onClick={handleShare}
          className="p-1 rounded-lg hover:bg-gray-200/60 dark:hover:bg-slate-700/60 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          title="Share response"
          aria-label="Share response"
        >
          <Share2 size={13} />
        </button>

        {/* More options dropdown trigger */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="p-1 rounded-lg hover:bg-gray-200/60 dark:hover:bg-slate-700/60 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            title="More options"
            aria-label="More options"
          >
            <MoreHorizontal size={13} />
          </button>

          {showMoreMenu && (
            <div
              className="absolute left-0 bottom-full mb-1 z-30 w-36 rounded-xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-lg py-1 text-xs text-gray-700 dark:text-gray-200 animate-in fade-in zoom-in-95 duration-100"
              onMouseLeave={() => setShowMoreMenu(false)}
            >
              <button
                type="button"
                onClick={() => {
                  setShowMoreMenu(false)
                  setShowReportModal(true)
                }}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-800 text-rose-600 dark:text-rose-400"
              >
                <Flag size={13} />
                <span>Report response</span>
              </button>
              {activeReaction === 'dislike' && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false)
                    setShowFeedbackModal(true)
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  <ThumbsDown size={13} />
                  <span>Edit feedback</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Negative Feedback Reasons Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-4 shadow-xl space-y-3.5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <ThumbsDown size={16} className="text-rose-500" />
                <h3 className="font-bold text-sm text-gray-900 dark:text-white">Help improve Fytro</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFeedbackModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              What went wrong with this reflection? Select all that apply:
            </p>

            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {FEEDBACK_REASONS.map((r) => {
                const isSelected = selectedReasons.includes(r.key)
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => {
                      setSelectedReasons((prev) =>
                        isSelected ? prev.filter((k) => k !== r.key) : [...prev, r.key]
                      )
                    }}
                    className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between border transition-all ${
                      isSelected
                        ? 'border-purple-500 bg-purple-50/60 dark:bg-purple-950/30 text-purple-950 dark:text-purple-200'
                        : 'border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/60 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{r.label}</div>
                      <div className="text-[10px] text-gray-400">{r.desc}</div>
                    </div>
                    {isSelected && <Check size={14} className="text-purple-600" />}
                  </button>
                )
              })}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Optional comments:
              </label>
              <textarea
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                placeholder="What would have been a more thoughtful response?"
                className="w-full text-xs p-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none h-16"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowFeedbackModal(false)}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={handleSubmitDetailedFeedback}
                disabled={submittingFeedback}
                className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-700 text-white transition-colors disabled:opacity-50"
              >
                {submittingFeedback ? 'Saving...' : 'Submit Feedback'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Response Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-4 shadow-xl space-y-3.5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Flag size={16} className="text-rose-500" />
                <h3 className="font-bold text-sm text-gray-900 dark:text-white">Report AI response</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            {reportSuccess ? (
              <div className="p-4 text-center space-y-1">
                <Check size={24} className="mx-auto text-emerald-500" />
                <p className="text-xs font-bold text-gray-900 dark:text-white">Report submitted</p>
                <p className="text-[11px] text-gray-400">
                  Thank you for keeping Private Voices safe. Our safety team will review this response.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} className="space-y-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Why are you reporting this response?
                </p>

                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full text-xs font-semibold p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-gray-100"
                >
                  <option value="Harmful or dangerous content">Harmful or dangerous content</option>
                  <option value="Hate speech or harassment">Hate speech or harassment</option>
                  <option value="Private information leaked">Private information leaked</option>
                  <option value="Self-harm encouragement">Self-harm encouragement</option>
                  <option value="Sexually explicit or inappropriate">Sexually explicit or inappropriate</option>
                  <option value="Other safety concern">Other safety concern</option>
                </select>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Additional details:
                  </label>
                  <textarea
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Provide any context that helps our moderation team..."
                    className="w-full text-xs p-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-rose-500 resize-none h-16"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReport}
                    className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Flag size={13} />
                    <span>{submittingReport ? 'Reporting...' : 'Submit Report'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
