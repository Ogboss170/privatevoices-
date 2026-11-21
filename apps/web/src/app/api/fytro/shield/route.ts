import { NextRequest, NextResponse } from 'next/server'
import { FYTRO_SYSTEM_PROMPT } from '@private-voices/shared'

interface ShieldCheckRequest {
  text: string
}

interface ShieldFinding {
  type: 'pii' | 'location' | 'employer' | 'timeframe' | 'identity_marker'
  snippet: string
  suggestion: string
  severity: 'low' | 'medium' | 'high'
}

export async function POST(req: NextRequest) {
  try {
    const { text }: ShieldCheckRequest = await req.json()

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ safe: true, findings: [], sanitizedText: text })
    }

    const systemPrompt = `${FYTRO_SYSTEM_PROMPT}
You are operating in [Anonymity Shield Mode].
Your task is to analyze user-generated draft text intended for an anonymous confession/discussion platform and detect accidental de-anonymization markers, such as:
1. Full names, unusual handles, phone numbers, or email addresses.
2. Specific geographical places (exact street names, unique local landmarks, specific school or apartment complexes).
3. Highly specific job titles combined with distinct employer clues (e.g. "Senior VP of Operations at the fintech in Austin with 40 people").
4. Hyper-specific chronological timestamps or dates that can easily unmask someone (e.g. "On Tuesday Nov 12 at 2:15 PM in room 302").
5. Quirky biographical indicators.

You MUST respond strictly with valid JSON conforming to this schema:
{
  "safe": boolean,
  "riskScore": number (1 to 10),
  "findings": [
    {
      "type": "pii" | "location" | "employer" | "timeframe" | "identity_marker",
      "snippet": string,
      "suggestion": string,
      "severity": "low" | "medium" | "high"
    }
  ],
  "sanitizedText": string
}
Do not wrap your response in markdown code blocks. Output raw JSON only.`

    // If Groq is available, run Groq with fast response
    if (process.env.GROQ_API_KEY) {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Please scan this draft post for identity leaks:\n\n"""\n${text}\n"""` },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
          max_tokens: 1000,
        }),
      })

      if (groqRes.ok) {
        const data = await groqRes.json()
        const rawContent = data.choices?.[0]?.message?.content
        if (rawContent) {
          try {
            const parsed = JSON.parse(rawContent)
            return NextResponse.json(parsed)
          } catch {
            // fall through to rule-based fallback
          }
        }
      }
    }

    // Fallback: Intelligent heuristic scanner
    const findings: ShieldFinding[] = []
    let sanitized = text

    // Check for email
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g
    const emails = text.match(emailRegex)
    if (emails) {
      emails.forEach((email) => {
        findings.push({
          type: 'pii',
          snippet: email,
          suggestion: '[email removed]',
          severity: 'high',
        })
        sanitized = sanitized.replace(email, '[email removed]')
      })
    }

    // Check for phone number
    const phoneRegex = /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g
    const phones = text.match(phoneRegex)
    if (phones) {
      phones.forEach((phone) => {
        findings.push({
          type: 'pii',
          snippet: phone,
          suggestion: '[phone removed]',
          severity: 'high',
        })
        sanitized = sanitized.replace(phone, '[phone removed]')
      })
    }

    return NextResponse.json({
      safe: findings.length === 0,
      riskScore: findings.length > 0 ? 8 : 1,
      findings,
      sanitizedText: sanitized,
    })
  } catch (error: any) {
    console.error('Shield API error:', error)
    return NextResponse.json({ error: error.message || 'Shield check failed' }, { status: 500 })
  }
}
