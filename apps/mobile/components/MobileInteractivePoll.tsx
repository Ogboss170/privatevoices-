import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { BarChart3, CheckCircle2 } from 'lucide-react-native'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'
import type { Poll, PollOption } from '@private-voices/shared'

interface MobileInteractivePollProps {
  postId: string
  currentUserId?: string
  initialPoll?: Poll | null
}

export function MobileInteractivePoll({
  postId,
  currentUserId,
  initialPoll,
}: MobileInteractivePollProps) {
  const [poll, setPoll] = useState<Poll | null>(initialPoll ?? null)
  const [hasVoted, setHasVoted] = useState(initialPoll?.hasVoted ?? false)
  const [myVoteOptionId, setMyVoteOptionId] = useState<string | null>(
    initialPoll?.myVoteOptionId ?? null
  )
  const [submittingVote, setSubmittingVote] = useState(false)

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
        console.error('Failed to load mobile poll:', err)
      }
    }

    loadPoll()

    // Realtime subscription for live vote updates
    const channel = supabase
      .channel(`mobile_poll_${postId}`)
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
  }, [postId, currentUserId])

  if (!poll) return null

  const totalVotes = poll.totalVotes || 0

  async function handleVote(optionId: string) {
    if (!currentUserId) {
      Alert.alert('Login Required', 'Please log in to vote in this poll.')
      return
    }

    if (!poll || hasVoted || submittingVote) return

    setSubmittingVote(true)

    // Optimistic update
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
        if (error.code === '23505') {
          Alert.alert('Notice', 'You have already voted in this poll.')
        } else {
          Alert.alert('Error', error.message)
        }
      }
    } catch (err) {
      console.error('Vote error:', err)
    } finally {
      setSubmittingVote(false)
    }
  }

  return (
    <View style={styles.pollCard}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <BarChart3 size={15} color={colors.brand} />
          <Text style={styles.headerTitle}>LIVE POLL</Text>
        </View>
        <Text style={styles.voteCountText}>
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
          {hasVoted ? ' • Voted' : ''}
        </Text>
      </View>

      {/* Question */}
      {poll.question ? (
        <Text style={styles.questionText}>{poll.question}</Text>
      ) : null}

      {/* Options */}
      <View style={styles.optionsList}>
        {poll.options.map((opt) => {
          const isSelected = myVoteOptionId === opt.id
          const percentage =
            totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 100) : 0

          return hasVoted ? (
            // ── Result Bar View (After voting) ──
            <View
              key={opt.id}
              style={[
                styles.resultBarContainer,
                isSelected && styles.resultBarContainerSelected,
              ]}
            >
              {/* Animated fill bar */}
              <View
                style={[
                  styles.progressBarFill,
                  isSelected && styles.progressBarFillSelected,
                  { width: `${percentage}%` },
                ]}
              />

              <View style={styles.resultContent}>
                <View style={styles.optionLabelGroup}>
                  {isSelected && (
                    <CheckCircle2 size={16} color={colors.brand} style={{ marginRight: 6 }} />
                  )}
                  <Text
                    style={[
                      styles.resultOptionText,
                      isSelected && styles.resultOptionTextSelected,
                    ]}
                    numberOfLines={2}
                  >
                    {opt.optionText}
                  </Text>
                </View>

                <View style={styles.percentageGroup}>
                  <Text style={styles.countNumber}>{opt.voteCount}</Text>
                  <Text
                    style={[
                      styles.percentageText,
                      isSelected && styles.percentageTextSelected,
                    ]}
                  >
                    {percentage}%
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            // ── Voting Button View (Before voting) ──
            <TouchableOpacity
              key={opt.id}
              style={styles.voteButton}
              onPress={() => handleVote(opt.id)}
              disabled={submittingVote}
              activeOpacity={0.7}
            >
              <Text style={styles.voteButtonText} numberOfLines={2}>
                {opt.optionText}
              </Text>
              <Text style={styles.voteActionLabel}>Vote</Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  pollCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.brand,
    letterSpacing: 0.5,
  },
  voteCountText: {
    fontSize: 11,
    color: colors.gray500,
    fontWeight: '500',
  },
  questionText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gray900,
    marginTop: 2,
  },
  optionsList: {
    gap: 8,
    marginTop: 4,
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  voteButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray800,
    flex: 1,
    marginRight: 8,
  },
  voteActionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.brand,
  },
  resultBarContainer: {
    position: 'relative',
    height: 42,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  resultBarContainerSelected: {
    borderColor: colors.brand,
    backgroundColor: '#f5f3ff',
  },
  progressBarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#e2e8f0',
    borderRadius: 9,
  },
  progressBarFillSelected: {
    backgroundColor: '#ede9fe',
  },
  resultContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    zIndex: 1,
  },
  optionLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  resultOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.gray800,
  },
  resultOptionTextSelected: {
    fontWeight: '700',
    color: colors.brand,
  },
  percentageGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countNumber: {
    fontSize: 11,
    color: colors.gray400,
  },
  percentageText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gray700,
  },
  percentageTextSelected: {
    color: colors.brand,
  },
})
