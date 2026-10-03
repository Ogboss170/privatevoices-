import React, { useState, useRef } from 'react'
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
  ScrollView
} from 'react-native'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { MessageSquare, EyeOff, Users, ShieldCheck, ChevronRight, Check, X, LucideIcon } from 'lucide-react-native'

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
    accentColor: '#8b5cf6'
  },
  {
    id: '2',
    title: 'Speak Freely',
    subtitle: 'Receive honest messages from people without revealing who they are. Anonymous Whispers are private and strictly ONE-WAY — read, delete, or report with no reply pressure.',
    icon: EyeOff,
    accentColor: '#ec4899',
    badgeText: 'One-Way Whispers'
  },
  {
    id: '3',
    title: 'Connect & Discover',
    subtitle: 'Find interesting people, conversations, communities, and ideas that matter to you.',
    icon: Users,
    accentColor: '#3b82f6'
  },
  {
    id: '4',
    title: 'Privacy at the Center',
    subtitle: 'You control what you share, who can interact with you, and how you experience Private Voices.',
    icon: ShieldCheck,
    accentColor: '#10b981'
  }
]

export default function OnboardingScreen() {
  const router = useRouter()
  const flatListRef = useRef<FlatList<OnboardingSlide>>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  // Consent checkbox state — starts UNCHECKED
  const [hasConsented, setHasConsented] = useState(false)

  // Legal Modal states
  const [activeLegalModal, setActiveLegalModal] = useState<'terms' | 'privacy' | null>(null)

  const completeOnboarding = async () => {
    // If on last slide and consent is missing, block completion
    if (activeIndex === SLIDES.length - 1 && !hasConsented) {
      return
    }

    try {
      const timestamp = new Date().toISOString()
      await AsyncStorage.multiSet([
        [ONBOARDING_STORAGE_KEY, 'true'],
        [CONSENT_STORAGE_KEY, 'true'],
        [CONSENT_DATE_STORAGE_KEY, timestamp]
      ])
    } catch {
      // Ignore storage error
    }
    router.replace('/(auth)/login')
  }

  const handleNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      const nextIndex = activeIndex + 1
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true })
      setActiveIndex(nextIndex)
    } else {
      completeOnboarding()
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
        {!isLastSlide && (
          <TouchableOpacity onPress={() => completeOnboarding()} style={styles.skipButton} activeOpacity={0.7}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Main Slide Carousel */}
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

      {/* Footer Navigation & Legal Consent */}
      <View style={styles.footer}>
        {/* Page Indicators */}
        <View style={styles.indicatorContainer}>
          {SLIDES.map((_, index) => {
            const isActive = index === activeIndex
            return (
              <View
                key={index}
                style={[
                  styles.indicator,
                  isActive ? styles.activeIndicator : styles.inactiveIndicator
                ]}
              />
            )
          })}
        </View>

        {/* Consent Checkbox on final slide */}
        {isLastSlide && (
          <View style={styles.consentContainer}>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setHasConsented(!hasConsented)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, hasConsented && styles.checkboxChecked]}>
                {hasConsented && <Check size={14} color="#ffffff" strokeWidth={3} />}
              </View>
              <Text style={styles.consentText}>
                I agree to the{' '}
                <Text style={styles.legalLink} onPress={() => setActiveLegalModal('terms')}>
                  Terms & Conditions
                </Text>{' '}
                and{' '}
                <Text style={styles.legalLink} onPress={() => setActiveLegalModal('privacy')}>
                  Privacy Policy
                </Text>
                , and confirm that I meet the minimum age requirement to use Private Voices.
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Action Button */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            isLastSlide && (hasConsented ? styles.getStartedButtonActive : styles.getStartedButtonDisabled)
          ]}
          onPress={handleNext}
          disabled={isLastSlide && !hasConsented}
          activeOpacity={isLastSlide && !hasConsented ? 1 : 0.85}
        >
          <Text style={[styles.actionButtonText, isLastSlide && !hasConsented && styles.disabledButtonText]}>
            {isLastSlide ? 'Get Started' : 'Next'}
          </Text>
          {!isLastSlide && <ChevronRight size={20} color="#ffffff" style={{ marginLeft: 4 }} />}
        </TouchableOpacity>
      </View>

      {/* Terms & Privacy Modals */}
      <Modal
        visible={activeLegalModal !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setActiveLegalModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {activeLegalModal === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}
              </Text>
              <TouchableOpacity onPress={() => setActiveLegalModal(null)} style={styles.closeButton}>
                <X size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={true}>
              {activeLegalModal === 'terms' ? (
                <Text style={styles.legalBodyText}>
                  Welcome to Private Voices.{'\n\n'}
                  1. Acceptance of Terms: By creating an account or using Private Voices, you agree to comply with and be bound by these Terms & Conditions.{'\n\n'}
                  2. Age Requirement: You confirm that you meet the minimum legal age requirement (at least 13 years old or age of consent in your jurisdiction) to access Private Voices.{'\n\n'}
                  3. Privacy & One-Way Whispers: Anonymous Whispers are strictly one-way communications designed for safety. Harassment, hate speech, illegal activities, and spam are strictly prohibited.{'\n\n'}
                  4. Account Responsibility: You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.{'\n\n'}
                  5. Termination: Private Voices reserves the right to suspend or terminate accounts that violate platform community safety standards.
                </Text>
              ) : (
                <Text style={styles.legalBodyText}>
                  Privacy Policy for Private Voices.{'\n\n'}
                  1. Information We Collect: We collect basic account metadata (username, display name, email) and necessary device state to provide a secure private messaging experience.{'\n\n'}
                  2. Anonymous Whispers: Whispers are routed confidentially without revealing sender identities to recipients. Platform moderation signals are evaluated strictly to enforce abuse prevention.{'\n\n'}
                  3. Data Security: Your data is protected using enterprise-grade encryption in transit and at rest with Supabase auth security standards.{'\n\n'}
                  4. Your Rights: You control your profile privacy settings, community visibility, and can request account or data deletion at any time in settings.
                </Text>
              )}
            </ScrollView>

            <TouchableOpacity style={styles.modalDoneButton} onPress={() => setActiveLegalModal(null)}>
              <Text style={styles.modalDoneText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#1e293b'
  },
  skipText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600'
  },
  slide: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32
  },
  iconContainer: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 16
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 12
  },
  footer: {
    paddingHorizontal: 32,
    paddingBottom: 36,
    paddingTop: 12
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24
  },
  indicator: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4
  },
  activeIndicator: {
    width: 28,
    backgroundColor: '#8b5cf6'
  },
  inactiveIndicator: {
    width: 8,
    backgroundColor: '#334155'
  },
  consentContainer: {
    marginBottom: 20,
    paddingHorizontal: 4
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#475569',
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2
  },
  checkboxChecked: {
    borderColor: '#8b5cf6',
    backgroundColor: '#8b5cf6'
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 19
  },
  legalLink: {
    color: '#c084fc',
    fontWeight: '600',
    textDecorationLine: 'underline'
  },
  actionButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: '#7c3aed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  getStartedButtonActive: {
    backgroundColor: '#7c3aed'
  },
  getStartedButtonDisabled: {
    backgroundColor: '#334155',
    shadowOpacity: 0,
    elevation: 0
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700'
  },
  disabledButtonText: {
    color: '#94a3b8'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc'
  },
  closeButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#334155'
  },
  modalBody: {
    marginBottom: 20
  },
  legalBodyText: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 22
  },
  modalDoneButton: {
    height: 48,
    borderRadius: 24,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalDoneText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700'
  }
})
