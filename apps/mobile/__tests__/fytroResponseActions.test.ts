/**
 * Fytro AI Response Actions & Feedback Unit Tests
 * 1. Reaction toggling logic (like, dislike, toggle off, switch reaction).
 * 2. Feedback reason categorization.
 * 3. Preceding user prompt resolution for regeneration.
 * 4. Action bar display rules (stream in progress, empty messages).
 * 5. Report payload structure validation.
 */

import type { FytroReaction, FytroFeedbackReason } from '@private-voices/shared'

describe('Fytro AI Response Actions & Feedback System', () => {

  describe('1. Reaction Toggle & State Management', () => {
    function computeNextReaction(
      current: FytroReaction | null,
      clicked: FytroReaction
    ): FytroReaction | null {
      return current === clicked ? null : clicked
    }

    test('activates like when clicking thumbs up from null', () => {
      expect(computeNextReaction(null, 'like')).toBe('like')
    })

    test('toggles like off to null when clicking thumbs up again', () => {
      expect(computeNextReaction('like', 'like')).toBeNull()
    })

    test('switches from like directly to dislike', () => {
      expect(computeNextReaction('like', 'dislike')).toBe('dislike')
    })

    test('switches from dislike directly to like', () => {
      expect(computeNextReaction('dislike', 'like')).toBe('like')
    })

    test('toggles dislike off to null when clicking thumbs down again', () => {
      expect(computeNextReaction('dislike', 'dislike')).toBeNull()
    })
  })

  describe('2. Negative Feedback Reasons Selection', () => {
    function toggleFeedbackReason(
      currentReasons: FytroFeedbackReason[],
      reason: FytroFeedbackReason
    ): FytroFeedbackReason[] {
      return currentReasons.includes(reason)
        ? currentReasons.filter((r) => r !== reason)
        : [...currentReasons, reason]
    }

    test('adds reason when not present', () => {
      const initial: FytroFeedbackReason[] = []
      const updated = toggleFeedbackReason(initial, 'repetitive')
      expect(updated).toEqual(['repetitive'])
    })

    test('supports selecting multiple distinct reasons', () => {
      let reasons: FytroFeedbackReason[] = ['repetitive']
      reasons = toggleFeedbackReason(reasons, 'not_helpful')
      reasons = toggleFeedbackReason(reasons, 'out_of_character')
      expect(reasons).toEqual(['repetitive', 'not_helpful', 'out_of_character'])
    })

    test('removes reason when unclicked', () => {
      const reasons: FytroFeedbackReason[] = ['repetitive', 'not_helpful']
      const updated = toggleFeedbackReason(reasons, 'repetitive')
      expect(updated).toEqual(['not_helpful'])
    })
  })

  describe('3. Response Regeneration Preceding Message Detection', () => {
    interface TestMsg {
      id: string
      role: 'user' | 'assistant'
      content: string
    }

    function findPrecedingUserPrompt(messages: TestMsg[], botMsgId: string): string | null {
      const botIdx = messages.findIndex((m) => m.id === botMsgId)
      if (botIdx === -1) return null
      for (let i = botIdx - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          return messages[i].content
        }
      }
      return null
    }

    test('correctly finds immediately preceding user message for regeneration', () => {
      const chat: TestMsg[] = [
        { id: '1', role: 'user', content: 'What is courage?' },
        { id: '2', role: 'assistant', content: 'Courage is grace under pressure...' },
      ]
      expect(findPrecedingUserPrompt(chat, '2')).toBe('What is courage?')
    })

    test('finds correct preceding prompt in multi-turn conversation', () => {
      const chat: TestMsg[] = [
        { id: '1', role: 'user', content: 'First question' },
        { id: '2', role: 'assistant', content: 'First answer' },
        { id: '3', role: 'user', content: 'Second deeper question' },
        { id: '4', role: 'assistant', content: 'Second answer' },
      ]
      expect(findPrecedingUserPrompt(chat, '4')).toBe('Second deeper question')
      expect(findPrecedingUserPrompt(chat, '2')).toBe('First question')
    })

    test('returns null if no preceding user message exists', () => {
      const chat: TestMsg[] = [
        { id: 'welcome', role: 'assistant', content: 'Welcome to Mind Space' },
      ]
      expect(findPrecedingUserPrompt(chat, 'welcome')).toBeNull()
    })
  })

  describe('4. Action Bar Rendering Guard Rules', () => {
    function shouldRenderActionBar(role: 'user' | 'assistant', content: string, isStreaming: boolean): boolean {
      if (role !== 'assistant') return false
      if (isStreaming) return false
      if (!content.trim()) return false
      return true
    }

    test('does not render for user messages', () => {
      expect(shouldRenderActionBar('user', 'Hello Fytro', false)).toBe(false)
    })

    test('does not render while streaming is in progress', () => {
      expect(shouldRenderActionBar('assistant', 'Reflecting...', true)).toBe(false)
    })

    test('does not render for empty bot placeholder', () => {
      expect(shouldRenderActionBar('assistant', '   ', false)).toBe(false)
    })

    test('renders cleanly for completed assistant response', () => {
      expect(shouldRenderActionBar('assistant', 'Here is an exploration of that thought.', false)).toBe(true)
    })
  })

  describe('5. Report Payload Validation', () => {
    function validateReportPayload(payload: { messageId?: string; reason?: string; details?: string | null }) {
      if (!payload.messageId || !payload.messageId.trim()) return { valid: false, error: 'Missing messageId' }
      if (!payload.reason || !payload.reason.trim()) return { valid: false, error: 'Missing reason' }
      return { valid: true }
    }

    test('validates complete report payload', () => {
      const res = validateReportPayload({
        messageId: 'b-12345',
        reason: 'Harmful or dangerous content',
        details: 'Suggested something unsafe',
      })
      expect(res.valid).toBe(true)
    })

    test('rejects payload missing messageId', () => {
      const res = validateReportPayload({
        reason: 'Harmful content',
      })
      expect(res.valid).toBe(false)
    })

    test('rejects payload missing reason', () => {
      const res = validateReportPayload({
        messageId: 'b-12345',
      })
      expect(res.valid).toBe(false)
    })
  })
})
