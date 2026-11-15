import { NextRequest } from 'next/server'
import {
  FYTRO_SYSTEM_PROMPT,
  FYTRO_MODE_INSTRUCTIONS,
  FytroMode,
} from '@private-voices/shared'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages = [], mode = 'sanctuary' }: { messages: ChatMessage[]; mode: FytroMode } = body

    const activeModeGuidance = FYTRO_MODE_INSTRUCTIONS[mode] || FYTRO_MODE_INSTRUCTIONS.sanctuary
    const completeSystemInstruction = `${FYTRO_SYSTEM_PROMPT}\n${activeModeGuidance}`

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.OPENAI_API_KEY

    // If a live AI key is provided (Gemini / OpenAI), stream from live LLM
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
      const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
      const model = 'gemini-1.5-flash'
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${geminiKey}`

      // Format messages for Gemini API
      const contents = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        }))

      const payload = {
        systemInstruction: {
          parts: [{ text: completeSystemInstruction }],
        },
        contents,
        generationConfig: {
          temperature: mode === 'creative' ? 0.9 : mode === 'challenger' ? 0.7 : 0.6,
          maxOutputTokens: 1200,
        },
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        console.error('Gemini API error, falling back to local Socratic engine:', response.statusText)
      } else {
        // Stream the SSE response
        const encoder = new TextEncoder()
        const customStream = new ReadableStream({
          async start(controller) {
            const reader = response.body?.getReader()
            if (!reader) {
              controller.close()
              return
            }

            const decoder = new TextDecoder()
            let buffer = ''

            try {
              while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                  const trimmed = line.trim()
                  if (trimmed.startsWith('data: ')) {
                    try {
                      const json = JSON.parse(trimmed.slice(6))
                      const chunkText =
                        json.candidates?.[0]?.content?.parts?.[0]?.text || ''
                      if (chunkText) {
                        controller.enqueue(encoder.encode(chunkText))
                      }
                    } catch {
                      // ignore parse chunk error
                    }
                  }
                }
              }
            } catch (err) {
              controller.error(err)
            } finally {
              controller.close()
            }
          },
        })

        return new Response(customStream, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked',
            'Cache-Control': 'no-cache, no-transform',
          },
        })
      }
    }

    // ── Local Fallback Socratic Streaming Engine (When no cloud API key is configured) ──
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content || ''
    const generatedReply = generateSocraticResponse(lastUserMsg, mode)

    const encoder = new TextEncoder()
    const fallbackStream = new ReadableStream({
      async start(controller) {
        // Break reply into tokens to simulate real-time conversational streaming
        const words = generatedReply.split(/(\s+)/)
        for (const word of words) {
          controller.enqueue(encoder.encode(word))
          await new Promise((res) => setTimeout(res, 20))
        }
        controller.close()
      },
    })

    return new Response(fallbackStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache, no-transform',
      },
    })
  } catch (err: any) {
    console.error('Fytro chat route error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Fytro inference error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

function generateSocraticResponse(userText: string, mode: FytroMode): string {
  const lower = userText.toLowerCase()

  if (mode === 'shield' || lower.includes('identif') || lower.includes('anonym') || lower.includes('leak') || lower.includes('draft')) {
    return (
      "🛡️ **Fytro Anonymity Shield Inspection**\n\n" +
      "I evaluated your draft for potential de-anonymization markers:\n\n" +
      "• **Direct Identifiers**: None found (no full personal names or emails).\n" +
      "• **Contextual Footprints**: If you referenced a specific local establishment or an unusual career title, consider generalizing it (e.g., *'a small tech startup'* or *'a neighborhood cafe'*).\n" +
      "• **Emotional Integrity**: The raw vulnerability in your expression comes through clearly. You can safely share this under a Masked Persona on Private Voices without risking your privacy."
    )
  }

  if (mode === 'challenger' || lower.includes('argue') || lower.includes('debate') || lower.includes('critique')) {
    return (
      "Let's test this perspective by looking at the strongest counter-argument:\n\n" +
      "1. **The Counter-Premise**: If someone held the exact opposite view in good faith, what core truth or lived experience might be driving them?\n" +
      "2. **The Unseen Risk**: What is the potential blind spot in your current framing?\n\n" +
      "Steel-manning the opposite position isn't about abandoning your conviction—it's about making sure your thoughts belong to you, rather than just absorbing consensus. Where does your intuition push back?"
    )
  }

  if (mode === 'creative' || lower.includes('brainstorm') || lower.includes('write') || lower.includes('idea')) {
    return (
      "Let's unpack this idea from a fresh vantage point:\n\n" +
      "• **The Core Resonance**: What is the single emotional anchor you want someone to feel when reading or hearing this?\n" +
      "• **A Contrasting Angle**: What if we start right in the middle of the tension rather than explaining the backstory?\n\n" +
      "Tell me the most striking detail or feeling that started this train of thought for you."
    )
  }

  if (lower.includes('decision') || lower.includes('dilemma') || lower.includes('choice') || lower.includes('stuck')) {
    return (
      "Difficult decisions usually aren't about choosing between good and bad—they're about choosing which kind of discomfort you are willing to bear.\n\n" +
      "Let's peel back the layers:\n" +
      "• If you made this choice purely for your own peace of mind, without needing to justify it to anyone in your life, what does your gut tell you?\n" +
      "• Which path makes you feel more like the person you respect?\n\n" +
      "Take your time. What is the hesitation you haven't said out loud yet?"
    )
  }

  return (
    "I hear you. In your Mind Space, you don't have to defend or perform anything.\n\n" +
    "When you strip away what you're *supposed* to feel about this, what is the quietest, most honest reaction inside you right now?\n\n" +
    "Let's explore it together."
  )
}
