'use client'

import React, { useState, useEffect } from 'react'
import { CheckCircle2, BarChart3 } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { Poll, PollOption } from '@private-voices/shared'

interface InteractivePollProps {
  postId: string
  currentUserId?: string
  initialPoll?: Poll | null
}

export default function InteractivePoll({
  postId,
  currentUserId,
  initialPoll,
}: InteractivePollProps): React.JSX.Element | null {
  const supabase = createSupabaseBrowserClient()
  const [poll, setPoll] = useState<Poll | null>(initialPoll ?? null)
  const [loading, setLoading] = useState(false)
  const [submittingVote, setSubmittingVote] = useState(false)
  const [hasVoted, setHasVoted] = useState(initialPoll?.hasVoted ?? false)
  const [myVoteOptionId, setMyVoteOptionId] = useState<string | null>(
    initialPoll?.myVoteOptionId ?? null
  )

  // Fetch or refresh poll details + user vote status
  useEffect(() => {
    let isMounted = true

    async function loadPoll() {
      try {
        const { data: pollData } = await supabase
          .from('polls')
          .select('id, post_id, question, poll_options(id, poll_id, option_text, option_order, vote_count)')
          .eq('post_id', postId)
          .maybeSingle()

        if (!pollData || !isMounted) return

        const rawOptions = (pollData.poll_options as any[]) ?? []
        rawOptions.sort((a, b) => a.option_order - b.option_order)

        const totalVotes = rawOptions.reduce((acc, opt) => acc + (opt.vote_count || 0), 0)

        let userVoted = false
        let votedOptionId: string | null = null

        if (currentUserId) {
          const { data: voteData } = await supabase
            .from('poll_votes')
            .select('option_id')
            .match({ poll_id: pollData.id, user_id: currentUserId })
            .maybeSingle()

          if (voteData && isMounted) {
            userVoted = true
            votedOptionId = voteData.option_id
          }
        }

        if (isMounted) {
          setPoll({
            id: pollData.id,
            postId: pollData.post_id,
            question: pollData.question,
            options: rawOptions.map((opt) => ({
              id: opt.id,
              pollId: opt.poll_id,
              optionText: opt.option_text,
              optionOrder: opt.option_order,
              voteCount: opt.vote_count || 0,
            })),
            totalVotes,
            myVoteOptionId: votedOptionId,
            hasVoted: userVoted,
          })
          setHasVoted(userVoted)
          setMyVoteOptionId(votedOptionId)
        }
      } catch (err) {
        console.error('Failed to load poll:', err)
      }
    }

    loadPoll()

    // Realtime subscription for live vote updates
    const channel = supabase
      .channel(`poll_channel_${postId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'poll_options' },
        () => {
          loadPoll()
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [postId, currentUserId, supabase])

  if (!poll) return null

  const totalVotes = poll.totalVotes || 0

  async function handleVote(optionId: string) {
    if (!currentUserId) {
      alert('Please log in to vote in this poll.')
      return
    }

    if (!poll || hasVoted || submittingVote) return

    setSubmittingVote(true)

    // Optimistic UI update
    setHasVoted(true)
    setMyVoteOptionId(optionId)
    setPoll((prev) => {
      if (!prev) return null
      return {
        ...prev,
        totalVotes: prev.totalVotes + 1,
        hasVoted: true,
        myVoteOptionId: optionId,
        options: prev.options.map((opt) =>
          opt.id === optionId ? { ...opt, voteCount: opt.voteCount + 1 } : opt
        ),
      }
    })

    try {
      const { error } = await supabase.from('poll_votes').insert({
        poll_id: poll.id,
        option_id: optionId,
        user_id: currentUserId,
      })

      if (error) {
        // Rollback on duplicate or permission error
        console.error('Vote failed:', error)
        if (error.code === '23505') {
          // unique violation: already voted
          alert('You have already voted in this poll.')
        } else {
          alert(`Voting failed: ${error.message}`)
        }
      }
    } catch (err) {
      console.error('Vote error:', err)
    } finally {
      setSubmittingVote(false)
    }
  }

  return (
    <div className="mt-3 bg-gray-50/80 rounded-2xl p-4 border border-gray-200/80 space-y-3">
      {/* Poll Header */}
      <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
        <div className="flex items-center gap-1.5 text-brand-600 font-bold uppercase tracking-wider text-[11px]">
          <BarChart3 size={15} />
          <span>Live Poll</span>
        </div>
        <span>
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
          {hasVoted && ' • Voted'}
        </span>
      </div>

      {/* Poll Question */}
      {poll.question && (
        <h4 className="font-semibold text-gray-900 text-sm">{poll.question}</h4>
      )}

      {/* Poll Options */}
      <div className="space-y-2">
        {poll.options.map((option) => {
          const isSelected = myVoteOptionId === option.id
          const percentage =
            totalVotes > 0 ? Math.round((option.voteCount / totalVotes) * 100) : 0

          return (
            <div key={option.id} className="relative group">
              {hasVoted ? (
                // ── Result Bar View (After user has voted) ──
                <div
                  className={`relative overflow-hidden rounded-xl border p-3 flex items-center justify-between transition-all ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50/30'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  {/* Progress Fill Bar */}
                  <div
                    className={`absolute inset-y-0 left-0 transition-all duration-700 ease-out ${
                      isSelected ? 'bg-brand-100/80' : 'bg-gray-100'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />

                  {/* Option Text */}
                  <div className="relative z-10 flex items-center gap-2 min-w-0 pr-4">
                    {isSelected && (
                      <CheckCircle2 size={16} className="text-brand-600 flex-shrink-0" />
                    )}
                    <span
                      className={`text-xs sm:text-sm truncate ${
                        isSelected
                          ? 'font-bold text-brand-900'
                          : 'font-medium text-gray-800'
                      }`}
                    >
                      {option.optionText}
                    </span>
                  </div>

                  {/* Percentage & Vote Count */}
                  <div className="relative z-10 flex items-center gap-2 flex-shrink-0 text-xs">
                    <span className="text-gray-400 text-[11px]">
                      {option.voteCount}
                    </span>
                    <span
                      className={`font-bold ${
                        isSelected ? 'text-brand-700' : 'text-gray-700'
                      }`}
                    >
                      {percentage}%
                    </span>
                  </div>
                </div>
              ) : (
                // ── Voting Button View (Before user has voted) ──
                <button
                  type="button"
                  onClick={() => handleVote(option.id)}
                  disabled={submittingVote}
                  className="w-full text-left p-3 rounded-xl border border-gray-200 bg-white hover:border-brand-500 hover:bg-brand-50/40 text-gray-800 hover:text-brand-700 text-xs sm:text-sm font-semibold transition-all flex items-center justify-between shadow-sm active:scale-[0.99]"
                >
                  <span className="truncate">{option.optionText}</span>
                  <span className="text-xs font-medium text-gray-400 group-hover:text-brand-600">
                    Vote
                  </span>
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
