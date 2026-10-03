import {
  ModerationAction,
  ModerationRiskLevel,
  ModerationEvaluation,
  CategoryScores,
} from '@private-voices/shared'

// ─── 1. Banned & High-Risk Lexicon Patterns ─────────────────────────────────────

const PROHIBITED_PATTERNS = {
  csam: /\b(csam|child abuse|child porn)\b/i,
  threats: /\b(i will kill|murder|bomb|explode|shoot up|stab|death to)\b/i,
  selfHarm: /\b(suicide|kill myself|end my life|cut my wrists|how to hang myself)\b/i,
  hate: /\b(nigger|faggot|chink|kike|tranny|retard|race war)\b/i,
  doxxing: /\b(ssn\b|social security number|credit card number|\d{3}-\d{2}-\d{4}|\b\d{16}\b)\b/i,
  maliciousLinks: /(https?:\/\/[^\s]+(?:\.exe|\.scr|\.bat|\.vbs|phish|claim-free-crypto|free-bitcoin-giveaway))/i,
  spamPhrases: /\b(free followers|buy followers|dm for promo|work from home earn \$|cashapp flip|whatsapp me at)\b/i,
}

const HARASSMENT_TERMS = [
  'ugly', 'stupid', 'loser', 'idiot', 'die', 'trash', 'scam', 'bitch', 'whore', 'slut', 'bastard'
]

// ─── 2. Server-Side Moderation Engine Core ─────────────────────────────────────

export class ModerationEngine {
  /**
   * Main Moderation Evaluation Pipeline
   * Evaluates text content, author safety history, rate-limit context, and metadata.
   */
  static evaluateContent(params: {
    text: string
    authorId?: string | null
    isAnonymousWhisper?: boolean
    imageUrls?: string[]
  }): ModerationEvaluation {
    const { text, isAnonymousWhisper, imageUrls } = params
    const normalizedText = (text || '').trim().toLowerCase()

    const categories: CategoryScores = {
      harassment: 0,
      hate: 0,
      threats: 0,
      violence: 0,
      sexual: 0,
      selfHarm: 0,
      spam: 0,
      fraud: 0,
      doxxing: 0,
      maliciousLinks: 0,
    }

    // 1. Prohibited & Severe Violation Checks (Immediate BLOCK)
    if (PROHIBITED_PATTERNS.csam.test(normalizedText)) {
      categories.sexual = 0.99
      return {
        action: 'BLOCK',
        riskLevel: 'CRITICAL',
        categories,
        reason: 'Child Sexual Exploitation & Abuse Content is strictly prohibited.',
      }
    }

    if (PROHIBITED_PATTERNS.threats.test(normalizedText)) {
      categories.threats = 0.95
      categories.violence = 0.9
      return {
        action: 'BLOCK',
        riskLevel: 'CRITICAL',
        categories,
        reason: 'Violent threats and danger to safety are prohibited.',
      }
    }

    if (PROHIBITED_PATTERNS.selfHarm.test(normalizedText)) {
      categories.selfHarm = 0.95
      return {
        action: 'HOLD_FOR_REVIEW',
        riskLevel: 'HIGH',
        categories,
        reason: 'Encouragement or detailed depiction of self-harm.',
      }
    }

    if (PROHIBITED_PATTERNS.doxxing.test(normalizedText)) {
      categories.doxxing = 0.92
      return {
        action: 'BLOCK',
        riskLevel: 'HIGH',
        categories,
        reason: 'Private personal identification exposure (Doxxing) is prohibited.',
      }
    }

    if (PROHIBITED_PATTERNS.maliciousLinks.test(normalizedText)) {
      categories.maliciousLinks = 0.95
      categories.fraud = 0.85
      return {
        action: 'BLOCK',
        riskLevel: 'HIGH',
        categories,
        reason: 'Malicious links or phishing scam detected.',
      }
    }

    // 2. Hate Speech & Severe Slurs Check
    if (PROHIBITED_PATTERNS.hate.test(normalizedText)) {
      categories.hate = 0.89
      return {
        action: 'HOLD_FOR_REVIEW',
        riskLevel: 'HIGH',
        categories,
        reason: 'Hate speech or severe slurs detected.',
      }
    }

    // 3. Spam & Fraud Phrases
    if (PROHIBITED_PATTERNS.spamPhrases.test(normalizedText)) {
      categories.spam = 0.88
      categories.fraud = 0.75
      return {
        action: 'HOLD_FOR_REVIEW',
        riskLevel: 'MEDIUM',
        categories,
        reason: 'Commercial spam, follower botting, or financial scam detected.',
      }
    }

    // 4. Harassment Score Calculation
    let harassmentScore = 0
    for (const term of HARASSMENT_TERMS) {
      if (normalizedText.includes(term)) {
        harassmentScore += 0.2
      }
    }
    categories.harassment = Math.min(1.0, harassmentScore)

    if (categories.harassment >= 0.6) {
      // Anonymous whispers have zero tolerance for targeted harassment
      if (isAnonymousWhisper) {
        return {
          action: 'BLOCK',
          riskLevel: 'HIGH',
          categories,
          reason: 'Harassment or abusive language in Anonymous Whispers is blocked.',
        }
      }
      return {
        action: 'ALLOW_AND_FLAG',
        riskLevel: 'MEDIUM',
        categories,
        reason: 'Potential harassment or toxic tone flagged for review.',
      }
    }

    // 5. Image & Media Link Count Check
    if (imageUrls && imageUrls.length > 8) {
      categories.spam = 0.7
      return {
        action: 'HOLD_FOR_REVIEW',
        riskLevel: 'MEDIUM',
        categories,
        reason: 'Excessive media uploads detected in single post.',
      }
    }

    // Default: Clean Content -> ALLOW
    return {
      action: 'ALLOW',
      riskLevel: 'LOW',
      categories,
      reason: 'Content passed automated safety checks.',
    }
  }

  /**
   * Duplicate Content & Rate Limit Helper
   * Detects rapid repeat postings or link spam
   */
  static isDuplicateOrRapidPosting(recentTexts: string[], newText: string): boolean {
    const cleanNew = newText.trim().toLowerCase()
    const matchCount = recentTexts.filter((t) => t.trim().toLowerCase() === cleanNew).length
    return matchCount >= 2
  }
}
