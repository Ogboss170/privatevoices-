'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Star,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Shield,
  HelpCircle,
  ExternalLink,
  MessageSquare,
  Sparkles,
  ChevronRight,
  Eye,
  EyeOff
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useWebTheme } from '@/context/WebThemeContext'
import type { AppRatingRecord, AppRatingSummary } from '@private-voices/shared'

const RATING_PROMPTS: Record<number, { title: string; subtitle: string; placeholder: string }> = {
  1: {
    title: 'We are sorry to hear that.',
    subtitle: 'What went wrong or frustrated you? Your feedback helps us fix issues urgently.',
    placeholder: 'Tell us what happened, any bugs or confusing parts of the app...',
  },
  2: {
    title: 'We can do better.',
    subtitle: 'What needs improvement to make Private Voices worthwhile for you?',
    placeholder: 'What felt lacking or difficult to use?',
  },
  3: {
    title: 'Thank you for your candid feedback.',
    subtitle: 'What could we add or change to make your experience a 5-star one?',
    placeholder: 'What would turn this into a great experience for you?',
  },
  4: {
    title: 'Glad you are enjoying Private Voices!',
    subtitle: 'What features do you like best, and what is missing for a perfect 5 stars?',
    placeholder: 'Tell us what you liked and any suggestions you have...',
  },
  5: {
    title: 'Thrilled you love Private Voices!',
    subtitle: 'What do you enjoy most about private voices, encrypted whispers, or communities?',
    placeholder: 'Share your favorite moments, communities, or audio stories...',
  },
}

export default function RateAppPage(): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const { themeMode } = useWebTheme()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [userRating, setUserRating] = useState<AppRatingRecord | null>(null)

  // Form State
  const [selectedRating, setSelectedRating] = useState<number>(0)
  const [hoveredRating, setHoveredRating] = useState<number>(0)
  const [reviewText, setReviewText] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [submittedSuccess, setSubmittedSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Genuine Public Summary
  const [ratingSummary, setRatingSummary] = useState<AppRatingSummary | null>(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const { data: authData } = await supabase.auth.getUser()
      const currentUid = authData?.user?.id ?? null
      setUserId(currentUid)

      // 1. Fetch user's existing rating if authenticated
      if (currentUid) {
        const { data: existingRating } = await supabase
          .from('app_ratings')
          .select('*')
          .eq('user_id', currentUid)
          .maybeSingle()

        if (existingRating) {
          setUserRating(existingRating)
          setSelectedRating(existingRating.rating)
          setReviewText(existingRating.review || '')
          setIsAnonymous(existingRating.is_anonymous || false)
        }
      }

      // 2. Fetch genuine aggregate summary via secure RPC
      const { data: summaryData } = await supabase.rpc('get_app_rating_summary')
      if (summaryData) {
        setRatingSummary(summaryData)
      }
    } catch (err) {
      console.error('Failed to load rating data:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedRating < 1 || selectedRating > 5) {
      setErrorMsg('Please select a star rating from 1 to 5.')
      return
    }

    setSubmitting(true)
    setErrorMsg(null)

    try {
      const { data, error } = await supabase.rpc('submit_app_rating', {
        p_rating: selectedRating,
        p_review: reviewText.trim() || null,
        p_is_anonymous: isAnonymous,
        p_platform: 'web',
        p_device_info: {
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'web',
          platform: 'web',
        },
      })

      if (error) throw error

      if (data?.error === 'ACCOUNT_RESTRICTED') {
        setErrorMsg('Your account is restricted from submitting feedback.')
        return
      }

      setSubmittedSuccess(true)
      await loadData()
      setTimeout(() => setSubmittedSuccess(false), 5000)
    } catch (err: any) {
      console.error('Failed to submit rating:', err)
      setErrorMsg(err.message || 'Unable to submit your rating. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const activePrompt = RATING_PROMPTS[selectedRating || 5]
  const displayRating = hoveredRating || selectedRating

  return (
    <div className="space-y-8 max-w-xl mx-auto pb-20">
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
              <Star size={20} className="fill-amber-400 text-amber-500" />
              <span>Rate Private Voices</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Share your thoughts and help shape the platform
            </p>
          </div>
        </div>

        <Link
          href="/preview"
          className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 transition-colors flex items-center gap-1.5"
        >
          <Sparkles size={14} />
          <span>App Preview</span>
        </Link>
      </div>

      {/* ── MAIN RATING CARD ── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-7 sm:p-9 shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-500">
            <Star size={28} className="fill-amber-400 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            How is your experience with Private Voices?
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Your honest feedback drives our weekly feature releases and security updates.
          </p>
        </div>

        {/* 5-Star Interactive Selector */}
        <div className="flex flex-col items-center space-y-3 py-2">
          <div
            className="flex items-center justify-center gap-3"
            role="radiogroup"
            aria-label="Rating from 1 to 5 stars"
          >
            {[1, 2, 3, 4, 5].map((star) => {
              const isFilled = displayRating >= star
              return (
                <button
                  key={star}
                  type="button"
                  onClick={() => setSelectedRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="p-1 transition-transform transform hover:scale-125 focus:outline-none focus:ring-2 focus:ring-amber-500/30 rounded-xl"
                  aria-label={`${star} Star${star > 1 ? 's' : ''}`}
                >
                  <Star
                    size={38}
                    className={`transition-colors ${
                      isFilled
                        ? 'fill-amber-400 text-amber-500 drop-shadow-sm'
                        : 'text-slate-300 dark:text-slate-700 hover:text-amber-300'
                    }`}
                  />
                </button>
              )
            })}
          </div>

          <span className="text-xs font-bold font-mono text-slate-600 dark:text-slate-300">
            {displayRating > 0
              ? `${displayRating} of 5 Stars`
              : 'Tap a star to rate'}
          </span>
        </div>

        {/* Rating-Specific Follow-Up Prompt */}
        {selectedRating > 0 && (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs space-y-1 animate-in fade-in duration-200">
            <span className="font-bold text-slate-900 dark:text-slate-100 block">
              {activePrompt.title}
            </span>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              {activePrompt.subtitle}
            </p>
          </div>
        )}

        {submittedSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>Thank you! Your rating and feedback have been securely recorded. You can edit it at any time.</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-200 flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Optional Written Review
            </label>
            <textarea
              rows={4}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder={activePrompt.placeholder}
              maxLength={1000}
              className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 leading-relaxed"
            />
            <div className="text-right text-[10px] text-slate-400 font-mono">
              {reviewText.length}/1000 characters
            </div>
          </div>

          {/* Anonymous Disclosure Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
                {isAnonymous ? <EyeOff size={15} /> : <Eye size={15} />}
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Submit Anonymously
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isAnonymous
                    ? 'Your username will be omitted from public review summaries.'
                    : 'Your review will be attributed to your verified username.'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsAnonymous(!isAnonymous)}
              className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none ${
                isAnonymous ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform transform ${
                  isAnonymous ? 'translate-x-5.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <button
            type="submit"
            disabled={submitting || selectedRating === 0}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs shadow-md transition-all active:scale-[0.99] disabled:opacity-50"
          >
            {submitting ? 'Saving...' : userRating ? 'Update My Feedback' : 'Submit Feedback'}
          </button>
        </form>

        {/* Official Store Listing Notice (Section D Compliance) */}
        <div className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 text-xs text-slate-500 space-y-1">
          <span className="font-semibold text-slate-700 dark:text-slate-300 block">
            Official Store Listing Notice
          </span>
          <p className="text-[11px] leading-relaxed">
            Private Voices is currently running through early Pioneer and EAS Distribution preview builds. Official Apple App Store and Google Play listing links will become directly accessible upon public store publication.
          </p>
        </div>
      </div>

      {/* ── GENUINE RATING SUMMARY CARD ── */}
      {ratingSummary && ratingSummary.totalReviews > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Community Rating Summary
          </h3>

          <div className="flex items-center gap-6">
            <div className="text-center">
              <span className="text-4xl font-extrabold text-slate-900 dark:text-white font-mono">
                {ratingSummary.averageRating}
              </span>
              <div className="flex items-center justify-center gap-0.5 mt-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    size={13}
                    className={
                      Math.round(ratingSummary.averageRating) >= s
                        ? 'fill-amber-400 text-amber-500'
                        : 'text-slate-300 dark:text-slate-700'
                    }
                  />
                ))}
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {ratingSummary.totalReviews} verified rating{ratingSummary.totalReviews > 1 ? 's' : ''}
              </span>
            </div>

            {/* Distribution bars */}
            <div className="flex-1 space-y-1.5 text-[11px]">
              {[5, 4, 3, 2, 1].map((score) => {
                const count = (ratingSummary.distribution as any)[score.toString()] || 0
                const pct =
                  ratingSummary.totalReviews > 0
                    ? Math.round((count / ratingSummary.totalReviews) * 100)
                    : 0

                return (
                  <div key={score} className="flex items-center gap-2">
                    <span className="w-3 text-slate-500 font-mono text-right">{score}</span>
                    <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-6 text-[10px] text-slate-400 font-mono text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
