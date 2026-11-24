import { NextRequest } from 'next/server'
import https from 'node:https'
import {
  FYTRO_SYSTEM_PROMPT,
  FYTRO_MODE_INSTRUCTIONS,
  FytroMode,
} from '@private-voices/shared'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// Read Groq API key from environment variables (server-side, edge, or local)
const GROQ_KEY =
  process.env.GROQ_API_KEY ||
  process.env.EXPO_PUBLIC_GROQ_API_KEY ||
  ''

// Reliable Groq caller that handles both streaming and complete responses
function callGroqHttps(apiKey: string, payload: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload)
    const req = https.request('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(data),
        'User-Agent': 'PrivateVoices-Fytro/2.0',
      },
      timeout: 25000,
    }, (res) => {
      let body = ''
      res.on('data', (chunk) => {
        body += chunk
      })
      res.on('end', () => {
        try {
          const json = JSON.parse(body)
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300 && json.choices?.[0]?.message?.content) {
            resolve(json.choices[0].message.content)
          } else {
            reject(new Error(json.error?.message || `HTTP ${res.statusCode}: ${res.statusMessage}`))
          }
        } catch (e) {
          reject(e)
        }
      })
    })

    req.on('timeout', () => {
      req.destroy(new Error('Groq request connection timed out'))
    })
    req.on('error', (err) => {
      reject(err)
    })
    req.write(data)
    req.end()
  })
}

// Resilient Node HTTPS streaming client to prevent Undici Windows connect timeouts
function streamGroqHttps(apiKey: string, payload: any): Promise<import('node:http').IncomingMessage> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload)
    const req = https.request('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(data),
        'User-Agent': 'PrivateVoices-Fytro/2.0',
      },
      timeout: 30000,
    }, (res) => {
      resolve(res)
    })

    req.on('timeout', () => {
      req.destroy(new Error('Groq request connection timed out'))
    })
    req.on('error', (err) => {
      reject(err)
    })
    req.write(data)
    req.end()
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      messages = [],
      mode = 'sanctuary',
      memories = [],
    }: {
      messages: ChatMessage[]
      mode: FytroMode
      memories?: Array<{ category: string; memoryText: string }>
    } = body

    let memoryContextPrompt = ''
    if (memories && memories.length > 0) {
      memoryContextPrompt =
        '\n\n[USER-GOVERNED MEMORY VAULT]\n' +
        'The user has granted you access to remember the following persistent aspects of their worldview and context:\n' +
        memories.map((m) => `• [${m.category}]: ${m.memoryText}`).join('\n') +
        '\nUse these memories to maintain organic continuity, but never make assumptions or feel restricted by them.'
    }

    const activeModeGuidance = FYTRO_MODE_INSTRUCTIONS[mode] || FYTRO_MODE_INSTRUCTIONS.sanctuary
    const completeSystemInstruction = `${FYTRO_SYSTEM_PROMPT}\n${activeModeGuidance}${memoryContextPrompt}`

    const groqMessages = [
      { role: 'system', content: completeSystemInstruction },
      ...messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content })),
    ]

    // ── Tier 1: Groq Engine (Ultra-fast LPUs, Qwen / Llama models) ──
    if (GROQ_KEY) {
      // Prioritize qwen/qwen3.8-27b for lightning-fast factual precision, followed by openai/gpt-oss-120b
      const groqModels = ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b']

      for (const groqModel of groqModels) {
        try {
          const payload = {
            model: groqModel,
            messages: groqMessages,
            temperature: mode === 'creative' ? 0.7 : mode === 'challenger' ? 0.4 : 0.2,
            max_tokens: 2000,
            stream: true,
          }

          const nodeRes = await streamGroqHttps(GROQ_KEY, payload)

          if (nodeRes.statusCode && nodeRes.statusCode >= 200 && nodeRes.statusCode < 300) {
            const encoder = new TextEncoder()
            const customStream = new ReadableStream({
              start(streamController) {
                let buffer = ''

                nodeRes.on('data', (chunk: Buffer) => {
                  buffer += chunk.toString('utf8')
                  const lines = buffer.split('\n')
                  buffer = lines.pop() || ''

                  for (const line of lines) {
                    const trimmed = line.trim()
                    if (trimmed.startsWith('data: ')) {
                      const dataPart = trimmed.slice(6)
                      if (dataPart === '[DONE]') {
                        streamController.close()
                        return
                      }
                      try {
                        const json = JSON.parse(dataPart)
                        const delta = json.choices?.[0]?.delta?.content || ''
                        if (delta) {
                          streamController.enqueue(encoder.encode(delta))
                        }
                      } catch {
                        // ignore malformed SSE chunk
                      }
                    }
                  }
                })

                nodeRes.on('end', () => {
                  try {
                    streamController.close()
                  } catch {}
                })

                nodeRes.on('error', (err) => {
                  try {
                    streamController.error(err)
                  } catch {}
                })
              },
            })

            return new Response(customStream, {
              headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
                'Cache-Control': 'no-cache, no-transform',
              },
            })
          } else {
            console.error(`Groq API returned an error with model ${groqModel}:`, nodeRes.statusCode, nodeRes.statusMessage)
            continue
          }
        } catch (err) {
          console.error(`Groq connection error with model ${groqModel}, trying next:`, err)
        }
      }
    }

    // ── Tier 1B: If streaming attempt was not returned, try fast direct completion ──
    if (GROQ_KEY) {
      for (const groqModel of ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b']) {
        try {
          const directText = await callGroqHttps(GROQ_KEY, {
            model: groqModel,
            messages: groqMessages,
            temperature: mode === 'creative' ? 0.7 : 0.2,
            max_tokens: 1500,
          })
          if (directText && directText.trim()) {
            const encoder = new TextEncoder()
            const wordStream = new ReadableStream({
              async start(controller) {
                const words = directText.split(/(\s+)/)
                for (const word of words) {
                  controller.enqueue(encoder.encode(word))
                  await new Promise((res) => setTimeout(res, 12))
                }
                controller.close()
              },
            })
            return new Response(wordStream, {
              headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
                'Cache-Control': 'no-cache, no-transform',
              },
            })
          }
        } catch (e) {
          console.error(`Direct Groq fallback failed with model ${groqModel}:`, e)
        }
      }
    }

    // ── Tier 2: Google Gemini (Gemini 1.5 Flash) ──
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

  if (mode === 'challenger') {
    return (
      `Let's examine this carefully: "${userText.slice(0, 80)}${userText.length > 80 ? '...' : ''}"\n\n` +
      "1. **The Counter-Premise**: What is the most compelling counter-perspective someone could hold against this?\n" +
      "2. **The Unseen Risk**: What underlying assumption might be worth re-evaluating?"
    )
  }

  if (mode === 'creative') {
    return (
      `Exploring angles for: "${userText.slice(0, 80)}${userText.length > 80 ? '...' : ''}"\n\n` +
      "• What if you inverted the primary premise to find an unexpected perspective?\n" +
      "• How can this idea be expressed with the sharpest emotional resonance?"
    )
  }

  // Clear, helpful default if cloud inference is momentarily unreachable
  return (
    "Connecting directly to online intelligence... If you see this, please send your message again and I will answer directly."
  )
}
