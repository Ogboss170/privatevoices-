import React, { useState, useRef, useEffect } from 'react'
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Dimensions,
  SafeAreaView,
  StatusBar,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  MessageSquare,
  EyeOff,
  Users,
  ShieldCheck,
  ChevronRight,
  Check,
  X,
  LucideIcon,
  Sparkles,
  UserPlus,
  Plus,
} from 'lucide-react-native'
import { Image } from 'expo-image'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

export const ONBOARDING_STORAGE_KEY = 'hasCompletedOnboarding'
export const CONSENT_STORAGE_KEY = 'hasConsentedTerms'
export const CONSENT_DATE_STORAGE_KEY = 'consentedTermsAt'

interface OnboardingSlide {
  id: string
  title: string
  subtitle: string
  icon: LucideIcon
  accentColor: string
  badgeText?: string
}

const SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    title: 'Express Yourself',
    subtitle: 'Share your thoughts, ideas, and moments with a community that gives you space to be yourself freely.',
    icon: MessageSquare,
    accentColor: '#8b5cf6',
  },
  {
    id: '2',
    title: 'Speak Freely',
    subtitle: 'Receive honest messages from people without revealing who they are. Anonymous Whispers are private and strictly ONE-WAY.',
    icon: EyeOff,
    accentColor: '#ec4899',
    badgeText: 'One-Way Whispers',
  },
  {
    id: '3',
    title: 'Connect & Discover',
    subtitle: 'Find interesting people, conversations, communities, and ideas that matter to you.',
    icon: Users,
    accentColor: '#3b82f6',
  },
  {
    id: '4',
    title: 'Privacy at the Center',
    subtitle: 'You control what you share, who can interact with you, and how you experience Private Voices.',
    icon: ShieldCheck,
    accentColor: '#10b981',
  },
]

const TOPICS = [
  { id: 'tech', label: 'Programming & Tech', emoji: '💻' },
  { id: 'design', label: 'UI/UX & Design', emoji: '🎨' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
  { id: 'crypto', label: 'Crypto & Web3', emoji: '🪙' },
  { id: 'campus', label: 'Campus Life', emoji: '🎓' },
  { id: 'music', label: 'Music & Audio', emoji: '🎵' },
  { id: 'fitness', label: 'Fitness & Health', emoji: '💪' },
  { id: 'anime', label: 'Anime & Manga', emoji: '⛩️' },
]

export default function OnboardingScreen() {
  const router = useRouter()
  const flatListRef = useRef<FlatList<OnboardingSlide>>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  // Guided Flow Steps: 'slides' -> 'interests' -> 'suggestions'
  const [flowStep, setFlowStep] = useState<'slides' | 'interests' | 'suggestions'>('slides')

  // Consent checkbox state
  const [hasConsented, setHasConsented] = useState(false)
  const [activeLegalModal, setActiveLegalModal] = useState<'terms' | 'privacy' | null>(null)

  // Step 2: Topics Selection
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])

  // Step 3: Suggested Users & Communities
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([])
  const [suggestedCommunities, setSuggestedCommunities] = useState<any[]>([])
  const [followedUserIds, setFollowedUserIds] = useState<string[]>([])
  const [joinedCommunityIds, setJoinedCommunityIds] = useState<string[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setCurrentUserId(data.user.id)
    })
  }, [])

  const fetchSuggestions = async () => {
    setLoadingSuggestions(true)
    const [{ data: users }, { data: comms }] = await Promise.all([
      supabase.from('profiles').select('id, username, display_name, avatar_url').neq('id', currentUserId || '').limit(5),
      supabase.from('communities').select('id, name, slug, description, avatar_url').limit(4),
    ])
    setSuggestedUsers(users || [])
    setSuggestedCommunities(comms || [])
    setLoadingSuggestions(false)
  }

  const completeOnboarding = async () => {
    try {
      const timestamp = new Date().toISOString()
      await AsyncStorage.multiSet([
        [ONBOARDING_STORAGE_KEY, 'true'],
        [CONSENT_STORAGE_KEY, 'true'],
        [CONSENT_DATE_STORAGE_KEY, timestamp],
      ])
    } catch {
      // Ignore storage error
    }
    const { data } = await supabase.auth.getSession()
    if (data.session) {
      router.replace('/(tabs)')
    } else {
      router.replace('/(auth)/login')
    }
  }

  const handleNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      const nextIndex = activeIndex + 1
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true })
      setActiveIndex(nextIndex)
    } else {
      setFlowStep('interests')
    }
  }

  const handleToggleTopic = (topicId: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topicId) ? prev.filter((id) => id !== topicId) : [...prev, topicId]
    )
  }

  const handleToggleFollow = async (targetId: string) => {
    if (!currentUserId) return
    const isFollowing = followedUserIds.includes(targetId)
    if (isFollowing) {
      setFollowedUserIds((prev) => prev.filter((id) => id !== targetId))
      await supabase.from('follows').delete().match({ follower_id: currentUserId, following_id: targetId })
    } else {
      setFollowedUserIds((prev) => [...prev, targetId])
      await supabase.from('follows').insert({ follower_id: currentUserId, following_id: targetId })
    }
  }

  const handleToggleJoinCommunity = async (commId: string) => {
    if (!currentUserId) return
    const isJoined = joinedCommunityIds.includes(commId)
    if (isJoined) {
      setJoinedCommunityIds((prev) => prev.filter((id) => id !== commId))
      await supabase.from('community_members').delete().match({ community_id: commId, user_id: currentUserId })
    } else {
      setJoinedCommunityIds((prev) => [...prev, commId])
      await supabase.from('community_members').insert({ community_id: commId, user_id: currentUserId, role: 'member' })
    }
  }

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width
    const index = Math.round(event.nativeEvent.contentOffset.x / slideSize)
    if (index >= 0 && index < SLIDES.length && index !== activeIndex) {
      setActiveIndex(index)
    }
  }

  const isLastSlide = activeIndex === SLIDES.length - 1

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Header Skip button */}
      <View style={styles.header}>
        <View />
        <TouchableOpacity onPress={() => completeOnboarding()} style={styles.skipButton} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {flowStep === 'slides' && (
        <>
          <FlatList
            ref={flatListRef}
            data={SLIDES}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            renderItem={({ item }) => {
              const IconComponent = item.icon
              return (
                <View style={styles.slide}>
                  <View style={[styles.iconContainer, { backgroundColor: `${item.accentColor}1A`, borderColor: `${item.accentColor}40` }]}>
                    <IconComponent size={64} color={item.accentColor} />
                  </View>

                  {item.badgeText && (
                    <View style={[styles.badge, { backgroundColor: `${item.accentColor}25`, borderColor: `${item.accentColor}60` }]}>
                      <Text style={[styles.badgeText, { color: item.accentColor }]}>{item.badgeText}</Text>
                    </View>
                  )}

                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.subtitle}>{item.subtitle}</Text>
                </View>
              )
            }}
          />

          <View style={styles.footer}>
            <View style={styles.indicatorContainer}>
              {SLIDES.map((_, index) => (
                <View
                  key={index}
                  style={[styles.indicator, index === activeIndex ? styles.activeIndicator : styles.inactiveIndicator]}
                />
              ))}
            </View>

            {isLastSlide && (
              <View style={styles.consentContainer}>
                <TouchableOpacity style={styles.checkboxRow} onPress={() => setHasConsented(!hasConsented)} activeOpacity={0.8}>
                  <View style={[styles.checkbox, hasConsented && styles.checkboxChecked]}>
                    {hasConsented && <Check size={14} color="#ffffff" strokeWidth={3} />}
                  </View>
                  <Text style={styles.consentText}>
                    I agree to the{' '}
                    <Text style={styles.legalLink} onPress={() => setActiveLegalModal('terms')}>Terms & Conditions</Text> and{' '}
                    <Text style={styles.legalLink} onPress={() => setActiveLegalModal('privacy')}>Privacy Policy</Text>.
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={[styles.actionButton, isLastSlide && (hasConsented ? styles.getStartedButtonActive : styles.getStartedButtonDisabled)]}
              onPress={handleNext}
              disabled={isLastSlide && !hasConsented}
            >
              <Text style={[styles.actionButtonText, isLastSlide && !hasConsented && styles.disabledButtonText]}>
                {isLastSlide ? 'Continue to Interests' : 'Next'}
              </Text>
              {!isLastSlide && <ChevronRight size={20} color="#ffffff" style={{ marginLeft: 4 }} />}
            </TouchableOpacity>
          </View>
        </>
      )}

      {flowStep === 'interests' && (
        <ScrollView style={styles.guidedContainer} contentContainerStyle={styles.guidedContent}>
          <View style={styles.stepBadge}><Sparkles size={14} color="#8b5cf6" /><Text style={styles.stepBadgeText}>STEP 1 OF 2</Text></View>
          <Text style={styles.guidedTitle}>What interests you?</Text>
          <Text style={styles.guidedSub}>Pick a few topics to customize your personalized feeds and recommendations.</Text>

          <View style={styles.topicsGrid}>
            {TOPICS.map((topic) => {
              const isSelected = selectedTopics.includes(topic.id)
              return (
                <TouchableOpacity
                  key={topic.id}
                  style={[styles.topicChip, isSelected && styles.topicChipSelected]}
                  onPress={() => handleToggleTopic(topic.id)}
                >
                  <Text style={styles.topicEmoji}>{topic.emoji}</Text>
                  <Text style={[styles.topicText, isSelected && styles.topicTextSelected]}>{topic.label}</Text>
                  {isSelected && <Check size={14} color="#8b5cf6" />}
                </TouchableOpacity>
              )
            })}
          </View>

          <TouchableOpacity
            style={[styles.actionButton, { marginTop: 32 }]}
            onPress={() => {
              setFlowStep('suggestions')
              fetchSuggestions()
            }}
          >
            <Text style={styles.actionButtonText}>Next: Discover People & Groups</Text>
            <ChevronRight size={20} color="#ffffff" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </ScrollView>
      )}

      {flowStep === 'suggestions' && (
        <ScrollView style={styles.guidedContainer} contentContainerStyle={styles.guidedContent}>
          <View style={styles.stepBadge}><Sparkles size={14} color="#8b5cf6" /><Text style={styles.stepBadgeText}>STEP 2 OF 2</Text></View>
          <Text style={styles.guidedTitle}>Suggested Accounts & Groups</Text>
          <Text style={styles.guidedSub}>Follow voices and join communities to fill your feed right away.</Text>

          {loadingSuggestions ? (
            <ActivityIndicator size="large" color="#8b5cf6" style={{ marginVertical: 32 }} />
          ) : (
            <>
              {/* Suggested People */}
              <Text style={styles.sectionHeader}>PEOPLE TO FOLLOW</Text>
              {suggestedUsers.map((user) => {
                const isFollowing = followedUserIds.includes(user.id)
                return (
                  <View key={user.id} style={styles.suggestionRow}>
                    <View style={styles.avatarCircle}>
                      {user.avatar_url ? <Image source={{ uri: user.avatar_url }} style={styles.avatarImg} /> : <Text style={styles.avatarText}>{user.display_name?.charAt(0)}</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName}>{user.display_name}</Text>
                      <Text style={styles.rowSub}>@{user.username}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.followBtn, isFollowing && styles.followingBtn]}
                      onPress={() => handleToggleFollow(user.id)}
                    >
                      <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                        {isFollowing ? 'Following' : 'Follow'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )
              })}

              {/* Suggested Communities */}
              <Text style={[styles.sectionHeader, { marginTop: 20 }]}>COMMUNITIES TO JOIN</Text>
              {suggestedCommunities.map((comm) => {
                const isJoined = joinedCommunityIds.includes(comm.id)
                return (
                  <View key={comm.id} style={styles.suggestionRow}>
                    <View style={[styles.avatarCircle, { backgroundColor: '#3b82f620' }]}>
                      {comm.avatar_url ? <Image source={{ uri: comm.avatar_url }} style={styles.avatarImg} /> : <Text style={[styles.avatarText, { color: '#3b82f6' }]}>{comm.name?.charAt(0)}</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName}>{comm.name}</Text>
                      <Text style={styles.rowSub} numberOfLines={1}>{comm.description || 'Topic community'}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.followBtn, isJoined && styles.followingBtn]}
                      onPress={() => handleToggleJoinCommunity(comm.id)}
                    >
                      <Text style={[styles.followBtnText, isJoined && styles.followingBtnText]}>
                        {isJoined ? 'Joined' : 'Join'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )
              })}
            </>
          )}

          <TouchableOpacity style={[styles.actionButton, { marginTop: 32 }]} onPress={completeOnboarding}>
            <Text style={styles.actionButtonText}>Enter Private Voices 🎉</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Legal Modals */}
      <Modal visible={activeLegalModal !== null} animationType="slide" transparent onRequestClose={() => setActiveLegalModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{activeLegalModal === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}</Text>
              <TouchableOpacity onPress={() => setActiveLegalModal(null)} style={styles.closeButton}><X size={20} color="#94a3b8" /></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.legalBodyText}>Standard Private Voices Privacy and Legal Policy terms.</Text>
            </ScrollView>
            <TouchableOpacity style={styles.modalDoneButton} onPress={() => setActiveLegalModal(null)}><Text style={styles.modalDoneText}>Close</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  skipButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#1e293b' },
  skipText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  slide: { width: SCREEN_WIDTH, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconContainer: { width: 130, height: 130, borderRadius: 65, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  badge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1, marginBottom: 16 },
  badgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  title: { fontSize: 28, fontWeight: '700', color: '#f8fafc', textAlign: 'center', marginBottom: 16 },
  subtitle: { fontSize: 16, color: '#94a3b8', textAlign: 'center', lineHeight: 24, paddingHorizontal: 12 },
  footer: { paddingHorizontal: 32, paddingBottom: 36, paddingTop: 12 },
  indicatorContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  indicator: { height: 8, borderRadius: 4, marginHorizontal: 4 },
  activeIndicator: { width: 28, backgroundColor: '#8b5cf6' },
  inactiveIndicator: { width: 8, backgroundColor: '#334155' },
  consentContainer: { marginBottom: 20, paddingHorizontal: 4 },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#475569', backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkboxChecked: { borderColor: '#8b5cf6', backgroundColor: '#8b5cf6' },
  consentText: { flex: 1, fontSize: 13, color: '#94a3b8', lineHeight: 19 },
  legalLink: { color: '#c084fc', fontWeight: '600', textDecorationLine: 'underline' },
  actionButton: { height: 56, borderRadius: 28, backgroundColor: '#7c3aed', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  getStartedButtonActive: { backgroundColor: '#7c3aed' },
  getStartedButtonDisabled: { backgroundColor: '#334155', shadowOpacity: 0, elevation: 0 },
  actionButtonText: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  disabledButtonText: { color: '#94a3b8' },

  // Guided Flow Styles
  guidedContainer: { flex: 1 },
  guidedContent: { padding: 24, paddingBottom: 60 },
  stepBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#8b5cf620', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 12 },
  stepBadgeText: { fontSize: 11, fontWeight: '800', color: '#c084fc', letterSpacing: 0.5 },
  guidedTitle: { fontSize: 26, fontWeight: '700', color: '#f8fafc', marginBottom: 8 },
  guidedSub: { fontSize: 14, color: '#94a3b8', lineHeight: 20, marginBottom: 24 },
  topicsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  topicChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1e293b', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: '#334155' },
  topicChipSelected: { borderColor: '#8b5cf6', backgroundColor: '#8b5cf620' },
  topicEmoji: { fontSize: 16 },
  topicText: { fontSize: 14, color: '#cbd5e1', fontWeight: '600' },
  topicTextSelected: { color: '#ffffff' },

  sectionHeader: { fontSize: 12, fontWeight: '800', color: '#64748b', letterSpacing: 0.5, marginBottom: 12 },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1e293b', padding: 12, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#8b5cf620', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 40, height: 40 },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#c084fc' },
  rowName: { fontSize: 14, fontWeight: '700', color: '#f8fafc' },
  rowSub: { fontSize: 12, color: '#94a3b8' },
  followBtn: { backgroundColor: '#7c3aed', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  followBtnText: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
  followingBtn: { backgroundColor: '#334155' },
  followingBtnText: { color: '#94a3b8' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#334155' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#f8fafc' },
  closeButton: { padding: 6, borderRadius: 16, backgroundColor: '#334155' },
  modalBody: { marginBottom: 20 },
  legalBodyText: { color: '#cbd5e1', fontSize: 14, lineHeight: 22 },
  modalDoneButton: { height: 48, borderRadius: 24, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center' },
  modalDoneText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
})
