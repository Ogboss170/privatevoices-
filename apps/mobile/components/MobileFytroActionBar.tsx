import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Share,
  Alert,
  ScrollView,
  Clipboard,
} from 'react-native'
import {
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RotateCw,
  Share2,
  Volume2,
  VolumeX,
  Flag,
  MoreHorizontal,
  X,
} from 'lucide-react-native'
import { useTheme } from '../context/ThemeContext'
import { FytroService } from '../lib/fytroService'
import type { FytroReaction, FytroFeedbackReason } from '@private-voices/shared'

export interface MobileFytroActionBarProps {
  messageId: string
  sessionId?: string | null
  content: string
  isStreaming?: boolean
  isSpeaking?: boolean
  currentReaction?: FytroReaction | null
  onRegenerate?: () => void
  onToggleSpeech?: (text: string) => void
  onReactionChange?: (reaction: FytroReaction | null) => void
}

const FEEDBACK_REASONS: Array<{ key: FytroFeedbackReason; label: string; desc: string }> = [
  { key: 'repetitive', label: 'Repetitive / Generic', desc: 'Gave a canned or repeated answer' },
  { key: 'not_helpful', label: 'Not Helpful', desc: 'Did not address my thought' },
  { key: 'inaccurate', label: 'Factually Incorrect', desc: 'Contained wrong details' },
  { key: 'hallucination', label: 'Made Things Up', desc: 'Fabricated facts' },
  { key: 'out_of_character', label: 'Out of Character', desc: 'Lost Socratic tone' },
  { key: 'harmful_or_unsafe', label: 'Harmful or Unsafe', desc: 'Unsafe response' },
  { key: 'other', label: 'Other', desc: 'Different reason' },
]

export function MobileFytroActionBar({
  messageId,
  sessionId,
  content,
  isStreaming = false,
  isSpeaking = false,
  currentReaction = null,
  onRegenerate,
  onToggleSpeech,
  onReactionChange,
}: MobileFytroActionBarProps) {
  const { colors: themeColors, isDark } = useTheme()
  const [copied, setCopied] = useState(false)
  const [activeReaction, setActiveReaction] = useState<FytroReaction | null>(currentReaction)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [showMoreModal, setShowMoreModal] = useState(false)

  // Feedback reasons state
  const [selectedReasons, setSelectedReasons] = useState<FytroFeedbackReason[]>([])
  const [feedbackComment, setFeedbackComment] = useState('')
  const [submittingFeedback, setSubmittingFeedback] = useState(false)

  // Report state
  const [reportReason, setReportReason] = useState('Inappropriate content')
  const [reportDetails, setReportDetails] = useState('')
  const [submittingReport, setSubmittingReport] = useState(false)

  if (isStreaming || !content.trim()) {
    return null
  }

  // 1. Copy
  const handleCopy = () => {
    try {
      Clipboard.setString(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  // 2. Share
  const handleShare = async () => {
    try {
      await Share.share({
        message: content,
        title: 'Thought reflection via Fytro (Private Voices)',
      })
    } catch {
      // dismissed
    }
  }

  // 3. Reactions (Thumbs Up / Down)
  const handleToggleReaction = async (reaction: FytroReaction) => {
    const isRemoving = activeReaction === reaction
    const newReaction = isRemoving ? null : reaction
    setActiveReaction(newReaction)
    onReactionChange?.(newReaction)

    if (isRemoving) {
      await FytroService.removeFeedback(messageId)
    } else {
      await FytroService.submitFeedback({
        messageId,
        sessionId,
        reaction,
      })

      if (reaction === 'dislike') {
        setShowFeedbackModal(true)
      }
    }
  }

  // Submit thumbs-down detailed feedback
  const handleSubmitDetailedFeedback = async () => {
    setSubmittingFeedback(true)
    try {
      await FytroService.submitFeedback({
        messageId,
        sessionId,
        reaction: 'dislike',
        reasons: selectedReasons,
        comment: feedbackComment.trim() || null,
      })
      setShowFeedbackModal(false)
      Alert.alert('Feedback Received', 'Thank you for helping us refine Fytro.')
    } finally {
      setSubmittingFeedback(false)
    }
  }

  // Submit report
  const handleSubmitReport = async () => {
    setSubmittingReport(true)
    try {
      const ok = await FytroService.submitReport({
        messageId,
        sessionId,
        reason: reportReason,
        details: reportDetails.trim() || null,
      })
      setShowReportModal(false)
      if (ok) {
        Alert.alert('Report Submitted', 'Our moderation team will review this response.')
      }
    } finally {
      setSubmittingReport(false)
    }
  }

  return (
    <View style={styles.container}>
      {/* Action Buttons Row */}
      <View style={styles.actionRow}>
        {/* Copy */}
        <TouchableOpacity
          onPress={handleCopy}
          style={styles.iconBtn}
          accessibilityLabel="Copy response"
        >
          {copied ? (
            <Check size={14} color="#10B981" />
          ) : (
            <Copy size={14} color={isDark ? '#94A3B8' : '#64748B'} />
          )}
        </TouchableOpacity>

        {/* Read aloud */}
        {onToggleSpeech && (
          <TouchableOpacity
            onPress={() => onToggleSpeech(content)}
            style={[
              styles.iconBtn,
              isSpeaking && { backgroundColor: isDark ? '#3B0764' : '#F3E8FF' },
            ]}
            accessibilityLabel="Read aloud"
          >
            {isSpeaking ? (
              <VolumeX size={14} color="#8B5CF6" />
            ) : (
              <Volume2 size={14} color={isDark ? '#94A3B8' : '#64748B'} />
            )}
          </TouchableOpacity>
        )}

        {/* Thumbs Up */}
        <TouchableOpacity
          onPress={() => handleToggleReaction('like')}
          style={[
            styles.iconBtn,
            activeReaction === 'like' && { backgroundColor: isDark ? '#064E3B' : '#D1FAE5' },
          ]}
          accessibilityLabel="Good response"
        >
          <ThumbsUp
            size={14}
            color={activeReaction === 'like' ? '#10B981' : isDark ? '#94A3B8' : '#64748B'}
            fill={activeReaction === 'like' ? '#10B981' : 'none'}
          />
        </TouchableOpacity>

        {/* Thumbs Down */}
        <TouchableOpacity
          onPress={() => handleToggleReaction('dislike')}
          style={[
            styles.iconBtn,
            activeReaction === 'dislike' && { backgroundColor: isDark ? '#4C0519' : '#FFE4E6' },
          ]}
          accessibilityLabel="Bad response"
        >
          <ThumbsDown
            size={14}
            color={activeReaction === 'dislike' ? '#F43F5E' : isDark ? '#94A3B8' : '#64748B'}
            fill={activeReaction === 'dislike' ? '#F43F5E' : 'none'}
          />
        </TouchableOpacity>

        {/* Regenerate */}
        {onRegenerate && (
          <TouchableOpacity
            onPress={onRegenerate}
            style={styles.iconBtn}
            accessibilityLabel="Regenerate response"
          >
            <RotateCw size={14} color={isDark ? '#94A3B8' : '#64748B'} />
          </TouchableOpacity>
        )}

        {/* Share */}
        <TouchableOpacity
          onPress={handleShare}
          style={styles.iconBtn}
          accessibilityLabel="Share response"
        >
          <Share2 size={14} color={isDark ? '#94A3B8' : '#64748B'} />
        </TouchableOpacity>

        {/* More */}
        <TouchableOpacity
          onPress={() => setShowMoreModal(true)}
          style={styles.iconBtn}
          accessibilityLabel="More options"
        >
          <MoreHorizontal size={14} color={isDark ? '#94A3B8' : '#64748B'} />
        </TouchableOpacity>
      </View>

      {/* More Options Modal / Sheet */}
      <Modal
        visible={showMoreModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMoreModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowMoreModal(false)}
        >
          <View
            style={[
              styles.optionsSheet,
              { backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: isDark ? '#1E293B' : '#E2E8F0' },
            ]}
          >
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                setShowMoreModal(false)
                setShowReportModal(true)
              }}
            >
              <Flag size={16} color="#F43F5E" />
              <Text style={[styles.optionText, { color: '#F43F5E' }]}>Report response</Text>
            </TouchableOpacity>
            {activeReaction === 'dislike' && (
              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => {
                  setShowMoreModal(false)
                  setShowFeedbackModal(true)
                }}
              >
                <ThumbsDown size={16} color={isDark ? '#E2E8F0' : '#1E293B'} />
                <Text style={[styles.optionText, { color: isDark ? '#E2E8F0' : '#1E293B' }]}>
                  Edit feedback
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Thumbs Down Reasons Modal */}
      <Modal
        visible={showFeedbackModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFeedbackModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: isDark ? '#1E293B' : '#E2E8F0' },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ThumbsDown size={18} color="#F43F5E" />
                <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  Help improve Fytro
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowFeedbackModal(false)}>
                <X size={18} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              What went wrong with this reflection?
            </Text>

            <ScrollView style={{ maxHeight: 200, marginVertical: 8 }}>
              {FEEDBACK_REASONS.map((r) => {
                const isSelected = selectedReasons.includes(r.key)
                return (
                  <TouchableOpacity
                    key={r.key}
                    onPress={() => {
                      setSelectedReasons((prev) =>
                        isSelected ? prev.filter((k) => k !== r.key) : [...prev, r.key]
                      )
                    }}
                    style={[
                      styles.reasonRow,
                      {
                        borderColor: isSelected ? '#8B5CF6' : isDark ? '#1E293B' : '#E2E8F0',
                        backgroundColor: isSelected
                          ? isDark
                            ? '#2E1065'
                            : '#F5F3FF'
                          : isDark
                          ? '#1E293B40'
                          : '#F8FAFC',
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.reasonLabel,
                          { color: isDark ? '#F1F5F9' : '#0F172A' },
                        ]}
                      >
                        {r.label}
                      </Text>
                      <Text style={styles.reasonDesc}>{r.desc}</Text>
                    </View>
                    {isSelected && <Check size={16} color="#8B5CF6" />}
                  </TouchableOpacity>
                )
              })}
            </ScrollView>

            <TextInput
              value={feedbackComment}
              onChangeText={setFeedbackComment}
              placeholder="Optional comments or suggestions..."
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              multiline
              style={[
                styles.commentInput,
                {
                  color: isDark ? '#FFFFFF' : '#0F172A',
                  borderColor: isDark ? '#334155' : '#CBD5E1',
                  backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                },
              ]}
            />

            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={() => setShowFeedbackModal(false)}
                style={styles.cancelBtn}
              >
                <Text style={{ color: isDark ? '#94A3B8' : '#64748B', fontWeight: '600' }}>
                  Skip
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmitDetailedFeedback}
                disabled={submittingFeedback}
                style={styles.submitBtn}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>
                  {submittingFeedback ? 'Saving...' : 'Submit Feedback'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Report Modal */}
      <Modal
        visible={showReportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: isDark ? '#1E293B' : '#E2E8F0' },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Flag size={18} color="#F43F5E" />
                <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  Report AI Response
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowReportModal(false)}>
                <X size={18} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              Please explain why this response is unsafe or inappropriate:
            </Text>

            <TextInput
              value={reportDetails}
              onChangeText={setReportDetails}
              placeholder="Provide details for our safety and moderation team..."
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              multiline
              style={[
                styles.commentInput,
                {
                  height: 90,
                  marginVertical: 12,
                  color: isDark ? '#FFFFFF' : '#0F172A',
                  borderColor: isDark ? '#334155' : '#CBD5E1',
                  backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                },
              ]}
            />

            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={() => setShowReportModal(false)}
                style={styles.cancelBtn}
              >
                <Text style={{ color: isDark ? '#94A3B8' : '#64748B', fontWeight: '600' }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmitReport}
                disabled={submittingReport}
                style={[styles.submitBtn, { backgroundColor: '#F43F5E' }]}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>
                  {submittingReport ? 'Submitting...' : 'Submit Report'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.15)',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  iconBtn: {
    padding: 6,
    borderRadius: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  optionsSheet: {
    width: 200,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 6,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  reasonLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  reasonDesc: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  commentInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    fontSize: 12,
    height: 60,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
    paddingTop: 8,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  submitBtn: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
})
