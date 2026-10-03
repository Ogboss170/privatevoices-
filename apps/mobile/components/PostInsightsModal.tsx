import React from 'react'
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  ScrollView
} from 'react-native'
import { X, TrendingUp, Heart, MessageCircle, Bookmark, Share2, Award, Zap, Clock } from 'lucide-react-native'
import type { Post } from '@private-voices/shared'

interface PostInsightsModalProps {
  visible: boolean
  post: Post
  onClose: () => void
}

export function PostInsightsModal({ visible, post, onClose }: PostInsightsModalProps) {
  if (!visible) return null

  const likeCount = post.likeCount || 0
  const commentCount = post.commentCount || 0
  const totalEngagement = likeCount + commentCount
  const pollVotes = post.poll?.totalVotes || 0

  // Calculate engagement tier
  let statusText = 'Fresh Voice'
  let statusBadgeColor = '#3b82f6'
  let progressPercent = 20

  if (totalEngagement > 25) {
    statusText = '🔥 Trending & Viral'
    statusBadgeColor = '#ef4444'
    progressPercent = 95
  } else if (totalEngagement > 10) {
    statusText = '🚀 High Engagement'
    statusBadgeColor = '#8b5cf6'
    progressPercent = 75
  } else if (totalEngagement > 3) {
    statusText = '📈 Rising Voice'
    statusBadgeColor = '#10b981'
    progressPercent = 50
  }

  // Format time since creation
  const createdDate = new Date(post.createdAt)
  const hoursAgo = Math.max(1, Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60)))

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <TrendingUp size={22} color="#8b5cf6" />
              <Text style={styles.headerTitle}>Post Progression & Insights</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Status Card */}
            <View style={styles.statusCard}>
              <View style={styles.statusBadgeRow}>
                <View style={[styles.statusBadge, { backgroundColor: `${statusBadgeColor}20`, borderColor: `${statusBadgeColor}50` }]}>
                  <Text style={[styles.statusBadgeText, { color: statusBadgeColor }]}>{statusText}</Text>
                </View>
                <View style={styles.timeBadge}>
                  <Clock size={12} color="#94a3b8" />
                  <Text style={styles.timeText}>{hoursAgo}h ago</Text>
                </View>
              </View>

              <Text style={styles.metricsTitle}>Progression Level</Text>
              
              {/* Progress Bar */}
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${progressPercent}%`, backgroundColor: statusBadgeColor }]} />
              </View>

              <Text style={styles.metricsSubtitle}>
                {totalEngagement} total interactions ({likeCount} likes, {commentCount} comments, {pollVotes} poll votes).
              </Text>
            </View>

            {/* Metrics Breakdown Grid */}
            <Text style={styles.sectionHeader}>Interactions Breakdown</Text>
            <View style={styles.grid}>
              <View style={styles.metricBox}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                  <Heart size={20} color="#ef4444" />
                </View>
                <Text style={styles.metricValue}>{likeCount}</Text>
                <Text style={styles.metricLabel}>Likes</Text>
              </View>

              <View style={styles.metricBox}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(139, 92, 246, 0.12)' }]}>
                  <MessageCircle size={20} color="#8b5cf6" />
                </View>
                <Text style={styles.metricValue}>{commentCount}</Text>
                <Text style={styles.metricLabel}>Comments</Text>
              </View>

              <View style={styles.metricBox}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
                  <Bookmark size={20} color="#3b82f6" />
                </View>
                <Text style={styles.metricValue}>{post.isSavedByMe ? 1 : 0}</Text>
                <Text style={styles.metricLabel}>Bookmarks</Text>
              </View>

              <View style={styles.metricBox}>
                <View style={[styles.iconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                  <Zap size={20} color="#10b981" />
                </View>
                <Text style={styles.metricValue}>{pollVotes}</Text>
                <Text style={styles.metricLabel}>Poll Votes</Text>
              </View>
            </View>

            {/* Recommendation Box */}
            <View style={styles.tipCard}>
              <View style={styles.tipTitleRow}>
                <Award size={18} color="#f59e0b" />
                <Text style={styles.tipTitle}>Growth Tip</Text>
              </View>
              <Text style={styles.tipText}>
                Posts with active discussion rank higher in Trending. Reply to comments on your Voice to boost reach by up to 2.5x!
              </Text>
            </View>
          </ScrollView>

          {/* Done Button */}
          <TouchableOpacity onPress={onClose} style={styles.doneBtn}>
            <Text style={styles.doneBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'flex-end'
  },
  container: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '82%'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc'
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#334155'
  },
  body: {
    marginVertical: 16
  },
  statusCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20
  },
  statusBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700'
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  timeText: {
    fontSize: 12,
    color: '#94a3b8'
  },
  metricsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 8
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4
  },
  metricsSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 18
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 12
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20
  },
  metricBox: {
    width: '47%',
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center'
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 2
  },
  metricLabel: {
    fontSize: 12,
    color: '#94a3b8'
  },
  tipCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)'
  },
  tipTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fbbf24'
  },
  tipText: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 19
  },
  doneBtn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8
  },
  doneBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700'
  }
})
