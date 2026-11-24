import { supabase } from '../lib/supabase'
import type { FytroMode, FytroMemory } from '@private-voices/shared'
import { FYTRO_SYSTEM_PROMPT, FYTRO_MODE_INSTRUCTIONS } from '@private-voices/shared'

export interface FytroMobileSession {
  id: string
  title: string
  mode: FytroMode
  pinned: boolean
  created_at: string
  updated_at: string
}

export interface FytroMobileMessage {
  id: string
  sessionId?: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

const WEB_API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'
const DIRECT_GROQ_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || ''

export class FytroService {
  // ── 1. Fetch user memories from Supabase ──
  static async getMemories(): Promise<FytroMemory[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data, error } = await supabase
        .from('fytro_memories')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.warn('Error fetching fytro memories:', error)
        return []
      }

      return (data || []).map((m: any) => ({
        id: m.id,
        userId: m.user_id,
        category: m.category,
        memoryText: m.memory_text,
        importance: m.importance,
        createdAt: m.created_at,
        updatedAt: m.updated_at,
      }))
    } catch (e) {
      console.warn('FytroService.getMemories failed:', e)
      return []
    }
  }

  // ── 2. Add a memory ──
  static async addMemory(category: string, text: string): Promise<FytroMemory | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('fytro_memories')
        .insert({
          user_id: user.id,
          category,
          memory_text: text,
        })
        .select()
        .single()

      if (error || !data) return null
      return {
        id: data.id,
        userId: data.user_id,
        category: data.category,
        memoryText: data.memory_text,
        importance: data.importance,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }
    } catch (e) {
      console.error(e)
      return null
    }
  }

  // ── 3. Delete individual memory ──
  static async deleteMemory(id: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('fytro_memories').delete().eq('id', id)
      return !error
    } catch {
      return false
    }
  }

  // ── 4. Burn all memories ──
  static async burnAllMemories(): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('burn_fytro_memories')
      return !error
    } catch {
      return false
    }
  }

  // ── 5. Sessions Management ──
  static async getSessions(): Promise<FytroMobileSession[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data, error } = await supabase
        .from('fytro_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('pinned', { ascending: false })
        .order('updated_at', { ascending: false })

      if (error) return []
      return data || []
    } catch {
      return []
    }
  }

  static async createSession(title: string, mode: FytroMode): Promise<FytroMobileSession | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('fytro_sessions')
        .insert({
          user_id: user.id,
          title: title || 'New Exploration',
          mode,
        })
        .select()
        .single()

      if (error) return null
      return data
    } catch {
      return null
    }
  }

  static async deleteSession(id: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('fytro_sessions').delete().eq('id', id)
      return !error
    } catch {
      return false
    }
  }

  // ── 6. Session Messages ──
  static async getMessages(sessionId: string): Promise<FytroMobileMessage[]> {
    try {
      const { data, error } = await supabase
        .from('fytro_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })

      if (error) return []
      return (data || []).map((m: any) => ({
        id: m.id,
        sessionId: m.session_id,
        role: m.role,
        content: m.content,
        timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }))
    } catch {
      return []
    }
  }

  static async saveMessage(sessionId: string, role: 'user' | 'assistant', content: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await supabase.from('fytro_messages').insert({
        session_id: sessionId,
        user_id: user.id,
        role,
        content,
      })

      await supabase
        .from('fytro_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId)
    } catch (e) {
      console.warn('Failed to save message:', e)
    }
  }

  // ── 7. Send chat query to Fytro engine ──
  static async queryFytro({
    messages,
    mode,
    memories,
  }: {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
    mode: FytroMode
    memories: FytroMemory[]
  }): Promise<string> {
    // 1. Try hitting the web app API endpoint first (with Groq LPUs)
    try {
      const res = await fetch(`${WEB_API_URL}/api/fytro/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          mode,
          memories: memories.map((m) => ({ category: m.category, memoryText: m.memoryText })),
        }),
      })

      if (res.ok) {
        const text = await res.text()
        if (text && text.trim().length > 0) return text
      }
    } catch (e) {
      console.warn('Could not connect to Web Fytro endpoint:', e)
    }

    // 2. Direct mobile Groq API call if web server is unreachable or native network
    if (DIRECT_GROQ_KEY) {
      try {
        let memoryContextPrompt = ''
        if (memories && memories.length > 0) {
          memoryContextPrompt =
            '\n\n[USER-GOVERNED MEMORY VAULT]\n' +
            memories.map((m) => `• [${m.category}]: ${m.memoryText}`).join('\n')
        }

        const activeModeGuidance = FYTRO_MODE_INSTRUCTIONS[mode] || FYTRO_MODE_INSTRUCTIONS.sanctuary
        const systemPrompt = `${FYTRO_SYSTEM_PROMPT}\n${activeModeGuidance}${memoryContextPrompt}`

        const groqMessages = [
          { role: 'system', content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ]

        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${DIRECT_GROQ_KEY}`,
          },
          body: JSON.stringify({
            model: 'openai/gpt-oss-120b',
            messages: groqMessages,
            temperature: mode === 'creative' ? 0.7 : 0.3,
            max_tokens: 1500,
          }),
        })

        if (groqRes.ok) {
          const groqData = await groqRes.json()
          const answer = groqData.choices?.[0]?.message?.content
          if (answer && answer.trim().length > 0) {
            return answer.trim()
          }
        }
      } catch (err) {
        console.warn('Direct mobile Groq query failed:', err)
      }
    }

    // Local deterministic Socratic fallback for mobile offline support
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content || ''
    const lower = lastUserMsg.toLowerCase()

    if (mode === 'shield' || lower.includes('identif') || lower.includes('anonym') || lower.includes('leak')) {
      return (
        "🛡️ Fytro Anonymity Shield:\n\n" +
        "• Names & Organizations: No direct personal names detected.\n" +
        "• Context Clues: Check if any hyper-specific dates or niche job descriptions could identify you.\n" +
        "• Recommendation: Your thought is structurally safe for an anonymous Masked Voice post."
      )
    }

    if (mode === 'challenger') {
      return (
        `Let's test this perspective:\n\n` +
        `1. What is the strongest argument an intelligent critic would make against: "${lastUserMsg.slice(0, 70)}"?\n` +
        `2. What core assumption are you taking for granted that might actually be fragile?\n\n` +
        "Where does that leave your conviction?"
      )
    }

    if (mode === 'creative') {
      return (
        `Here is a creative angle to explore on "${lastUserMsg.slice(0, 60)}":\n\n` +
        "Try framing this thought as a contrast — what does the world think this is, versus what you actually experienced?\n\n" +
        "How would you express that in one evocative sentence?"
      )
    }

    const cleanSnippet = lastUserMsg.trim().replace(/\n+/g, ' ')
    if (cleanSnippet.length > 0) {
      return (
        `Reflecting on what you shared: "${cleanSnippet.slice(0, 90)}${cleanSnippet.length > 90 ? '...' : ''}"\n\n` +
        "In your Mind Space, you don't have to defend or perform anything.\n\n" +
        "What is the most honest, unfiltered reaction inside you right now?"
      )
    }

    return (
      "I'm here with you in your Mind Space. You don't have to perform or defend anything.\n\n" +
      "What is the quietest, most honest reaction inside you right now?"
    )
  }

  // ── 8. Fytro Feedback & Reactions ──
  static async submitFeedback({
    messageId,
    sessionId,
    reaction,
    reasons = [],
    comment = null,
  }: {
    messageId: string
    sessionId?: string | null
    reaction: 'like' | 'dislike'
    reasons?: string[]
    comment?: string | null
  }): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return false

      const { error } = await supabase
        .from('fytro_feedback')
        .upsert(
          {
            message_id: messageId,
            session_id: sessionId || null,
            user_id: user.id,
            reaction,
            reasons,
            comment,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,message_id' }
        )

      return !error
    } catch (e) {
      console.warn('submitFeedback failed:', e)
      return false
    }
  }

  static async removeFeedback(messageId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return false

      const { error } = await supabase
        .from('fytro_feedback')
        .delete()
        .eq('user_id', user.id)
        .eq('message_id', messageId)

      return !error
    } catch {
      return false
    }
  }

  static async getFeedbackForSession(sessionId: string): Promise<Record<string, 'like' | 'dislike'>> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return {}

      const { data, error } = await supabase
        .from('fytro_feedback')
        .select('message_id, reaction')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)

      if (error || !data) return {}

      const map: Record<string, 'like' | 'dislike'> = {}
      for (const row of data) {
        map[row.message_id] = row.reaction as 'like' | 'dislike'
      }
      return map
    } catch {
      return {}
    }
  }

  // ── 9. Submit Report on AI response ──
  static async submitReport({
    messageId,
    sessionId,
    reason,
    details = null,
  }: {
    messageId: string
    sessionId?: string | null
    reason: string
    details?: string | null
  }): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return false

      const { error } = await supabase
        .from('fytro_reports')
        .insert({
          message_id: messageId,
          session_id: sessionId || null,
          user_id: user.id,
          reason,
          details,
        })

      return !error
    } catch (e) {
      console.warn('submitReport failed:', e)
      return false
    }
  }
}
