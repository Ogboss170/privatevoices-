import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native'
import { useRouter } from 'expo-router'
import { Shield, MessageSquare, Users, ArrowRight } from 'lucide-react-native'
import { colors } from '../../constants/colors'

const SLIDES = [
  {
    icon: Shield,
    title: 'Speak Freely, Safely',
    description: 'Private Voices is built around privacy. You control who can see your content and connect with you.',
  },
  {
    icon: MessageSquare,
    title: 'Anonymous Whispers',
    description: 'Send and receive anonymous messages safely with platform-level abuse prevention built in from day one.',
  },
  {
    icon: Users,
    title: 'Communities & Feed',
    description: 'Join topic communities, follow creators, and discover trending discussions.',
  },
]

export default function OnboardingScreen() {
  const router = useRouter()
  const [currentSlide, setCurrentSlide] = useState(0)

  const handleNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(currentSlide + 1)
    } else {
      router.replace('/(auth)/login')
    }
  }

  const SlideIcon = SLIDES[currentSlide].icon

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <SlideIcon size={40} color={colors.brand} />
        </View>

        <Text style={styles.title}>{SLIDES[currentSlide].title}</Text>
        <Text style={styles.description}>{SLIDES[currentSlide].description}</Text>

        {/* Indicators */}
        <View style={styles.indicatorRow}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.indicator, i === currentSlide && styles.indicatorActive]}
            />
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
          <Text style={styles.nextText}>
            {currentSlide === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          </Text>
          <ArrowRight size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: { paddingHorizontal: 24, paddingTop: 16, alignItems: 'flex-end' },
  skipText: { fontSize: 14, color: colors.gray500, fontWeight: '500' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.gray900, textAlign: 'center', marginBottom: 12 },
  description: { fontSize: 15, color: colors.gray600, textAlign: 'center', lineHeight: 22 },
  indicatorRow: { flexDirection: 'row', gap: 8, marginTop: 40 },
  indicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gray200 },
  indicatorActive: { width: 24, backgroundColor: colors.brand },
  footer: { paddingHorizontal: 24, paddingBottom: 32 },
  nextBtn: {
    backgroundColor: colors.brand,
    paddingVertical: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
