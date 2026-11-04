import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  Alert,
} from 'react-native'
import { Stack, useRouter } from 'expo-router'
import {
  Radio,
  Users,
  Mic,
  MicOff,
  Hand,
  Sparkles,
  Shield,
  Award,
  ChevronLeft,
  X,
} from 'lucide-react-native'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'
import { useTheme } from '../context/ThemeContext'
import type { LiveSpace, SpaceParticipant } from '@private-voices/shared'

const ACCENT = '#7c3aed'

export default function MobileSpacesScreen() {
  const router = useRouter()
  const { colors: themeColors, isDark } = useTheme()

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [spaces, setSpaces] = useState<LiveSpace[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Active Space Modal State
  const [activeSpace, setActiveSpace] = useState<LiveSpace | null>(null)
  const [participants, setParticipants] = useState<SpaceParticipant[]>([])
  const [isMasked, setIsMasked] = useState(false)
  const [maskedPersona, setMaskedPersona] = useState('Thoughtful Owl')
  const [handRaised, setHandRaised] = useState(false)
  const [isMuted, setIsMuted] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
  }, [])

  const fetchSpaces = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('spaces')
        .select(`
          *,
          host:profiles!spaces_host_id_fkey(id, username, display_name, avatar_url)
        `)
        .eq('status', 'live')
        .order('created_at', { ascending: false })

      if (!error && data) {
        const mapped: LiveSpace[] = data.map((s: any) => ({
          id: s.id,
          title: s.title,
          topic: s.topic,
          pinnedPrompt: s.pinned_prompt,
          isMaskedAllowed: s.is_masked_allowed ?? true,
          hostId: s.host_id,
          host: s.host
            ? {
                id: s.host.id,
                username: s.host.username,
                displayName: s.host.display_name,
                avatarUrl: s.host.avatar_url,
              }
            : undefined,
          status: s.status,
          speakerCount: s.speaker_count,
          listenerCount: s.listener_count,
          createdAt: s.created_at,
        }))
        setSpaces(mapped)
      }
    } catch (err) {
      console.error('Error fetching mobile spaces:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchSpaces()
  }, [fetchSpaces])

  // Open Space Stage
  const handleJoinSpace = async (space: LiveSpace) => {
    if (!currentUserId) return
    setActiveSpace(space)

    try {
      // Upsert into space_participants
      const isHost = space.hostId === currentUserId
      await supabase.from('space_participants').upsert(
        {
          space_id: space.id,
          user_id: currentUserId,
          role: isHost ? 'host' : 'listener',
          hand_raised: false,
          is_muted: isHost ? false : true,
          is_masked: false,
          masked_persona: null,
          voice_filter: 'none',
        },
        { onConflict: 'space_id,user_id' }
      )

      // Fetch participants
      const { data: partData } = await supabase
        .from('space_participants')
        .select(`
          *,
          profile:profiles!space_participants_user_id_fkey(id, username, display_name, avatar_url)
        `)
        .eq('space_id', space.id)
        .order('joined_at', { ascending: true })

      if (partData) {
        const mappedParts: SpaceParticipant[] = partData.map((p: any) => ({
          id: p.id,
          spaceId: p.space_id,
          userId: p.user_id,
          username: p.is_masked ? (p.masked_persona || 'Masked Voice') : (p.profile?.username || 'user'),
          displayName: p.is_masked ? (p.masked_persona || 'Masked Voice') : (p.profile?.display_name || 'Anonymous'),
          avatarUrl: p.is_masked ? null : (p.profile?.avatar_url || null),
          role: p.role,
          handRaised: p.hand_raised,
          isMuted: p.is_muted,
          isMasked: p.is_masked,
          maskedPersona: p.masked_persona,
          voiceFilter: p.voice_filter,
          joinedAt: p.joined_at,
        }))
        setParticipants(mappedParts)
      }
    } catch (err: any) {
      Alert.alert('Could not join Space', err.message || 'Please try again.')
    }
  }

  const handleLeaveSpace = async () => {
    if (activeSpace && currentUserId) {
      await supabase
        .from('space_participants')
        .delete()
        .eq('space_id', activeSpace.id)
        .eq('user_id', currentUserId)
    }
    setActiveSpace(null)
    fetchSpaces()
  }

  const handleToggleMask = async () => {
    if (!activeSpace || !currentUserId) return
    const nextMasked = !isMasked
    setIsMasked(nextMasked)

    await supabase
      .from('space_participants')
      .update({
        is_masked: nextMasked,
        masked_persona: nextMasked ? maskedPersona : null,
      })
      .eq('space_id', activeSpace.id)
      .eq('user_id', currentUserId)
  }

  const handleToggleHand = async () => {
    if (!activeSpace || !currentUserId) return
    const nextHand = !handRaised
    setHandRaised(nextHand)

    await supabase
      .from('space_participants')
      .update({ hand_raised: nextHand })
      .eq('space_id', activeSpace.id)
      .eq('user_id', currentUserId)
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: themeColors.surfaceBorder }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={themeColors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>
            Live Voice Spaces
          </Text>
          <Text style={[styles.headerSubtitle, { color: themeColors.textSecondary }]}>
            Reflective Dialogue & Deep Dives
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Spaces Feed */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : spaces.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🎙️</Text>
          <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
            No Voice Spaces Live
          </Text>
          <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>
            Check back soon or start a live room from the web to begin thoughtful conversations.
          </Text>
        </View>
      ) : (
        <FlatList
          data={spaces}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                fetchSpaces()
              }}
              tintColor={ACCENT}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.spaceCard,
                {
                  backgroundColor: themeColors.surface,
                  borderColor: themeColors.surfaceBorder,
                },
              ]}
              onPress={() => handleJoinSpace(item)}
              activeOpacity={0.8}
            >
              <View style={styles.cardHeader}>
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveBadgeText}>LIVE</Text>
                </View>

                <View style={styles.listenersPill}>
                  <Users size={12} color="#94a3b8" />
                  <Text style={styles.listenersText}>
                    {item.speakerCount + item.listenerCount} in room
                  </Text>
                </View>
              </View>

              <Text style={[styles.cardTitle, { color: themeColors.textPrimary }]}>
                {item.title}
              </Text>

              {item.pinnedPrompt ? (
                <View style={styles.pinnedPromptBox}>
                  <Text style={styles.promptIcon}>💡</Text>
                  <Text style={styles.pinnedPromptText} numberOfLines={2}>
                    {item.pinnedPrompt}
                  </Text>
                </View>
              ) : null}

              {item.topic ? (
                <Text style={[styles.cardTopic, { color: themeColors.textSecondary }]} numberOfLines={2}>
                  {item.topic}
                </Text>
              ) : null}

              <View style={styles.cardFooter}>
                <View style={styles.hostRow}>
                  <View style={styles.hostAvatarPlaceholder}>
                    <Text style={styles.hostAvatarLetter}>
                      {item.host?.displayName?.charAt(0).toUpperCase() || 'H'}
                    </Text>
                  </View>
                  <Text style={[styles.hostName, { color: themeColors.textPrimary }]}>
                    {item.host?.displayName || 'Host'}
                  </Text>
                </View>

                {item.isMaskedAllowed ? (
                  <View style={styles.maskSupportPill}>
                    <Text style={styles.maskSupportText}>🎭 Masked Voice</Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Active Space Full Modal Sheet */}
      {activeSpace ? (
        <Modal
          visible={!!activeSpace}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={handleLeaveSpace}
        >
          <SafeAreaView style={styles.stageModal}>
            <View style={styles.stageHeader}>
              <View style={styles.stageTitleWrap}>
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveBadgeText}>LIVE</Text>
                </View>
                <Text style={styles.stageTitle} numberOfLines={1}>
                  {activeSpace.title}
                </Text>
              </View>
              <TouchableOpacity onPress={handleLeaveSpace} style={styles.closeStageBtn}>
                <X size={20} color="#cbd5e1" />
              </TouchableOpacity>
            </View>

            {/* Pinned Thought Starter on Stage */}
            {activeSpace.pinnedPrompt ? (
              <View style={styles.stagePromptCard}>
                <Text style={styles.stagePromptIcon}>💡</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stagePromptLabel}>PINNED QUESTION</Text>
                  <Text style={styles.stagePromptText}>{activeSpace.pinnedPrompt}</Text>
                </View>
              </View>
            ) : null}

            {/* Speakers / Participants Stage */}
            <View style={styles.stageBody}>
              <Text style={styles.stageSectionTitle}>
                ROOM PARTICIPANTS ({participants.length})
              </Text>
              <FlatList
                data={participants}
                keyExtractor={(item) => item.id}
                numColumns={3}
                contentContainerStyle={styles.participantsGrid}
                renderItem={({ item }) => (
                  <View style={styles.participantItem}>
                    <View style={styles.participantAvatarWrap}>
                      <View style={styles.participantAvatar}>
                        <Text style={styles.participantAvatarEmoji}>
                          {item.isMasked ? '🎭' : item.displayName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.participantRoleTag}>
                        {item.role === 'host' ? (
                          <Shield size={10} color="#0f172a" />
                        ) : (
                          <Award size={10} color="#0f172a" />
                        )}
                      </View>
                    </View>
                    <Text style={styles.participantName} numberOfLines={1}>
                      {item.displayName}
                    </Text>
                    <Text style={styles.participantRoleLabel}>
                      {item.isMasked ? 'Masked' : item.role}
                    </Text>
                  </View>
                )}
              />
            </View>

            {/* Stage Bottom Controls */}
            <View style={styles.stageControls}>
              <TouchableOpacity onPress={handleLeaveSpace} style={styles.leaveBtn}>
                <Text style={styles.leaveBtnText}>Leave Quietly</Text>
              </TouchableOpacity>

              <View style={styles.rightControls}>
                {activeSpace.isMaskedAllowed ? (
                  <TouchableOpacity
                    onPress={handleToggleMask}
                    style={[styles.ctrlBtn, isMasked && styles.ctrlBtnActive]}
                  >
                    <Text style={styles.ctrlBtnText}>{isMasked ? '🎭 Masked' : '🎭 Real'}</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  onPress={handleToggleHand}
                  style={[styles.ctrlBtn, handRaised && styles.ctrlBtnRaised]}
                >
                  <Hand size={16} color={handRaised ? '#0f172a' : '#ffffff'} />
                  <Text style={[styles.ctrlBtnText, handRaised && { color: '#0f172a' }]}>
                    {handRaised ? 'Raised' : 'Raise'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </Modal>
      ) : null}
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
  backButton: {
    padding: 6,
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  listContent: {
    padding: 16,
    gap: 14,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  spaceCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
    marginRight: 6,
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ef4444',
    letterSpacing: 0.5,
  },
  listenersPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listenersText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  pinnedPromptBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    gap: 8,
  },
  promptIcon: {
    fontSize: 14,
  },
  pinnedPromptText: {
    flex: 1,
    fontSize: 12,
    color: '#7c3aed',
    fontWeight: '600',
    lineHeight: 16,
  },
  cardTopic: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.15)',
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hostAvatarPlaceholder: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostAvatarLetter: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  hostName: {
    fontSize: 12,
    fontWeight: '600',
  },
  maskSupportPill: {
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  maskSupportText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7c3aed',
  },
  stageModal: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  stageTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  stageTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  closeStageBtn: {
    padding: 6,
  },
  stagePromptCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    padding: 14,
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.4)',
    gap: 10,
  },
  stagePromptIcon: {
    fontSize: 18,
  },
  stagePromptLabel: {
    color: '#c4b5fd',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  stagePromptText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  stageBody: {
    flex: 1,
    padding: 16,
  },
  stageSectionTitle: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  participantsGrid: {
    gap: 16,
  },
  participantItem: {
    flex: 1 / 3,
    alignItems: 'center',
    marginBottom: 16,
  },
  participantAvatarWrap: {
    position: 'relative',
    marginBottom: 6,
  },
  participantAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantAvatarEmoji: {
    fontSize: 22,
    color: '#ffffff',
    fontWeight: '700',
  },
  participantRoleTag: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    padding: 2,
  },
  participantName: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 80,
  },
  participantRoleLabel: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 2,
  },
  stageControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: '#0d1322',
  },
  leaveBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  leaveBtnText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '700',
  },
  rightControls: {
    flexDirection: 'row',
    gap: 8,
  },
  ctrlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
  },
  ctrlBtnActive: {
    backgroundColor: '#7c3aed',
  },
  ctrlBtnRaised: {
    backgroundColor: '#f59e0b',
  },
  ctrlBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
})
