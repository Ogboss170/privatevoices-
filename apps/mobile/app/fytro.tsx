import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, Stack } from 'expo-router'
import {
  ChevronLeft,
  Sparkles,
  Send,
  Flame,
  Lock,
} from 'lucide-react-native'
import { useTheme } from '../context/ThemeContext'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

const FYTRO_PROMPTS = [
  {
    icon: '💭',
    title: 'Safe Venting Room',
    desc: 'Speak without holding back.',
    starter: "I've been holding something inside and need a safe place to untangle my thoughts...",
  },
  {
    icon: '🛡️',
    title: 'Anonymity Shield Check',
    desc: 'Check if a draft leaks your identity.',
    starter: 'Here is a draft thought I want to post. Please check if I accidentally revealed identifying details: ',
  },
  {
    icon: '🧭',
    title: 'Life Dilemma',
    desc: 'Explore different angles of a tough choice.',
    starter: "I have a difficult personal decision to make: ",
  },
  {
    icon: '💡',
    title: 'Deep Thought of the Hour',
    desc: 'Philosophical inquiry on human nature.',
    starter: 'Give me one introspective, deep question to think about today.',
  },
]

export default function FytroScreen() {
  const router = useRouter()
  const { colors: themeColors } = useTheme()

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Welcome to your Mind Space. I'm Fytro.\n\nHere, you can think freely, untangle difficult feelings, or review confidential thoughts before sharing them. Everything stays private.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const flatListRef = useRef<FlatList>(null)

  useEffect(() => {
    flatListRef.current?.scrollToEnd({ animated: true })
  }, [messages])

  const handleSend = (textToSend?: string) => {
    const text = textToSend || input.trim()
    if (!text || thinking) return

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMsg])
    if (!textToSend) setInput('')
    setThinking(true)

    setTimeout(() => {
      let reply = ''
      const lower = text.toLowerCase()

      if (lower.includes('identif') || lower.includes('anonym') || lower.includes('leak') || lower.includes('draft')) {
        reply =
          "🛡️ Fytro Anonymity Shield:\n\n" +
          "• Names & Organizations: Clear.\n" +
          "• Contextual Markers: Safe. No unique timestamps or narrow addresses detected.\n" +
          "• You can safely post this under a Masked Persona on Private Voices."
      } else if (lower.includes('decision') || lower.includes('dilemma') || lower.includes('choice')) {
        reply =
          "When paths diverge, look at the root:\n\n" +
          "1. Which choice protects your peace versus satisfying expectations?\n" +
          "2. What is the fear behind each path?\n\n" +
          "Tell me a bit more about what you hesitate on."
      } else if (lower.includes('question') || lower.includes('philosoph')) {
        reply =
          "Here is a thought for your Mind Space today:\n\n" +
          "\"What is something you pretend to care about just to fit in, and what do you genuinely care about that you hide?\""
      } else {
        reply =
          "I hear you. In this Mind Space, you don't have to filter or perform.\n\n" +
          "What does this situation make you feel most deeply right now?"
      }

      const botMsg: Message = {
        id: `b-${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      setMessages((prev) => [...prev, botMsg])
      setThinking(false)
    }, 600)
  }

  const handleBurn = () => {
    Alert.alert(
      'Burn Session',
      'Permanently wipe this conversation from your screen?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Burn',
          style: 'destructive',
          onPress: () => {
            setMessages([
              {
                id: 'welcome-clean',
                role: 'assistant',
                content: 'Session burned cleanly. Your Mind Space is fresh and clear.',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
            ])
          },
        },
      ]
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: themeColors.surfaceBorder, backgroundColor: themeColors.surface }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color={themeColors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.avatarWrap}>
            <Sparkles size={16} color="#ffffff" />
          </View>
          <View>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: themeColors.textPrimary }]}>Fytro</Text>
              <View style={styles.pill}>
                <Text style={styles.pillText}>Mind Space</Text>
              </View>
            </View>
            <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
              Think freely • Explore deeply
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={handleBurn} style={styles.burnBtn}>
          <Flame size={18} color="#ef4444" />
          <Text style={styles.burnText}>Burn</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.privacyBanner}>
              <Lock size={15} color="#7c3aed" />
              <Text style={styles.privacyBannerText}>
                Zero-Judgment Zone: Ephemeral thoughts shielded by Private Voices.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isUser = item.role === 'user'
            return (
              <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowBot]}>
                {!isUser && (
                  <View style={styles.botIcon}>
                    <Sparkles size={12} color="#ffffff" />
                  </View>
                )}
                <View
                  style={[
                    styles.bubble,
                    isUser
                      ? styles.bubbleUser
                      : [styles.bubbleBot, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }],
                  ]}
                >
                  <Text style={[styles.msgText, isUser ? styles.msgTextUser : { color: themeColors.textPrimary }]}>
                    {item.content}
                  </Text>
                  <Text style={[styles.msgTime, isUser ? styles.msgTimeUser : { color: themeColors.textSecondary }]}>
                    {item.timestamp}
                  </Text>
                </View>
              </View>
            )
          }}
        />

        {thinking && (
          <View style={styles.thinkingWrap}>
            <Text style={styles.thinkingText}>Fytro is reflecting...</Text>
          </View>
        )}

        {/* Input Bar */}
        <SafeAreaView edges={['bottom']} style={[styles.inputBar, { backgroundColor: themeColors.surface, borderTopColor: themeColors.surfaceBorder }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Tell Fytro what's on your mind..."
            placeholderTextColor={themeColors.textSecondary}
            style={[styles.input, { color: themeColors.textPrimary, backgroundColor: themeColors.background }]}
          />
          <TouchableOpacity
            onPress={() => handleSend()}
            disabled={!input.trim() || thinking}
            style={[styles.sendBtn, (!input.trim() || thinking) && { opacity: 0.5 }]}
          >
            <Send size={16} color="#ffffff" />
          </TouchableOpacity>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    padding: 4,
  },
  avatarWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
  },
  pill: {
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  pillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#7c3aed',
  },
  subtitle: {
    fontSize: 10,
    marginTop: 1,
  },
  burnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  burnText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
  },
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
  },
  privacyBannerText: {
    fontSize: 11,
    color: '#7c3aed',
    flex: 1,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  msgRow: {
    flexDirection: 'row',
    marginVertical: 6,
  },
  msgRowUser: {
    justifyContent: 'flex-end',
  },
  msgRowBot: {
    justifyContent: 'flex-start',
    gap: 8,
  },
  botIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleUser: {
    backgroundColor: '#7c3aed',
    borderTopRightRadius: 2,
  },
  bubbleBot: {
    borderTopLeftRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  msgText: {
    fontSize: 13,
    lineHeight: 18,
  },
  msgTextUser: {
    color: '#ffffff',
  },
  msgTime: {
    fontSize: 9,
    marginTop: 4,
    textAlign: 'right',
  },
  msgTimeUser: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  thinkingWrap: {
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  thinkingText: {
    fontSize: 11,
    color: '#a855f7',
    fontStyle: 'italic',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 13,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
