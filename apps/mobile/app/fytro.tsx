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
  VolumeX,
  Feather,
  Scale,
  Shield,
  Compass,
} from 'lucide-react-native'
import { useTheme } from '../context/ThemeContext'
import { FytroService, FytroMobileSession } from '../lib/fytroService'
import type {
  FytroMode,
  FytroMemory,
  FytroReaction,
  FytroVoiceId,
} from '@private-voices/shared'
import { FYTRO_VOICE_OPTIONS } from '@private-voices/shared'
import { MobileFytroActionBar } from '../components/MobileFytroActionBar'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

const FYTRO_PROMPTS = [
  {
    icon: 'feather',
    badge: 'Sanctuary',
    title: 'Untangle raw feelings',
    desc: 'Speak honestly without judgment or pressure.',
    starter: "I've been carrying something heavy today and need a safe place to untangle what I really feel...",
  },
  {
    icon: 'shield',
    badge: 'Anonymity Shield',
    title: 'Audit draft for leaks',
    desc: 'Ensure no names, locations, or markers leak.',
    starter: 'Review this draft confession to verify that no identifying details, timestamps, or locations could expose who I am: ',
  },
  {
    icon: 'scale',
    badge: 'Challenger',
    title: 'Stress-test my viewpoint',
    desc: 'Steel-man opposing counter-arguments.',
    starter: "Here is a perspective I hold strongly. Give me the strongest, good-faith counter-arguments against it: ",
  },
  {
    icon: 'compass',
    badge: 'Life Dilemma',
    title: 'Explore difficult choices',
    desc: 'Unbiased Socratic clarity on tough decisions.',
    starter: "I have a difficult personal dilemma with conflicting values. Help me analyze the tradeoffs clearly: ",
  },
]

export default function FytroScreen() {
  const router = useRouter()
  const { colors: themeColors, isDark } = useTheme()

  const [messages, setMessages] = useState<Message[]>([])
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

  // Multi-Voice Selector State
  const [showVoiceModal, setShowVoiceModal] = useState(false)
  const [selectedVoice, setSelectedVoice] = useState<FytroVoiceId>('serene')
  const [isSpeaking, setIsSpeaking] = useState(false)

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
      setMessages([])
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
      setMessages([])
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
            setMessages([])
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
          {/* Voice Selector Button */}
          <TouchableOpacity
            onPress={() => setShowVoiceModal(true)}
            style={styles.iconBtn}
            accessibilityLabel="Voice Options"
          >
            <Volume2 size={18} color={showVoiceModal ? '#7c3aed' : themeColors.textSecondary} />
          </TouchableOpacity>

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
        {/* Messages or Modern Front Landing View */}
        {messages.length === 0 ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.landingContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Hero Greeting */}
            <View style={styles.landingHero}>
              <View style={[styles.landingBadge, { backgroundColor: isDark ? '#2E1065' : '#F5F3FF', borderColor: isDark ? '#4C1D95' : '#DDD6FE' }]}>
                <Sparkles size={12} color="#8B5CF6" />
                <Text style={styles.landingBadgeText}>Mind Space & Autonomous Companion</Text>
              </View>

              <Text style={[styles.landingTitle, { color: themeColors.textPrimary }]}>
                Hello.{'\n'}
                <Text style={{ color: '#8B5CF6' }}>What's on your mind?</Text>
              </Text>

              <Text style={[styles.landingSubtitle, { color: themeColors.textSecondary }]}>
                A private, judgment-free space to explore thoughts, audit draft confessions, or untangle tough life dilemmas.
              </Text>
            </View>

            {/* Mode Selector Chips */}
            <View style={styles.modeChipsRow}>
              {(
                [
                  { id: 'sanctuary', label: 'Sanctuary' },
                  { id: 'challenger', label: 'Challenger' },
                  { id: 'creative', label: 'Creative' },
                  { id: 'shield', label: 'Anonymity Shield' },
                ] as const
              ).map((m) => {
                const isActive = activeMode === m.id
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => setActiveMode(m.id)}
                    style={[
                      styles.modeChip,
                      isActive
                        ? { backgroundColor: '#7c3aed', borderColor: '#7c3aed' }
                        : { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderColor: themeColors.surfaceBorder },
                    ]}
                  >
                    <Text
                      style={[
                        styles.modeChipText,
                        { color: isActive ? '#ffffff' : themeColors.textPrimary },
                      ]}
                    >
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* Prompt Cards Grid */}
            <View style={styles.promptGrid}>
              {FYTRO_PROMPTS.map((p, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => handleSend(p.starter)}
                  style={[
                    styles.modernPromptCard,
                    {
                      backgroundColor: isDark ? '#1e293b50' : '#f8fafc',
                      borderColor: isDark ? '#334155' : '#e2e8f0',
                    },
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.iconWrapper, { backgroundColor: isDark ? '#2e1065' : '#f3e8ff' }]}>
                      {p.icon === 'feather' ? (
                        <Feather size={14} color="#8b5cf6" />
                      ) : p.icon === 'shield' ? (
                        <Shield size={14} color="#10b981" />
                      ) : p.icon === 'scale' ? (
                        <Scale size={14} color="#f59e0b" />
                      ) : (
                        <Compass size={14} color="#0284c7" />
                      )}
                    </View>
                    <Text style={styles.cardBadge}>{p.badge}</Text>
                  </View>
                  <Text style={[styles.cardTitle, { color: themeColors.textPrimary }]}>{p.title}</Text>
                  <Text style={[styles.cardDesc, { color: themeColors.textSecondary }]} numberOfLines={2}>
                    {p.desc}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Privacy Trust Footer */}
            <View style={styles.privacyTrustRow}>
              <Lock size={12} color="#10B981" />
              <Text style={styles.privacyTrustText}>
                Confidential session • Never shared with public training models
              </Text>
            </View>
          </ScrollView>
        ) : (
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
                        isSpeaking={isSpeaking}
                        currentReaction={feedbackMap[item.id] || null}
                        onRegenerate={() => handleRegenerate(item.id)}
                        onToggleSpeech={(txt) => {
                          setIsSpeaking((prev) => !prev)
                          Alert.alert(
                            `Speaking with "${FYTRO_VOICE_OPTIONS.find((v) => v.id === selectedVoice)?.name}"`,
                            txt.slice(0, 150) + (txt.length > 150 ? '...' : ''),
                            [{ text: 'Stop', onPress: () => setIsSpeaking(false) }]
                          )
                        }}
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

      {/* Multi-Voice Selection Modal */}
      <Modal
        visible={showVoiceModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowVoiceModal(false)}
      >
        <SafeAreaView style={[styles.modalOverlay, { justifyContent: 'flex-end' }]}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.surface, borderTopColor: themeColors.surfaceBorder, maxHeight: '75%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Volume2 size={20} color="#7c3aed" />
                <View>
                  <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>Fytro Voice Persona</Text>
                  <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>Choose from 5 distinct vocal tones</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowVoiceModal(false)} style={styles.closeBtn}>
                <X size={18} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
              {FYTRO_VOICE_OPTIONS.map((v) => {
                const isSelected = selectedVoice === v.id
                return (
                  <TouchableOpacity
                    key={v.id}
                    onPress={() => {
                      setSelectedVoice(v.id)
                      setShowVoiceModal(false)
                    }}
                    style={[
                      styles.sessionCard,
                      isSelected && { borderColor: '#7c3aed', backgroundColor: isDark ? '#2E1065' : '#F5F3FF' },
                      { padding: 14 }
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <Text style={[styles.sessionTitle, { color: themeColors.textPrimary, fontWeight: '700' }]}>
                          {v.name}
                        </Text>
                        <View style={[styles.pill, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}>
                          <Text style={[styles.pillText, { color: themeColors.textSecondary }]}>{v.gender}</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 12, color: '#7c3aed', fontWeight: '600', marginBottom: 2 }}>
                        {v.tone}
                      </Text>
                      <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>
                        {v.description}
                      </Text>
                    </View>
                    {isSelected && <Check size={18} color="#7c3aed" />}
                  </TouchableOpacity>
                )
              })}
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
  landingContainer: {
    padding: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },
  landingHero: {
    marginBottom: 20,
  },
  landingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  landingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  landingTitle: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  landingSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  modeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  promptGrid: {
    gap: 10,
    marginBottom: 20,
  },
  modernPromptCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8B5CF6',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  privacyTrustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 8,
  },
  privacyTrustText: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
  },
})
