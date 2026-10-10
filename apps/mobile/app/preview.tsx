import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Linking,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FlaskConical,
  Bug,
  Send,
  Star,
  Award,
  ShieldCheck,
  Check,
  Layers,
  ChevronRight,
} from 'lucide-react-native'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'
import { useTheme } from '../context/ThemeContext'
import type { PreviewFeature, PreviewProgramTask, PreviewParticipantState } from '@private-voices/shared'

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  coming_soon: {
    label: 'Coming Soon',
    color: '#64748b',
    bgColor: '#f1f5f9',
  },
  available_for_preview: {
    label: 'Available for Preview',
    color: '#059669',
    bgColor: '#ecfdf5',
  },
  testing: {
    label: 'Testing',
    color: '#7c3aed',
    bgColor: '#f5f3ff',
  },
  released: {
    label: 'Released',
    color: '#2563eb',
    bgColor: '#eff6ff',
  },
}

export default function PreviewScreen() {
  const router = useRouter()
  const { colors: themeColors, isDark } = useTheme()

  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  // Features Roadmap State
  const [features, setFeatures] = useState<PreviewFeature[]>([])
  const [activeCategory, setActiveCategory] = useState<string>('all')

  // Preview Program State
  const [program, setProgram] = useState<any>(null)
  const [participant, setParticipant] = useState<PreviewParticipantState | null>(null)
  const [tasks, setTasks] = useState<PreviewProgramTask[]>([])
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
  const [membershipLoading, setMembershipLoading] = useState(false)

  // Feedback State
  const [feedbackCategory, setFeedbackCategory] = useState<'suggestion' | 'ux' | 'bug' | 'performance'>('suggestion')
  const [feedbackTitle, setFeedbackTitle] = useState('')
  const [feedbackContent, setFeedbackContent] = useState('')
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const [feedbackSent, setFeedbackSent] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const { data: authData } = await supabase.auth.getUser()
      const currentUid = authData?.user?.id ?? null
      setUserId(currentUid)

      // 1. Fetch real Preview Features
      const { data: featureRows } = await supabase
        .from('preview_features')
        .select('*')
        .order('sort_order', { ascending: true })

      if (featureRows) {
        setFeatures(
          featureRows.map((f: any) => ({
            id: f.id,
            title: f.title,
            slug: f.slug,
            description: f.description,
            status: f.status,
            category: f.category,
            demoUrl: f.demo_url,
            badgeHighlight: f.badge_highlight,
            sortOrder: f.sort_order,
            isActive: f.is_active,
            createdAt: f.created_at,
          }))
        )
      }

      // 2. Fetch active Preview Program
      const { data: progData } = await supabase
        .from('preview_programs')
        .select('*')
        .eq('slug', 'genesis-preview')
        .maybeSingle()

      setProgram(progData)

      if (progData) {
        const { data: taskRows } = await supabase
          .from('preview_tasks')
          .select('*')
          .eq('program_id', progData.id)
          .eq('is_active', true)
          .order('sort_order', { ascending: true })

        let completedTaskIds: Set<string> = new Set()
        if (currentUid) {
          const { data: partData } = await supabase
            .from('preview_participants')
            .select('*')
            .eq('program_id', progData.id)
            .eq('user_id', currentUid)
            .maybeSingle()

          if (partData) {
            setParticipant({
              id: partData.id,
              programId: partData.program_id,
              userId: partData.user_id,
              status: partData.status,
              tasksCompleted: partData.tasks_completed,
              validFeedbackCount: partData.valid_feedback_count,
              earlySupporterAwarded: partData.early_supporter_awarded,
              betaTesterAwarded: partData.beta_tester_awarded,
              registeredAt: partData.registered_at,
            })
          }

          const { data: compRows } = await supabase
            .from('preview_task_completions')
            .select('task_id')
            .eq('program_id', progData.id)
            .eq('user_id', currentUid)

          if (compRows) {
            compRows.forEach((c: any) => completedTaskIds.add(c.task_id))
          }
        }

        setTasks(
          (taskRows ?? []).map((t: any) => ({
            id: t.id,
            programId: t.program_id,
            title: t.title,
            description: t.description,
            taskType: t.task_type,
            sortOrder: t.sort_order,
            isActive: t.is_active,
            isCompleted: completedTaskIds.has(t.id),
          }))
        )
      }
    } catch (err) {
      console.error('Failed to load preview data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleToggleMembership = async (join: boolean) => {
    if (!userId || !program?.id) return
    setMembershipLoading(true)
    try {
      const { data, error } = await supabase.rpc('toggle_preview_program_membership', {
        p_program_id: program.id,
        p_join: join,
      })
      if (error) throw error
      if (data?.error === 'ACCOUNT_RESTRICTED') {
        Alert.alert('Restricted', 'Your account is restricted from joining preview programs.')
      } else {
        await loadData()
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update membership status.')
    } finally {
      setMembershipLoading(false)
    }
  }

  const handleCompleteTask = async (taskId: string) => {
    if (!userId) return
    setCompletingTaskId(taskId)
    try {
      const { data, error } = await supabase.rpc('complete_preview_task', {
        p_task_id: taskId,
        p_notes: 'Verified via mobile client.',
      })
      if (error) throw error
      if (data?.error) {
        Alert.alert('Notice', `Could not complete task: ${data.error}`)
      } else {
        await loadData()
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not record task completion.')
    } finally {
      setCompletingTaskId(null)
    }
  }

  const handleSubmitFeedback = async () => {
    if (!userId || !feedbackTitle.trim() || !feedbackContent.trim() || !program?.id) return

    setSubmittingFeedback(true)
    try {
      const { error } = await supabase.from('preview_feedback').insert({
        program_id: program.id,
        user_id: userId,
        category: feedbackCategory,
        title: feedbackTitle.trim(),
        content: feedbackContent.trim(),
        device_info: {
          platform: Platform.OS,
          osVersion: Platform.Version,
        },
        status: 'pending',
      })

      if (error) throw error

      setFeedbackSent(true)
      setFeedbackTitle('')
      setFeedbackContent('')
      setTimeout(() => setFeedbackSent(false), 5000)
      await loadData()
      Alert.alert('Feedback Submitted', 'Thank you! Your feedback will be triaged by staff.')
    } catch (err: any) {
      Alert.alert('Submission Error', err.message || 'Could not send feedback.')
    } finally {
      setSubmittingFeedback(false)
    }
  }

  const isEnrolled = !!participant && participant.status !== 'disqualified'
  const completedCount = tasks.filter((t) => t.isCompleted).length
  const totalCount = tasks.length
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const filteredFeatures =
    activeCategory === 'all'
      ? features
      : features.filter((f) => f.category === activeCategory)

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={colors.brand} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: themeColors.surfaceBorder, backgroundColor: themeColors.surface }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>App Preview</Text>
        <TouchableOpacity onPress={() => router.push('/rate' as any)} style={styles.rateHeaderBtn}>
          <Star size={16} color="#d97706" fill="#f59e0b" />
          <Text style={styles.rateHeaderText}>Rate</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Sparkles size={12} color="#ffffff" />
            <Text style={styles.heroBadgeText}>Pioneer Preview</Text>
          </View>
          <Text style={styles.heroTitle}>Experience Private Voices Features First</Text>
          <Text style={styles.heroSubtitle}>
            Join the pioneer testing cycle, try encrypted whispers and real-time status badges, and earn the permanent Early Supporter badge.
          </Text>

          <View style={styles.heroActions}>
            {isEnrolled ? (
              <TouchableOpacity
                style={styles.leaveBtn}
                onPress={() => handleToggleMembership(false)}
                disabled={membershipLoading}
              >
                <Text style={styles.leaveBtnText}>
                  {membershipLoading ? 'Updating...' : 'Leave Program'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.joinBtn}
                onPress={() => handleToggleMembership(true)}
                disabled={membershipLoading}
              >
                <Sparkles size={14} color="#7c3aed" />
                <Text style={styles.joinBtnText}>
                  {membershipLoading ? 'Joining...' : 'Join Preview Program'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Preview Program Progress Section */}
        {program && (
          <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: themeColors.text }]}>Preview Program Progress</Text>
                <Text style={[styles.cardSubtitle, { color: themeColors.textSecondary }]}>
                  {program.title}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: isEnrolled ? '#f5f3ff' : '#f1f5f9' }]}>
                <Text style={[styles.statusBadgeText, { color: isEnrolled ? '#7c3aed' : '#64748b' }]}>
                  {isEnrolled ? participant?.status?.toUpperCase() : 'NOT ENROLLED'}
                </Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressLabelRow}>
                <Text style={[styles.progressLabel, { color: themeColors.textSecondary }]}>Task Completion</Text>
                <Text style={[styles.progressValue, { color: colors.brand }]}>
                  {completedCount}/{totalCount} ({progressPercent}%)
                </Text>
              </View>
              <View style={[styles.progressBarTrack, { backgroundColor: isDark ? '#27272a' : '#f1f5f9' }]}>
                <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
              </View>
            </View>

            {/* Badges Info */}
            <View style={styles.badgeInfoRow}>
              <View style={[styles.badgeInfoBox, { backgroundColor: isDark ? '#1e1b4b' : '#faf5ff', borderColor: '#e9d5ff' }]}>
                <Sparkles size={16} color="#7c3aed" />
                <Text style={[styles.badgeInfoTitle, { color: themeColors.text }]}>Early Supporter</Text>
                <Text style={[styles.badgeInfoDesc, { color: themeColors.textSecondary }]}>
                  Complete 1 task & 1 verified feedback
                </Text>
              </View>
              <View style={[styles.badgeInfoBox, { backgroundColor: isDark ? '#064e3b' : '#f0fdf4', borderColor: '#bbf7d0' }]}>
                <Bug size={16} color="#10b981" />
                <Text style={[styles.badgeInfoTitle, { color: themeColors.text }]}>Beta Tester</Text>
                <Text style={[styles.badgeInfoDesc, { color: themeColors.textSecondary }]}>
                  Submit verified technical bug logs
                </Text>
              </View>
            </View>

            {/* Testing Tasks */}
            <View style={styles.tasksSection}>
              <Text style={styles.tasksSectionHeader}>AVAILABLE TESTING TASKS</Text>
              {tasks.map((task) => (
                <View
                  key={task.id}
                  style={[styles.taskItem, { borderColor: themeColors.surfaceBorder, backgroundColor: isDark ? '#18181b' : '#f8fafc' }]}
                >
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={[styles.taskTitle, { color: themeColors.text }]}>{task.title}</Text>
                    {task.description && (
                      <Text style={[styles.taskDesc, { color: themeColors.textSecondary }]}>{task.description}</Text>
                    )}
                  </View>

                  {task.isCompleted ? (
                    <View style={styles.taskDoneBadge}>
                      <CheckCircle2 size={18} color="#10b981" />
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.taskActionBtn, !isEnrolled && styles.disabledBtn]}
                      disabled={!isEnrolled || completingTaskId === task.id}
                      onPress={() => handleCompleteTask(task.id)}
                    >
                      <Text style={styles.taskActionText}>
                        {completingTaskId === task.id ? 'Saving...' : 'Mark Done'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Feature Pipeline */}
        <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
          <Text style={[styles.cardTitle, { color: themeColors.text }]}>Feature Pipeline & Roadmap</Text>
          <Text style={[styles.cardSubtitle, { color: themeColors.textSecondary }]}>
            Upcoming real capabilities in preview or testing
          </Text>

          {/* Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterPills}>
            {['all', 'audio', 'whispers', 'community', 'core'].map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.filterPill,
                  activeCategory === cat ? styles.filterPillActive : { borderColor: themeColors.surfaceBorder, backgroundColor: isDark ? '#27272a' : '#f1f5f9' },
                ]}
                onPress={() => setActiveCategory(cat)}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    activeCategory === cat ? styles.filterPillTextActive : { color: themeColors.textSecondary },
                  ]}
                >
                  {cat.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.featureList}>
            {filteredFeatures.map((feat) => {
              const statusCfg = STATUS_CONFIG[feat.status] || STATUS_CONFIG.coming_soon
              return (
                <View
                  key={feat.id}
                  style={[styles.featureCard, { borderColor: themeColors.surfaceBorder, backgroundColor: isDark ? '#18181b' : '#fafafa' }]}
                >
                  <View style={styles.featureTopRow}>
                    <View style={[styles.statusChip, { backgroundColor: statusCfg.bgColor }]}>
                      <Text style={[styles.statusChipText, { color: statusCfg.color }]}>
                        {statusCfg.label}
                      </Text>
                    </View>
                    {feat.badgeHighlight && (
                      <View style={styles.badgeHighlightPill}>
                        <Sparkles size={11} color="#7c3aed" />
                        <Text style={styles.badgeHighlightText}>{feat.badgeHighlight}</Text>
                      </View>
                    )}
                  </View>

                  <Text style={[styles.featureTitle, { color: themeColors.text }]}>{feat.title}</Text>
                  <Text style={[styles.featureDesc, { color: themeColors.textSecondary }]}>{feat.description}</Text>
                </View>
              )
            })}
          </View>
        </View>

        {/* Feedback Form */}
        <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
          <Text style={[styles.cardTitle, { color: themeColors.text }]}>Tester Suggestions & Feedback</Text>
          <Text style={[styles.cardSubtitle, { color: themeColors.textSecondary }]}>
            Share your experiences or suggestions with our product team
          </Text>

          <View style={styles.categoryRow}>
            {[
              { id: 'suggestion', label: 'Suggestion' },
              { id: 'ux', label: 'UX' },
              { id: 'bug', label: 'Bug' },
              { id: 'performance', label: 'Speed' },
            ].map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.categoryPill,
                  feedbackCategory === c.id ? styles.categoryPillActive : { borderColor: themeColors.surfaceBorder, backgroundColor: isDark ? '#27272a' : '#f1f5f9' },
                ]}
                onPress={() => setFeedbackCategory(c.id as any)}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    feedbackCategory === c.id ? styles.categoryPillTextActive : { color: themeColors.textSecondary },
                  ]}
                >
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={[styles.input, { backgroundColor: isDark ? '#18181b' : '#f8fafc', borderColor: themeColors.surfaceBorder, color: themeColors.text }]}
            placeholder="Brief title..."
            placeholderTextColor={colors.gray400}
            value={feedbackTitle}
            onChangeText={setFeedbackTitle}
          />

          <TextInput
            style={[styles.textArea, { backgroundColor: isDark ? '#18181b' : '#f8fafc', borderColor: themeColors.surfaceBorder, color: themeColors.text }]}
            placeholder="Detailed testing experience or suggestion..."
            placeholderTextColor={colors.gray400}
            multiline
            numberOfLines={4}
            value={feedbackContent}
            onChangeText={setFeedbackContent}
          />

          <TouchableOpacity
            style={[styles.submitFeedbackBtn, (!feedbackTitle.trim() || !feedbackContent.trim() || submittingFeedback) && styles.disabledBtn]}
            disabled={!feedbackTitle.trim() || !feedbackContent.trim() || submittingFeedback}
            onPress={handleSubmitFeedback}
          >
            <Send size={15} color="#ffffff" />
            <Text style={styles.submitFeedbackText}>
              {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  rateHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#fef3c7',
  },
  rateHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  heroCard: {
    borderRadius: 24,
    backgroundColor: '#4c1d95',
    padding: 20,
    gap: 8,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  heroSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 18,
  },
  heroActions: {
    marginTop: 8,
    flexDirection: 'row',
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  joinBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7c3aed',
  },
  leaveBtn: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  leaveBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  progressContainer: {
    gap: 6,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  progressValue: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.brand,
    borderRadius: 4,
  },
  badgeInfoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  badgeInfoBox: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  badgeInfoTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeInfoDesc: {
    fontSize: 10,
    lineHeight: 14,
  },
  tasksSection: {
    gap: 8,
    marginTop: 4,
  },
  tasksSectionHeader: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gray400,
    letterSpacing: 0.5,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  taskTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  taskDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  taskDoneBadge: {
    padding: 4,
  },
  taskActionBtn: {
    backgroundColor: colors.brand,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  taskActionText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  filterPills: {
    flexDirection: 'row',
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 6,
  },
  filterPillActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  filterPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  featureList: {
    gap: 10,
  },
  featureCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  featureTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  badgeHighlightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  badgeHighlightText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7c3aed',
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  featureDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 6,
  },
  categoryPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  categoryPillActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  categoryPillTextActive: {
    color: '#ffffff',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  submitFeedbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.brand,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 4,
  },
  submitFeedbackText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.5,
  },
})
