import React, { useState, useEffect, useCallback } from 'react'
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
import { useRouter } from 'expo-router'
import {
  Heart,
  Repeat,
  Bookmark,
  MessageCircle,
  Share2,
  ChevronRight,
  X,
  Send,
  Sparkles,
} from 'lucide-react-native'
import { supabase } from '../lib/supabase'
import { useTheme } from '../context/ThemeContext'
import type { DailyThoughtPrompt, PromptComment } from '@private-voices/shared'

const ACCENT = '#7c3aed'

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
  const { colors: themeColors, isDark } = useTheme()

  const [currentPrompt, setCurrentPrompt] = useState<DailyThoughtPrompt | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  // Interaction counts
  const [isReacted, setIsReacted] = useState(false)
  const [reactionCount, setReactionCount] = useState(0)
  const [isSaved, setIsSaved] = useState(false)
  const [saveCount, setSaveCount] = useState(0)
  const [isReshared, setIsReshared] = useState(false)
  const [reshareCount, setReshareCount] = useState(0)

  // Discussion Modal
  const [modalVisible, setModalVisible] = useState(false)
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

  // Load Prompt
  useEffect(() => {
    async function loadPrompt() {
      try {
        const todayStr = new Date().toISOString().split('T')[0]
        const { data } = await supabase
          .from('daily_thought_prompts')
          .select('id, tag, prompt, icon, active_date, is_active')
          .eq('is_active', true)
          .eq('active_date', todayStr)
          .limit(1)
          .maybeSingle()

        if (data) {
          setCurrentPrompt({
            id: data.id,
            tag: data.tag,
            prompt: data.prompt,
            icon: data.icon,
            activeDate: data.active_date,
            isActive: data.is_active,
          })
          return
        }
      } catch {}

      const now = new Date()
      const dayOfYear = Math.floor(
        (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
      )
      const fallback = FALLBACK_PROMPTS[dayOfYear % FALLBACK_PROMPTS.length]
      setCurrentPrompt({
        id: `fallback-${dayOfYear % FALLBACK_PROMPTS.length}`,
        tag: fallback.tag,
        prompt: fallback.prompt,
        icon: fallback.icon,
        isActive: true,
      })
    }

    loadPrompt()
  }, [])

  // Fetch Reactions & Counts
  const fetchInteractions = useCallback(async () => {
    if (!currentPrompt || currentPrompt.id.startsWith('fallback-')) return

    try {
      const { count: rCount } = await supabase
        .from('prompt_reactions')
        .select('*', { count: 'exact', head: true })
        .eq('prompt_id', currentPrompt.id)
      setReactionCount(rCount || 0)

      const { count: sCount } = await supabase
        .from('prompt_saves')
        .select('*', { count: 'exact', head: true })
        .eq('prompt_id', currentPrompt.id)
      setSaveCount(sCount || 0)

      const { count: resCount } = await supabase
        .from('prompt_reshares')
        .select('*', { count: 'exact', head: true })
        .eq('prompt_id', currentPrompt.id)
      setReshareCount(resCount || 0)

      if (currentUserId) {
        const { data: myR } = await supabase
          .from('prompt_reactions')
          .select('user_id')
          .eq('prompt_id', currentPrompt.id)
          .eq('user_id', currentUserId)
          .maybeSingle()
        setIsReacted(Boolean(myR))

        const { data: myS } = await supabase
          .from('prompt_saves')
          .select('user_id')
          .eq('prompt_id', currentPrompt.id)
          .eq('user_id', currentUserId)
          .maybeSingle()
        setIsSaved(Boolean(myS))

        const { data: myRes } = await supabase
          .from('prompt_reshares')
          .select('user_id')
          .eq('prompt_id', currentPrompt.id)
          .eq('user_id', currentUserId)
          .maybeSingle()
        setIsReshared(Boolean(myRes))
      }
    } catch {}
  }, [currentPrompt, currentUserId])

  useEffect(() => {
    fetchInteractions()
  }, [fetchInteractions])

  // Fetch comments
  const loadComments = useCallback(async () => {
    if (!currentPrompt || currentPrompt.id.startsWith('fallback-')) return
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
        .eq('prompt_id', currentPrompt.id)
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
  }, [currentPrompt])

  const openDiscussion = () => {
    setModalVisible(true)
    loadComments()
  }

  // Handle Like
  const handleToggleLike = async () => {
    if (!currentPrompt || currentPrompt.id.startsWith('fallback-') || !currentUserId) return
    const prev = isReacted
    const prevC = reactionCount
    setIsReacted(!prev)
    setReactionCount(prev ? Math.max(0, prevC - 1) : prevC + 1)

    try {
      if (prev) {
        await supabase
          .from('prompt_reactions')
          .delete()
          .eq('prompt_id', currentPrompt.id)
          .eq('user_id', currentUserId)
      } else {
        await supabase
          .from('prompt_reactions')
          .insert({ prompt_id: currentPrompt.id, user_id: currentUserId })
      }
    } catch {
      setIsReacted(prev)
      setReactionCount(prevC)
    }
  }

  // Handle Save
  const handleToggleSave = async () => {
    if (!currentPrompt || currentPrompt.id.startsWith('fallback-') || !currentUserId) return
    const prev = isSaved
    const prevC = saveCount
    setIsSaved(!prev)
    setSaveCount(prev ? Math.max(0, prevC - 1) : prevC + 1)

    try {
      if (prev) {
        await supabase
          .from('prompt_saves')
          .delete()
          .eq('prompt_id', currentPrompt.id)
          .eq('user_id', currentUserId)
      } else {
        await supabase
          .from('prompt_saves')
          .insert({ prompt_id: currentPrompt.id, user_id: currentUserId })
      }
    } catch {
      setIsSaved(prev)
      setSaveCount(prevC)
    }
  }

  // Handle Reshare
  const handleToggleReshare = async () => {
    if (!currentPrompt || currentPrompt.id.startsWith('fallback-') || !currentUserId) return
    const prev = isReshared
    const prevC = reshareCount
    setIsReshared(!prev)
    setReshareCount(prev ? Math.max(0, prevC - 1) : prevC + 1)

    try {
      if (prev) {
        await supabase
          .from('prompt_reshares')
          .delete()
          .eq('prompt_id', currentPrompt.id)
          .eq('user_id', currentUserId)
      } else {
        await supabase
          .from('prompt_reshares')
          .insert({ prompt_id: currentPrompt.id, user_id: currentUserId })
      }
    } catch {
      setIsReshared(prev)
      setReshareCount(prevC)
    }
  }

  // Handle Share Native
  const handleShareNative = async () => {
    if (!currentPrompt) return
    try {
      await Share.share({
        message: `Today's Thought on Private Voices: "${currentPrompt.prompt}"`,
      })
    } catch {}
  }

  // Submit comment
  const handleSubmitComment = async () => {
    if (!newComment.trim() || !currentUserId || !currentPrompt) return
    if (currentPrompt.id.startsWith('fallback-')) return

    setSubmittingComment(true)
    try {
      const { data, error } = await supabase
        .from('prompt_comments')
        .insert({
          prompt_id: currentPrompt.id,
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
        const addedComment: PromptComment = {
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
        setComments((prev) => [...prev, addedComment])
        setNewComment('')
      }
    } catch {} finally {
      setSubmittingComment(false)
    }
  }

  if (dismissed || !currentPrompt) return null

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#1a1829' : '#fffbeb', borderColor: isDark ? '#3b3154' : '#fde68a' }]}>
      {/* Top Header */}
      <View style={styles.headerRow}>
        <View style={styles.tagGroup}>
          <Text style={styles.icon}>{currentPrompt.icon}</Text>
          <Text style={[styles.tagText, { color: isDark ? '#c084fc' : '#b45309' }]}>
            {currentPrompt.tag.toUpperCase()}
          </Text>
          <Text style={styles.subTagText}>• Today's Thought</Text>
        </View>

        <TouchableOpacity onPress={() => setDismissed(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <X size={15} color={isDark ? '#94a3b8' : '#9ca3af'} />
        </TouchableOpacity>
      </View>

      {/* Thought Prompt */}
      <Text style={[styles.promptText, { color: isDark ? '#f8fafc' : '#1f2937' }]}>
        "{currentPrompt.prompt}"
      </Text>

      {/* Bottom Actions Tray: Like, Reshare, Save, Discussion */}
      <View style={[styles.footerRow, { borderTopColor: isDark ? '#2e2640' : '#fef3c7' }]}>
        <View style={styles.actionIconsRow}>
          {/* Like */}
          <TouchableOpacity
            style={[styles.iconBtn, isReacted && styles.iconBtnActiveHeart]}
            onPress={handleToggleLike}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Heart size={16} color={isReacted ? '#ef4444' : isDark ? '#94a3b8' : '#6b7280'} fill={isReacted ? '#ef4444' : 'none'} />
            {reactionCount > 0 && (
              <Text style={[styles.iconBtnText, isReacted && { color: '#ef4444', fontWeight: '700' }]}>
                {reactionCount}
              </Text>
            )}
          </TouchableOpacity>

          {/* Reshare */}
          <TouchableOpacity
            style={[styles.iconBtn, isReshared && styles.iconBtnActiveReshare]}
            onPress={handleToggleReshare}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Repeat size={16} color={isReshared ? '#10b981' : isDark ? '#94a3b8' : '#6b7280'} />
            {reshareCount > 0 && (
              <Text style={[styles.iconBtnText, isReshared && { color: '#10b981', fontWeight: '700' }]}>
                {reshareCount}
              </Text>
            )}
          </TouchableOpacity>

          {/* Save */}
          <TouchableOpacity
            style={[styles.iconBtn, isSaved && styles.iconBtnActiveSave]}
            onPress={handleToggleSave}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Bookmark size={16} color={isSaved ? '#f59e0b' : isDark ? '#94a3b8' : '#6b7280'} fill={isSaved ? '#f59e0b' : 'none'} />
            {saveCount > 0 && (
              <Text style={[styles.iconBtnText, isSaved && { color: '#f59e0b', fontWeight: '700' }]}>
                {saveCount}
              </Text>
            )}
          </TouchableOpacity>

          {/* Discussion */}
          <TouchableOpacity
            style={styles.discussionPill}
            onPress={openDiscussion}
            activeOpacity={0.8}
          >
            <MessageCircle size={14} color="#7c3aed" />
            <Text style={styles.discussionPillText}>Discussion</Text>
          </TouchableOpacity>

          {/* Share Link */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={handleShareNative}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Share2 size={15} color={isDark ? '#94a3b8' : '#6b7280'} />
          </TouchableOpacity>
        </View>

        {/* Compose from thought */}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push('/(tabs)/create' as any)}
        >
          <Text style={styles.actionBtnText}>Share</Text>
          <ChevronRight size={13} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Discussion Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: isDark ? '#0f172a' : '#ffffff' }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalHeaderTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                Thought Discussion
              </Text>
              <Text style={styles.modalHeaderSubtitle} numberOfLines={1}>
                "{currentPrompt.prompt}"
              </Text>
            </View>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
              <X size={20} color={isDark ? '#94a3b8' : '#64748b'} />
            </TouchableOpacity>
          </View>

          {/* Comments List */}
          {commentsLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={ACCENT} />
            </View>
          ) : comments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>💬</Text>
              <Text style={[styles.emptyTitle, { color: isDark ? '#f8fafc' : '#1e293b' }]}>
                No reflections yet
              </Text>
              <Text style={styles.emptySubtitle}>
                Be the first to share your perspective on today's thought.
              </Text>
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.commentsList}
              renderItem={({ item }) => (
                <View style={[styles.commentCard, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }]}>
                  <View style={styles.commentHeader}>
                    <View style={styles.authorRow}>
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

          {/* Input Bar */}
          <View style={[styles.modalInputBar, { borderTopColor: isDark ? '#1e293b' : '#f1f5f9', backgroundColor: isDark ? '#0f172a' : '#ffffff' }]}>
            <View style={styles.inputOptionsRow}>
              <TouchableOpacity
                style={[styles.maskToggleBtn, commentIsMasked && styles.maskToggleBtnActive]}
                onPress={() => setCommentIsMasked(!commentIsMasked)}
              >
                <Text style={[styles.maskToggleText, commentIsMasked && { color: '#ffffff' }]}>
                  {commentIsMasked ? '🎭 Speaking as Masked Voice' : '🎭 Mask Identity'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputRow}>
              <TextInput
                style={[styles.textInput, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', color: isDark ? '#ffffff' : '#0f172a' }]}
                placeholder={commentIsMasked ? 'Reply pseudonymously...' : 'Add your reflection...'}
                placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                value={newComment}
                onChangeText={setNewComment}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!newComment.trim() || submittingComment) && styles.sendBtnDisabled]}
                onPress={handleSubmitComment}
                disabled={!newComment.trim() || submittingComment}
              >
                {submittingComment ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Send size={15} color="#ffffff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 14,
    borderRadius: 22,
    borderWidth: 1,
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
    letterSpacing: 0.5,
  },
  subTagText: {
    fontSize: 10,
    color: '#94a3b8',
  },
  promptText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 8,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  actionIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    padding: 4,
  },
  iconBtnActiveHeart: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 6,
  },
  iconBtnActiveReshare: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 6,
  },
  iconBtnActiveSave: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 6,
  },
  iconBtnText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  discussionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  discussionPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7c3aed',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#111827',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalHeaderSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  commentsList: {
    padding: 16,
    gap: 12,
  },
  commentCard: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarText: {
    fontSize: 10,
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
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  modalInputBar: {
    padding: 12,
    borderTopWidth: 1,
  },
  inputOptionsRow: {
    marginBottom: 8,
  },
  maskToggleBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  maskToggleBtnActive: {
    backgroundColor: '#7c3aed',
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
  textInput: {
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
  sendBtnDisabled: {
    opacity: 0.4,
  },
})
