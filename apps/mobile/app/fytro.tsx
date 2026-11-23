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
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, Stack } from 'expo-router'
import {
  ChevronLeft,
  Sparkles,
  Send,
  Flame,
  Lock,
  Brain,
  History,
  X,
  Plus,
  Trash2,
  Check,
  MessageSquare,
  Mic,
  Volume2,
} from 'lucide-react-native'
import { useTheme } from '../context/ThemeContext'
import { FytroService, FytroMobileSession } from '../lib/fytroService'
import type { FytroMode, FytroMemory, FytroReaction } from '@private-voices/shared'
import { MobileFytroActionBar } from '../components/MobileFytroActionBar'

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
  const { colors: themeColors, isDark } = useTheme()

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Welcome to your Mind Space. I'm Fytro.\n\nHere, you can think freely, untangle difficult feelings, or review confidential thoughts before sharing them. Powered by fast intelligence and self-sovereign memory.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ])
  const [input, setInput] = useState('')
  const [activeMode, setActiveMode] = useState<FytroMode>('sanctuary')
  const [thinking, setThinking] = useState(false)
  const flatListRef = useRef<FlatList>(null)

  // Memory Vault Modal State
  const [showVaultModal, setShowVaultModal] = useState(false)
  const [memories, setMemories] = useState<FytroMemory[]>([])
  const [newMemoryText, setNewMemoryText] = useState('')
  const [newMemoryCategory, setNewMemoryCategory] = useState<string>('perspective')
  const [loadingMemories, setLoadingMemories] = useState(false)

  // Sessions History Modal State
  const [showSessionsModal, setShowSessionsModal] = useState(false)
  const [sessions, setSessions] = useState<FytroMobileSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [feedbackMap, setFeedbackMap] = useState<Record<string, FytroReaction>>({})

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const [fetchedMemories, fetchedSessions] = await Promise.all([
      FytroService.getMemories(),
      FytroService.getSessions(),
    ])
    setMemories(fetchedMemories)
    setSessions(fetchedSessions)
  }

  useEffect(() => {
    flatListRef.current?.scrollToEnd({ animated: true })
  }, [messages])

  // Switch or open a session
  const handleSelectSession = async (session: FytroMobileSession) => {
    setCurrentSessionId(session.id)
    setActiveMode(session.mode)
    setShowSessionsModal(false)

    const sessionMsgs = await FytroService.getMessages(session.id)
    if (sessionMsgs.length > 0) {
      setMessages(
        sessionMsgs.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        }))
      )
    } else {
      setMessages([
        {
          id: 'welcome-session',
          role: 'assistant',
          content: `Resumed exploration: "${session.title}". What would you like to think about?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    }

    // Load feedback reactions for this session
    FytroService.getFeedbackForSession(session.id).then((map) => {
      setFeedbackMap(map as Record<string, FytroReaction>)
    }).catch(console.warn)
  }

  const handleCreateNewSession = async () => {
    const newSession = await FytroService.createSession('New Exploration', activeMode)
    if (newSession) {
      setSessions((prev) => [newSession, ...prev])
      setCurrentSessionId(newSession.id)
      setMessages([
        {
          id: 'welcome-fresh',
          role: 'assistant',
          content: 'Started fresh Mind Space exploration. Speak freely.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
      setShowSessionsModal(false)
    }
  }

  const handleDeleteSession = async (id: string) => {
    Alert.alert('Delete Session', 'Are you sure you want to delete this chat exploration?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await FytroService.deleteSession(id)
          setSessions((prev) => prev.filter((s) => s.id !== id))
          if (currentSessionId === id) {
            setCurrentSessionId(null)
          }
        },
      },
    ])
  }

  // Memory Vault Handlers
  const handleAddMemory = async () => {
    if (!newMemoryText.trim()) return
    const mem = await FytroService.addMemory(newMemoryCategory, newMemoryText.trim())
    if (mem) {
      setMemories((prev) => [mem, ...prev])
      setNewMemoryText('')
    }
  }

  const handleDeleteMemory = async (id: string) => {
    await FytroService.deleteMemory(id)
    setMemories((prev) => prev.filter((m) => m.id !== id))
  }

  const handleBurnAllMemories = () => {
    Alert.alert(
      'Burn Memory Vault',
      'This will erase all persistent memories Fytro has retained about your perspectives.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Burn All',
          style: 'destructive',
          onPress: async () => {
            await FytroService.burnAllMemories()
            setMemories([])
          },
        },
      ]
    )
  }

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input.trim()
    if (!text || thinking) return

    // Auto-create session if not present
    let activeSid = currentSessionId
    if (!activeSid) {
      const titleSnippet = text.length > 25 ? text.slice(0, 25) + '...' : text
      const newS = await FytroService.createSession(titleSnippet, activeMode)
      if (newS) {
        activeSid = newS.id
        setCurrentSessionId(activeSid)
        setSessions((prev) => [newS, ...prev])
      }
    }

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    const updated = [...messages, userMsg]
    setMessages(updated)
    if (!textToSend) setInput('')
    setThinking(true)

    if (activeSid) {
      FytroService.saveMessage(activeSid, 'user', text).catch(console.warn)
    }

    try {
      const reply = await FytroService.queryFytro({
        messages: updated.map((m) => ({ role: m.role, content: m.content })),
        mode: activeMode,
        memories,
      })

      const botMsg: Message = {
        id: `b-${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      setMessages((prev) => [...prev, botMsg])

      if (activeSid) {
        FytroService.saveMessage(activeSid, 'assistant', reply).catch(console.warn)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setThinking(false)
    }
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
            setCurrentSessionId(null)
            setFeedbackMap({})
          },
        },
      ]
    )
  }

  // Regenerate last response
  const handleRegenerate = (botMsgId: string) => {
    if (thinking) return
    const botIdx = messages.findIndex((m) => m.id === botMsgId)
    if (botIdx === -1) return

    let precedingUserText = ''
    for (let i = botIdx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        precedingUserText = messages[i].content
        break
      }
    }

    if (!precedingUserText) return
    const truncated = messages.slice(0, botIdx)
    setMessages(truncated)
    handleSend(precedingUserText)
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

        <View style={styles.headerRight}>
          {/* Sessions Drawer Button */}
          <TouchableOpacity
            onPress={() => setShowSessionsModal(true)}
            style={styles.iconBtn}
            accessibilityLabel="Chat Sessions"
          >
            <History size={18} color={themeColors.textSecondary} />
          </TouchableOpacity>

          {/* Memory Vault Button */}
          <TouchableOpacity
            onPress={() => setShowVaultModal(true)}
            style={styles.iconBtn}
            accessibilityLabel="Memory Vault"
          >
            <Brain size={18} color="#7c3aed" />
          </TouchableOpacity>

          {/* Burn Button */}
          <TouchableOpacity onPress={handleBurn} style={styles.burnBtn}>
            <Flame size={17} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Mode Switcher Chips */}
      <View style={[styles.modeRow, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.surfaceBorder }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeScroll}>
          {(['sanctuary', 'challenger', 'creative', 'shield'] as FytroMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              onPress={() => setActiveMode(mode)}
              style={[
                styles.modeChip,
                activeMode === mode && styles.modeChipActive,
                { borderColor: activeMode === mode ? '#7c3aed' : themeColors.surfaceBorder },
              ]}
            >
              <Text
                style={[
                  styles.modeChipText,
                  activeMode === mode ? styles.modeChipTextActive : { color: themeColors.textSecondary },
                ]}
              >
                {mode === 'sanctuary' && '🌿 Sanctuary'}
                {mode === 'challenger' && '⚔️ Challenger'}
                {mode === 'creative' && '✨ Creative'}
                {mode === 'shield' && '🛡️ Shield'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
              <Lock size={14} color="#7c3aed" />
              <Text style={styles.privacyBannerText}>
                Fytro conversations are strictly private and never used to train public models.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isUser = item.role === 'user'
            return (
              <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowBot]}>
                {!isUser && (
                  <View style={styles.botIconSmall}>
                    <Sparkles size={12} color="#ffffff" />
                  </View>
                )}
                <View
                  style={[
                    styles.msgBubble,
                    isUser
                      ? styles.userBubble
                      : [styles.botBubble, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderColor: themeColors.surfaceBorder }],
                  ]}
                >
                  <Text
                    style={[
                      styles.msgText,
                      isUser ? styles.userMsgText : { color: themeColors.textPrimary },
                    ]}
                  >
                    {item.content}
                  </Text>
                  <Text
                    style={[
                      styles.timestamp,
                      isUser ? styles.userTimestamp : { color: themeColors.textSecondary },
                    ]}
                  >
                    {item.timestamp}
                  </Text>

                  {/* Clean, responsive Fytro response action bar */}
                  {!isUser && (
                    <MobileFytroActionBar
                      messageId={item.id}
                      sessionId={currentSessionId}
                      content={item.content}
                      isStreaming={thinking && messages[messages.length - 1]?.id === item.id}
                      currentReaction={feedbackMap[item.id] || null}
                      onRegenerate={() => handleRegenerate(item.id)}
                      onReactionChange={(reaction) => {
                        setFeedbackMap((prev) => {
                          const updated = { ...prev }
                          if (reaction) {
                            updated[item.id] = reaction
                          } else {
                            delete updated[item.id]
                          }
                          return updated
                        })
                      }}
                    />
                  )}
                </View>
              </View>
            )
          }}
          ListFooterComponent={
            thinking ? (
              <View style={styles.thinkingRow}>
                <ActivityIndicator size="small" color="#7c3aed" />
                <Text style={[styles.thinkingText, { color: themeColors.textSecondary }]}>
                  Thinking...
                </Text>
              </View>
            ) : null
          }
        />

        {/* Quick prompt cards when starting out */}
        {messages.length <= 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.promptScroll}
          >
            {FYTRO_PROMPTS.map((p, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => handleSend(p.starter)}
                style={[styles.promptCard, { backgroundColor: isDark ? '#1e1b4b' : '#f5f3ff', borderColor: '#ddd6fe' }]}
              >
                <Text style={styles.promptIcon}>{p.icon}</Text>
                <Text style={styles.promptTitle}>{p.title}</Text>
                <Text style={styles.promptDesc} numberOfLines={2}>{p.desc}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Input Bar */}
        <View style={[styles.inputBar, { backgroundColor: themeColors.surface, borderTopColor: themeColors.surfaceBorder }]}>
          <TextInput
            style={[styles.input, { color: themeColors.textPrimary, backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderColor: themeColors.surfaceBorder }]}
            value={input}
            onChangeText={setInput}
            placeholder="Tell Fytro what's on your mind..."
            placeholderTextColor={themeColors.textSecondary}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || thinking) && styles.sendBtnDisabled]}
            onPress={() => handleSend()}
            disabled={!input.trim() || thinking}
          >
            <Send size={16} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── Modal: Self-Sovereign Memory Vault ── */}
      <Modal visible={showVaultModal} animationType="slide" transparent>
        <SafeAreaView style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.surface }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Brain size={20} color="#7c3aed" />
                <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>Memory Vault</Text>
              </View>
              <TouchableOpacity onPress={() => setShowVaultModal(false)}>
                <X size={20} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: themeColors.textSecondary }]}>
              Control everything Fytro retains across sessions. Delete or burn anytime.
            </Text>

            {/* Add memory field */}
            <View style={styles.addMemoryBox}>
              <TextInput
                style={[styles.memoryInput, { color: themeColors.textPrimary, borderColor: themeColors.surfaceBorder }]}
                value={newMemoryText}
                onChangeText={setNewMemoryText}
                placeholder="Teach Fytro a core perspective (e.g., 'I prefer direct feedback')..."
                placeholderTextColor={themeColors.textSecondary}
              />
              <TouchableOpacity style={styles.addMemoryBtn} onPress={handleAddMemory}>
                <Plus size={16} color="#fff" />
                <Text style={styles.addMemoryBtnText}>Remember</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }}>
              {memories.length === 0 ? (
                <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                  Vault is empty. Fytro currently holds zero persistent profile memories.
                </Text>
              ) : (
                memories.map((m) => (
                  <View key={m.id} style={[styles.memoryCard, { borderColor: themeColors.surfaceBorder }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memoryCategory}>[{m.category}]</Text>
                      <Text style={[styles.memoryText, { color: themeColors.textPrimary }]}>{m.memoryText}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteMemory(m.id)}>
                      <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>

            {memories.length > 0 && (
              <TouchableOpacity style={styles.burnAllBtn} onPress={handleBurnAllMemories}>
                <Flame size={16} color="#ef4444" />
                <Text style={styles.burnAllBtnText}>Burn All Vault Memories</Text>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* ── Modal: Chat Sessions History ── */}
      <Modal visible={showSessionsModal} animationType="slide" transparent>
        <SafeAreaView style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.surface }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <History size={20} color="#7c3aed" />
                <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>Explorations</Text>
              </View>
              <TouchableOpacity onPress={() => setShowSessionsModal(false)}>
                <X size={20} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.newSessionBtn} onPress={handleCreateNewSession}>
              <Plus size={16} color="#fff" />
              <Text style={styles.newSessionBtnText}>Start Fresh Exploration</Text>
            </TouchableOpacity>

            <ScrollView style={{ flex: 1, marginTop: 12 }}>
              {sessions.length === 0 ? (
                <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                  No past sessions yet. Start chatting to build your thought history.
                </Text>
              ) : (
                sessions.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => handleSelectSession(s)}
                    style={[
                      styles.sessionCard,
                      currentSessionId === s.id && styles.sessionCardActive,
                      { borderColor: themeColors.surfaceBorder },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <MessageSquare size={16} color="#7c3aed" />
                      <Text style={[styles.sessionTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
                        {s.title}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteSession(s.id)}>
                      <Trash2 size={15} color="#9ca3af" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { padding: 4 },
  iconBtn: { padding: 7, borderRadius: 20 },
  avatarWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 16, fontWeight: '700' },
  pill: {
    backgroundColor: '#ede9fe',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pillText: { fontSize: 10, fontWeight: '700', color: '#7c3aed' },
  subtitle: { fontSize: 11 },
  burnBtn: {
    padding: 7,
    borderRadius: 20,
    backgroundColor: '#fef2f2',
  },
  modeRow: {
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  modeScroll: { paddingHorizontal: 16, gap: 8 },
  modeChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  modeChipActive: {
    backgroundColor: '#7c3aed',
  },
  modeChipText: { fontSize: 12, fontWeight: '600' },
  modeChipTextActive: { color: '#ffffff' },
  listContent: { padding: 16, paddingBottom: 24 },
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#f5f3ff',
    marginBottom: 16,
  },
  privacyBannerText: { fontSize: 11, color: '#6d28d9', flex: 1 },
  msgRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  msgRowUser: { justifyContent: 'flex-end' },
  msgRowBot: { justifyContent: 'flex-start' },
  botIconSmall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    marginBottom: 4,
  },
  msgBubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  userBubble: {
    backgroundColor: '#7c3aed',
    borderBottomRightRadius: 4,
  },
  botBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  msgText: { fontSize: 14, lineHeight: 20 },
  userMsgText: { color: '#ffffff' },
  timestamp: { fontSize: 9, marginTop: 4, textAlign: 'right' },
  userTimestamp: { color: '#ddd6fe' },
  thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginLeft: 28 },
  thinkingText: { fontSize: 12, fontStyle: 'italic' },
  promptScroll: { paddingHorizontal: 16, gap: 10, paddingBottom: 10 },
  promptCard: {
    width: 170,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  promptIcon: { fontSize: 20, marginBottom: 4 },
  promptTitle: { fontSize: 12, fontWeight: '700', color: '#5b21b6' },
  promptDesc: { fontSize: 10, color: '#6b7280', marginTop: 2 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    fontSize: 14,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: {
    height: '75%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalSubtitle: { fontSize: 12, marginTop: 4, marginBottom: 14 },
  addMemoryBox: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  memoryInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
  },
  addMemoryBtn: {
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addMemoryBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  memoryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  memoryCategory: { fontSize: 10, fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase' },
  memoryText: { fontSize: 12, marginTop: 2 },
  emptyText: { textAlign: 'center', fontSize: 12, marginTop: 40 },
  burnAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 10,
  },
  burnAllBtnText: { color: '#ef4444', fontSize: 12, fontWeight: '700' },
  newSessionBtn: {
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  newSessionBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  sessionCardActive: {
    borderColor: '#7c3aed',
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
  },
  sessionTitle: { fontSize: 13, fontWeight: '600' },
})
