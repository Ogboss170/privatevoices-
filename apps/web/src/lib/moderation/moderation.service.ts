import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { ModerationEngine } from './moderation.engine'
import { ModerationEvaluation } from '@private-voices/shared'

export class ModerationService {
  private static supabase = createSupabaseBrowserClient()

  /**
   * Evaluates content, logs rate limits, creates moderation cases for high risk,
   * updates user safety score, and records administrative actions.
   */
  static async checkAndProcessContent(params: {
    targetType: 'post' | 'comment' | 'reply' | 'whisper' | 'message' | 'story' | 'profile' | 'community'
    targetId: string
    content: string
    authorId?: string | null
    isAnonymousWhisper?: boolean
    imageUrls?: string[]
  }): Promise<ModerationEvaluation> {
    const { targetType, targetId, content, authorId, isAnonymousWhisper, imageUrls } = params

    // 1. Run central rule engine
    const evalResult = ModerationEngine.evaluateContent({
      text: content,
      authorId,
      isAnonymousWhisper,
      imageUrls,
    })

    // 2. If content is flagged, on hold, or blocked -> record in moderation_cases
    if (evalResult.action !== 'ALLOW') {
      try {
        await this.supabase.from('moderation_cases').insert({
          target_type: targetType,
          target_id: targetId,
          author_id: isAnonymousWhisper ? null : authorId, // Strict Privacy: Keep whisper sender NULL
          reason: evalResult.reason,
          risk_level: evalResult.riskLevel,
          status: evalResult.action === 'BLOCK' ? 'RESOLVED' : 'PENDING',
          action_taken: evalResult.action,
          category_scores: evalResult.categories,
        })

        // If author exists (non-whisper), update safety score & strikes
        if (authorId && !isAnonymousWhisper) {
          await this.adjustUserSafetyScore(authorId, evalResult.action)
        }
      } catch (err) {
        console.error('Error logging moderation case:', err)
      }
    }

    return evalResult
  }

  /**
   * Adjusts private User Safety Score based on violations
   */
  private static async adjustUserSafetyScore(userId: string, action: string) {
    try {
      const { data: scoreRecord } = await this.supabase
        .from('user_safety_scores')
        .select('*')
        .eq('user_id', userId)
        .single()

      let currentScore = scoreRecord?.safety_score ?? 100
      let strikeCount = scoreRecord?.strike_count ?? 0

      if (action === 'BLOCK') {
        currentScore = Math.max(0, currentScore - 25)
        strikeCount += 1
      } else if (action === 'HOLD_FOR_REVIEW') {
        currentScore = Math.max(0, currentScore - 10)
      } else if (action === 'ALLOW_AND_FLAG') {
        currentScore = Math.max(0, currentScore - 5)
      }

      const isRestricted = strikeCount >= 3 || currentScore < 50
      const restrictedUntil = isRestricted
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : null

      await this.supabase.from('user_safety_scores').upsert({
        user_id: userId,
        safety_score: currentScore,
        strike_count: strikeCount,
        is_restricted: isRestricted,
        restricted_until: restrictedUntil,
        updated_at: new Date().toISOString(),
      })
    } catch (err) {
      console.error('Error updating user safety score:', err)
    }
  }

  /**
   * Submit user report
   */
  static async submitReport(params: {
    reporterId: string
    targetType: 'post' | 'comment' | 'reply' | 'whisper' | 'message' | 'story' | 'profile' | 'community'
    targetId: string
    reason: string
    details?: string
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { reporterId, targetType, targetId, reason, details } = params

      // Create content_report
      const { error: reportErr } = await this.supabase.from('content_reports').insert({
        reporter_id: reporterId,
        target_type: targetType,
        target_id: targetId,
        reason,
        details,
        status: 'pending',
      })

      if (reportErr) throw reportErr

      // Automatically create a ModerationCase for admin queue prioritization
      await this.supabase.from('moderation_cases').insert({
        target_type: targetType,
        target_id: targetId,
        reported_by: reporterId,
        reason: `User Report: ${reason}`,
        details,
        risk_level: reason.toLowerCase().includes('threat') || reason.toLowerCase().includes('illegal') ? 'CRITICAL' : 'MEDIUM',
        status: 'PENDING',
        action_taken: 'ALLOW_AND_FLAG',
      })

      return { success: true }
    } catch (err: any) {
      console.error('Error submitting report:', err)
      return { success: false, error: err.message || 'Failed to submit report' }
    }
  }

  /**
   * Submit an Appeal for a moderation decision
   */
  static async submitAppeal(params: {
    caseId: string
    userId: string
    explanation: string
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { caseId, userId, explanation } = params

      const { error } = await this.supabase.from('moderation_appeals').insert({
        case_id: caseId,
        user_id: userId,
        explanation,
        status: 'PENDING',
      })

      if (error) throw error

      // Update case status to APPEALED
      await this.supabase
        .from('moderation_cases')
        .update({ status: 'APPEALED' })
        .eq('id', caseId)

      return { success: true }
    } catch (err: any) {
      console.error('Error submitting appeal:', err)
      return { success: false, error: err.message || 'Failed to submit appeal' }
    }
  }
}
