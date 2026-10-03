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
  NativeScrollEvent
} from 'react-native'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { MessageSquare, EyeOff, Users, ShieldCheck, ChevronRight } from 'lucide-react-native'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

export const ONBOARDING_STORAGE_KEY = 'hasCompletedOnboarding'

interface OnboardingSlide {
  id: string
  title: string
  subtitle: string
  icon: React.ComponentType<{ size: number; color: string }>
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

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true')
    } catch {
      // Ignore write error
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
          <TouchableOpacity onPress={completeOnboarding} style={styles.skipButton} activeOpacity={0.7}>
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

      {/* Footer Navigation */}
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

        {/* Action Button */}
        <TouchableOpacity
          style={[styles.actionButton, isLastSlide && styles.getStartedButton]}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={styles.actionButtonText}>
            {isLastSlide ? 'Get Started' : 'Next'}
          </Text>
          {!isLastSlide && <ChevronRight size={20} color="#ffffff" style={{ marginLeft: 4 }} />}
        </TouchableOpacity>
      </View>
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
    paddingBottom: 40,
    paddingTop: 16
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32
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
  getStartedButton: {
    backgroundColor: '#6d28d9'
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700'
  }
})
