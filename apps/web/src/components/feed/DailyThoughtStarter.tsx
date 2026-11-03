'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Sparkles, MessageCircle, ChevronRight, X } from 'lucide-react'

const THOUGHT_PROMPTS = [
  {
    tag: 'Daily Reflection',
    prompt: 'What is an opinion or perspective you hold that you rarely share out loud?',
    icon: '💭',
  },
  {
    tag: 'Curiosity',
    prompt: 'What was a hard lesson you had to learn on your own without anyone warning you?',
    icon: '🌱',
  },
  {
    tag: 'Unfiltered Thought',
    prompt: 'If you had zero fear of judgment from friends or colleagues, what would you create or say today?',
    icon: '🎭',
  },
  {
    tag: 'Deep Question',
    prompt: 'What is something simple that genuinely brought you peace of mind this week?',
    icon: '✨',
  },
  {
    tag: 'Life Reflection',
    prompt: 'What is a piece of common advice that you think is completely wrong or misleading?',
    icon: '🔍',
  },
]

export default function DailyThoughtStarter(): React.JSX.Element | null {
  const [promptIndex, setPromptIndex] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Pick daily prompt based on day of year
    const now = new Date()
    const dayOfYear = Math.floor(
      (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
    )
    setPromptIndex(dayOfYear % THOUGHT_PROMPTS.length)

    // Check if dismissed for the session
    const isDismissed = sessionStorage.getItem('pv_thought_starter_dismissed') === 'true'
    if (isDismissed) setDismissed(true)
  }, [])

  if (dismissed) return null

  const currentPrompt = THOUGHT_PROMPTS[promptIndex]

  function handleDismiss() {
    setDismissed(true)
    sessionStorage.setItem('pv_thought_starter_dismissed', 'true')
  }

  const encodedPrompt = encodeURIComponent(`💭 [${currentPrompt.tag}]\n"${currentPrompt.prompt}"\n\n`)

  return (
    <div className="relative mx-3.5 my-3 p-4 rounded-3xl bg-gradient-to-br from-amber-500/10 via-purple-500/5 to-brand-500/10 dark:from-amber-950/20 dark:via-purple-950/15 dark:to-slate-800/80 border border-amber-200/50 dark:border-amber-900/30 shadow-xs overflow-hidden select-none">
      {/* Decorative Aura background */}
      <div className="absolute top-0 right-0 -mt-6 -mr-6 w-28 h-28 bg-gradient-to-br from-amber-400/20 to-purple-500/20 rounded-full blur-xl pointer-events-none" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{currentPrompt.icon}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] uppercase font-bold tracking-wider text-amber-700 dark:text-amber-400">
              {currentPrompt.tag}
            </span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">• Today's Thought</span>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="p-1 -mr-1 -mt-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full transition-colors cursor-pointer"
          title="Dismiss for today"
        >
          <X size={15} />
        </button>
      </div>

      <p className="relative mt-2 text-sm sm:text-[15px] font-medium text-gray-900 dark:text-gray-100 leading-snug">
        "{currentPrompt.prompt}"
      </p>

      <div className="relative mt-3 flex items-center justify-between pt-2 border-t border-amber-200/40 dark:border-slate-800/80">
        <span className="text-[11px] text-gray-500 dark:text-gray-400">
          Share your perspective with the community
        </span>

        <Link
          href={`/create?initialContent=${encodedPrompt}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-950 text-xs font-bold hover:opacity-90 active:scale-95 transition-all shadow-xs"
        >
          <span>Share Thought</span>
          <ChevronRight size={13} strokeWidth={2.5} />
        </Link>
      </div>
    </div>
  )
}
