import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { Sparkles, ChevronRight, X } from 'lucide-react-native'
import { supabase } from '../lib/supabase'

const FALLBACK_PROMPTS = [
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

export function MobileThoughtStarter() {
  const router = useRouter()
  const [currentPrompt, setCurrentPrompt] = useState<{ tag: string; prompt: string; icon: string } | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    async function loadPrompt() {
      try {
        const todayStr = new Date().toISOString().split('T')[0]
        const { data } = await supabase
          .from('daily_thought_prompts')
          .select('tag, prompt, icon')
          .eq('is_active', true)
          .eq('active_date', todayStr)
          .limit(1)
          .maybeSingle()

        if (data) {
          setCurrentPrompt(data)
          return
        }
      } catch {}

      const now = new Date()
      const dayOfYear = Math.floor(
        (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
      )
      setCurrentPrompt(FALLBACK_PROMPTS[dayOfYear % FALLBACK_PROMPTS.length])
    }

    loadPrompt()
  }, [])

  if (dismissed || !currentPrompt) return null

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.tagGroup}>
          <Text style={styles.icon}>{currentPrompt.icon}</Text>
          <Text style={styles.tagText}>{currentPrompt.tag.toUpperCase()}</Text>
          <Text style={styles.subTagText}>• Today's Thought</Text>
        </View>

        <TouchableOpacity onPress={() => setDismissed(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <X size={15} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      <Text style={styles.promptText}>"{currentPrompt.prompt}"</Text>

      <View style={styles.footerRow}>
        <Text style={styles.footerNote}>Share your perspective</Text>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push('/(tabs)/create' as any)}
        >
          <Text style={styles.actionBtnText}>Share</Text>
          <ChevronRight size={14} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 14,
    borderRadius: 20,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tagGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  icon: {
    fontSize: 16,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#b45309',
    letterSpacing: 0.5,
  },
  subTagText: {
    fontSize: 10,
    color: '#9ca3af',
  },
  promptText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    lineHeight: 20,
    marginTop: 8,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#fef3c7',
  },
  footerNote: {
    fontSize: 11,
    color: '#6b7280',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#111827',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
})
