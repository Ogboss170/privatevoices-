import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  Modal,
  SafeAreaView,
  Share,
} from 'react-native'
import { Stack, useRouter } from 'expo-router'
import {
  BookOpen,
  Calendar,
  Heart,
  Bookmark,
  MessageCircle,
  Share2,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Send,
  Sparkles,
} from 'lucide-react-native'
import { supabase } from '../lib/supabase'
import { useTheme } from '../context/ThemeContext'
import type { DailyThoughtPrompt, PromptComment } from '@private-voices/shared'

const ACCENT = '#7c3aed'

const THEMES = [
  'All',
  'Daily Reflection',
  'Curiosity',
  'Unfiltered Thought',
  'Deep Question',
  'Life Reflection',
  'Growth',
]

export default function MobileJournalScreen() {
  const router = useRouter()
  const { colors: themeColors, isDark } = useTheme()

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [prompts, setPrompts] = useState<DailyThoughtPrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTheme, setSelectedTheme] = useState('All')
  const [timeframe, setTimeframe] = useState<'all' | 'month' | 'week'>('all')

  // Discussion Modal state
  const [activePrompt, setActivePrompt] = useState<DailyThoughtPrompt | null>(null)
  const [comments, setComments] = useState<PromptComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [commentIsMasked, setCommentIsMasked] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
  }, [])

  // Fetch prompts
  const fetchPrompts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('daily_thought_prompts')
        .select('*')
        .order('active_date', { ascending: false })

      if (!error && data) {
        const hydrated: DailyThoughtPrompt[] = await Promise.all(
          data.map(async (p: any) => {
            const [
              { count: rCount },
              { count: sCount },
              { count: cCount },
              myRRes,
              mySRes,
            ] = await Promise.all([
              supabase.from('prompt_reactions').select('*', { count: 'exact', head: true }).eq('prompt_id', p.id),
              supabase.from('prompt_saves').select('*', { count: 'exact', head: true }).eq('prompt_id', p.id),
              supabase.from('prompt_comments').select('*', { count: 'exact', head: true }).eq('prompt_id', p.id),
              currentUserId
                ? supabase.from('prompt_reactions').select('user_id').eq('prompt_id', p.id).eq('user_id', currentUserId).maybeSingle()
                : Promise.resolve({ data: null }),
              currentUserId
                ? supabase.from('prompt_saves').select('user_id').eq('prompt_id', p.id).eq('user_id', currentUserId).maybeSingle()
                : Promise.resolve({ data: null }),
            ])

            return {
              id: p.id,
              tag: p.tag,
              prompt: p.prompt,
              icon: p.icon || '💭',
              activeDate: p.active_date,
              isActive: p.is_active,
              reactionCount: rCount || 0,
              saveCount: sCount || 0,
              commentCount: cCount || 0,
              isReactedByMe: Boolean(myRRes.data),
              isSavedByMe: Boolean(mySRes.data),
            }
          })
        )
        setPrompts(hydrated)
      }
    } catch (err) {
      console.error('Error fetching mobile reflection journal:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [currentUserId])

  useEffect(() => {
    fetchPrompts()
  }, [fetchPrompts])

  // Filtered prompts
  const filteredPrompts = useMemo(() => {
    return prompts.filter((p) => {
      if (selectedTheme !== 'All' && p.tag.toLowerCase() !== selectedTheme.toLowerCase()) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesPrompt = p.prompt.toLowerCase().includes(q)
        const matchesTag = p.tag.toLowerCase().includes(q)
        if (!matchesPrompt && !matchesTag) return false
      }
      if (timeframe !== 'all' && p.activeDate) {
        const promptDate = new Date(p.activeDate)
        const diffDays = (new Date().getTime() - promptDate.getTime()) / (1000 * 60 * 60 * 24)
        if (timeframe === 'week' && diffDays > 7) return false
        if (timeframe === 'month' && diffDays > 30) return false
      }
      return true
    })
  }, [prompts, selectedTheme, searchQuery, timeframe])

  // Like Toggle
  const handleToggleLike = async (promptId: string) => {
    if (!currentUserId) return
    setPrompts((prev) =>
      prev.map((p) => {
        if (p.id !== promptId) return p
        const nextR = !p.isReactedByMe
        return {
          ...p,
          isReactedByMe: nextR,
          reactionCount: nextR ? (p.reactionCount || 0) + 1 : Math.max(0, (p.reactionCount || 1) - 1),
        }
      })
    )

    const target = prompts.find((p) => p.id === promptId)
    if (target?.isReactedByMe) {
      await supabase.from('prompt_reactions').delete().eq('prompt_id', promptId).eq('user_id', currentUserId)
    } else {
      await supabase.from('prompt_reactions').insert({ prompt_id: promptId, user_id: currentUserId })
    }
  }

  // Save Toggle
  const handleToggleSave = async (promptId: string) => {
    if (!currentUserId) return
    setPrompts((prev) =>
      prev.map((p) => {
        if (p.id !== promptId) return p
        const nextS = !p.isSavedByMe
        return {
          ...p,
          isSavedByMe: nextS,
          saveCount: nextS ? (p.saveCount || 0) + 1 : Math.max(0, (p.saveCount || 1) - 1),
        }
      })
    )

    const target = prompts.find((p) => p.id === promptId)
    if (target?.isSavedByMe) {
      await supabase.from('prompt_saves').delete().eq('prompt_id', promptId).eq('user_id', currentUserId)
    } else {
      await supabase.from('prompt_saves').insert({ prompt_id: promptId, user_id: currentUserId })
    }
  }

  // Open Discussion
  const handleOpenDiscussion = async (prompt: DailyThoughtPrompt) => {
    setActivePrompt(prompt)
    setCommentsLoading(true)

    try {
      const { data, error } = await supabase
        .from('prompt_comments')
        .select(`
          id,
          prompt_id,
          author_id,
          content,
          is_masked,
          masked_persona,
          created_at,
          updated_at,
          author:profiles!prompt_comments_author_id_fkey(id, username, display_name, avatar_url)
        `)
        .eq('prompt_id', prompt.id)
        .order('created_at', { ascending: true })

      if (!error && data) {
        const mapped: PromptComment[] = data.map((c: any) => {
          const authorObj = Array.isArray(c.author) ? c.author[0] : c.author
          return {
            id: c.id,
            promptId: c.prompt_id,
            authorId: c.author_id,
            content: c.content,
            isMasked: c.is_masked,
            maskedPersona: c.masked_persona,
            createdAt: c.created_at,
            updatedAt: c.updated_at,
            author: authorObj
              ? {
                  id: authorObj.id,
                  username: authorObj.username,
                  displayName: authorObj.display_name,
                  avatarUrl: authorObj.avatar_url,
                }
              : undefined,
          }
        })
        setComments(mapped)
      }
    } catch {} finally {
      setCommentsLoading(false)
    }
  }

  // Submit comment
  const handleSubmitComment = async () => {
    if (!newComment.trim() || !activePrompt || !currentUserId) return
    setSubmittingComment(true)

    try {
      const { data, error } = await supabase
        .from('prompt_comments')
        .insert({
          prompt_id: activePrompt.id,
          author_id: currentUserId,
          content: newComment.trim(),
          is_masked: commentIsMasked,
          masked_persona: commentIsMasked ? 'Thoughtful Owl' : null,
        })
        .select(`
          id,
          prompt_id,
          author_id,
          content,
          is_masked,
          masked_persona,
          created_at,
          updated_at,
          author:profiles!prompt_comments_author_id_fkey(id, username, display_name, avatar_url)
        `)
        .single()

      if (!error && data) {
        const authorObj = Array.isArray(data.author) ? data.author[0] : data.author
        const added: PromptComment = {
          id: data.id,
          promptId: data.prompt_id,
          authorId: data.author_id,
          content: data.content,
          isMasked: data.is_masked,
          maskedPersona: data.masked_persona,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          author: authorObj
            ? {
                id: authorObj.id,
                username: authorObj.username,
                displayName: authorObj.display_name,
                avatarUrl: authorObj.avatar_url,
              }
            : undefined,
        }
        setComments((prev) => [...prev, added])
        setNewComment('')
        setPrompts((prev) =>
          prev.map((p) => (p.id === activePrompt.id ? { ...p, commentCount: (p.commentCount || 0) + 1 } : p))
        )
      }
    } catch {} finally {
      setSubmittingComment(false)
    }
  }

  // Native share
  const handleShare = async (prompt: DailyThoughtPrompt) => {
    try {
      await Share.share({
        message: `Today's Thought from Private Voices: "${prompt.prompt}"`,
      })
    } catch {}
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: themeColors.surfaceBorder }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={themeColors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>
            Reflections Journal
          </Text>
          <Text style={[styles.headerSubtitle, { color: themeColors.textSecondary }]}>
            Daily Thought Archives & Community Answers
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Filter & Search Bar */}
      <View style={[styles.searchFilterBox, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.surfaceBorder }]}>
        <View style={[styles.searchRow, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
          <Search size={16} color="#94a3b8" />
          <TextInput
            style={[styles.searchInput, { color: themeColors.textPrimary }]}
            placeholder="Search questions or topics..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Timeframe Chips */}
        <View style={styles.timeframeRow}>
          {(['all', 'month', 'week'] as const).map((tf) => (
            <TouchableOpacity
              key={tf}
              onPress={() => setTimeframe(tf)}
              style={[styles.tfChip, timeframe === tf && styles.tfChipActive]}
            >
              <Text style={[styles.tfChipText, timeframe === tf && styles.tfChipTextActive]}>
                {tf === 'all' ? 'All Time' : tf === 'month' ? 'This Month' : 'Past 7 Days'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Theme Scroll */}
        <FlatList
          horizontal
          data={THEMES}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.themeScroll}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setSelectedTheme(item)}
              style={[styles.themeChip, selectedTheme === item && styles.themeChipActive]}
            >
              <Text style={[styles.themeChipText, selectedTheme === item && styles.themeChipTextActive]}>
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Prompts Archive List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : filteredPrompts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={{ fontSize: 44, marginBottom: 12 }}>📖</Text>
          <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>No Reflections Found</Text>
          <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>
            Try clearing filters or searching another keyword.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredPrompts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true)
            fetchPrompts()
          }}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
              {/* Card Top */}
              <View style={styles.cardHeader}>
                <View style={styles.tagWrap}>
                  <Text style={styles.cardIcon}>{item.icon}</Text>
                  <Text style={styles.cardTag}>{item.tag.toUpperCase()}</Text>
                </View>
                {item.activeDate && (
                  <View style={styles.dateWrap}>
                    <Calendar size={11} color="#94a3b8" />
                    <Text style={styles.dateText}>
                      {new Date(item.activeDate).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </View>
                )}
              </View>

              {/* Card Question */}
              <Text style={[styles.cardPrompt, { color: themeColors.textPrimary }]}>
                "{item.prompt}"
              </Text>

              {/* Card Footer Actions */}
              <View style={[styles.cardFooter, { borderTopColor: isDark ? '#2e2640' : '#f1f5f9' }]}>
                <View style={styles.leftActions}>
                  {/* Like */}
                  <TouchableOpacity
                    onPress={() => handleToggleLike(item.id)}
                    style={[styles.actionBtn, item.isReactedByMe && styles.actionBtnActiveHeart]}
                  >
                    <Heart
                      size={15}
                      color={item.isReactedByMe ? '#ef4444' : '#94a3b8'}
                      fill={item.isReactedByMe ? '#ef4444' : 'none'}
                    />
                    <Text style={[styles.actionBtnText, item.isReactedByMe && { color: '#ef4444' }]}>
                      {item.reactionCount || 0}
                    </Text>
                  </TouchableOpacity>

                  {/* Save */}
                  <TouchableOpacity
                    onPress={() => handleToggleSave(item.id)}
                    style={[styles.actionBtn, item.isSavedByMe && styles.actionBtnActiveSave]}
                  >
                    <Bookmark
                      size={15}
                      color={item.isSavedByMe ? '#f59e0b' : '#94a3b8'}
                      fill={item.isSavedByMe ? '#f59e0b' : 'none'}
                    />
                    <Text style={[styles.actionBtnText, item.isSavedByMe && { color: '#f59e0b' }]}>
                      {item.saveCount || 0}
                    </Text>
                  </TouchableOpacity>

                  {/* Dialogue */}
                  <TouchableOpacity
                    onPress={() => handleOpenDiscussion(item)}
                    style={styles.dialogueBtn}
                  >
                    <MessageCircle size={14} color="#7c3aed" />
                    <Text style={styles.dialogueBtnText}>
                      Dialogue ({item.commentCount || 0})
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Share Link */}
                <TouchableOpacity onPress={() => handleShare(item)} style={styles.shareBtn}>
                  <Share2 size={15} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Discussion Modal */}
      {activePrompt && (
        <Modal
          visible={!!activePrompt}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setActivePrompt(null)}
        >
          <SafeAreaView style={[styles.modalWrap, { backgroundColor: isDark ? '#0f172a' : '#ffffff' }]}>
            <View style={[styles.modalHeader, { borderBottomColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                  {activePrompt.tag}
                </Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>
                  "{activePrompt.prompt}"
                </Text>
              </View>
              <TouchableOpacity onPress={() => setActivePrompt(null)} style={styles.closeBtn}>
                <X size={20} color={isDark ? '#94a3b8' : '#64748b'} />
              </TouchableOpacity>
            </View>

            {commentsLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator color={ACCENT} />
              </View>
            ) : comments.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>💬</Text>
                <Text style={[styles.emptyTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                  No reflections yet
                </Text>
                <Text style={styles.emptySubtitle}>Be the first to share your thoughts.</Text>
              </View>
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.commentsList}
                renderItem={({ item }) => (
                  <View style={[styles.commentItem, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }]}>
                    <View style={styles.commentHead}>
                      <View style={styles.commentAuthorRow}>
                        <View style={styles.commentAvatar}>
                          <Text style={styles.commentAvatarText}>
                            {item.isMasked ? '🎭' : item.author?.displayName?.charAt(0).toUpperCase() || 'U'}
                          </Text>
                        </View>
                        <Text style={[styles.commentAuthorName, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                          {item.isMasked ? item.maskedPersona || 'Masked Voice' : item.author?.displayName || 'Member'}
                        </Text>
                        {item.isMasked && (
                          <View style={styles.maskedBadge}>
                            <Text style={styles.maskedBadgeText}>Masked</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.commentTime}>
                        {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>
                    <Text style={[styles.commentBody, { color: isDark ? '#cbd5e1' : '#334155' }]}>
                      {item.content}
                    </Text>
                  </View>
                )}
              />
            )}

            {/* Input Composer */}
            <View style={[styles.modalInputArea, { borderTopColor: isDark ? '#1e293b' : '#f1f5f9', backgroundColor: isDark ? '#0f172a' : '#ffffff' }]}>
              <TouchableOpacity
                onPress={() => setCommentIsMasked(!commentIsMasked)}
                style={[styles.maskToggle, commentIsMasked && styles.maskToggleActive]}
              >
                <Text style={[styles.maskToggleText, commentIsMasked && { color: '#ffffff' }]}>
                  {commentIsMasked ? '🎭 Speaking as Masked Voice' : '🎭 Mask Identity'}
                </Text>
              </TouchableOpacity>

              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.commentInput, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', color: isDark ? '#ffffff' : '#0f172a' }]}
                  placeholder={commentIsMasked ? 'Reply pseudonymously...' : 'Add your reflection...'}
                  placeholderTextColor="#94a3b8"
                  value={newComment}
                  onChangeText={setNewComment}
                />
                <TouchableOpacity
                  onPress={handleSubmitComment}
                  disabled={!newComment.trim() || submittingComment}
                  style={[styles.sendBtn, (!newComment.trim() || submittingComment) && { opacity: 0.4 }]}
                >
                  <Send size={15} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </Modal>
      )}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    padding: 6,
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  searchFilterBox: {
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    height: 38,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
  },
  timeframeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tfChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
  },
  tfChipActive: {
    backgroundColor: ACCENT,
  },
  tfChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  tfChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  themeScroll: {
    gap: 6,
  },
  themeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
  },
  themeChipActive: {
    backgroundColor: '#7c3aed',
  },
  themeChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  themeChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  listContent: {
    padding: 14,
    gap: 14,
  },
  card: {
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tagWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardIcon: {
    fontSize: 15,
  },
  cardTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7c3aed',
    letterSpacing: 0.5,
  },
  dateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
  },
  cardPrompt: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 3,
  },
  actionBtnActiveHeart: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 6,
  },
  actionBtnActiveSave: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 6,
  },
  actionBtnText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  dialogueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  dialogueBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7c3aed',
  },
  shareBtn: {
    padding: 4,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  modalWrap: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  commentsList: {
    padding: 16,
    gap: 12,
  },
  commentItem: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  commentHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  commentAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarText: {
    fontSize: 9,
    color: '#ffffff',
    fontWeight: '700',
  },
  commentAuthorName: {
    fontSize: 12,
    fontWeight: '700',
  },
  maskedBadge: {
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  maskedBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#7c3aed',
  },
  commentTime: {
    fontSize: 10,
    color: '#94a3b8',
  },
  commentBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalInputArea: {
    padding: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  maskToggle: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  maskToggleActive: {
    backgroundColor: ACCENT,
  },
  maskToggleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7c3aed',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentInput: {
    flex: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
