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
  Switch,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  Star,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Shield,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react-native'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'
import { useTheme } from '../context/ThemeContext'
import type { AppRatingRecord, AppRatingSummary } from '@private-voices/shared'

const RATING_PROMPTS: Record<number, { title: string; subtitle: string; placeholder: string }> = {
  1: {
    title: 'We are sorry to hear that.',
    subtitle: 'What went wrong or frustrated you? Your feedback helps us fix issues urgently.',
    placeholder: 'Tell us what happened, any bugs or confusing parts of the app...',
  },
  2: {
    title: 'We can do better.',
    subtitle: 'What needs improvement to make Private Voices worthwhile for you?',
    placeholder: 'What felt lacking or difficult to use on mobile?',
  },
  3: {
    title: 'Thank you for your candid feedback.',
    subtitle: 'What could we add or change to make your experience a 5-star one?',
    placeholder: 'What would turn this into a great experience for you?',
  },
  4: {
    title: 'Glad you are enjoying Private Voices!',
    subtitle: 'What features do you like best, and what is missing for a perfect 5 stars?',
    placeholder: 'Tell us what you liked and any suggestions you have...',
  },
  5: {
    title: 'Thrilled you love Private Voices!',
    subtitle: 'What do you enjoy most about private voices, encrypted whispers, or communities?',
    placeholder: 'Share your favorite moments, communities, or audio stories...',
  },
}

export default function RateScreen() {
  const router = useRouter()
  const { colors: themeColors, isDark } = useTheme()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [userRating, setUserRating] = useState<AppRatingRecord | null>(null)

  // Form State
  const [selectedRating, setSelectedRating] = useState<number>(0)
  const [reviewText, setReviewText] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)

  // Genuine Public Summary
  const [ratingSummary, setRatingSummary] = useState<AppRatingSummary | null>(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const { data: authData } = await supabase.auth.getUser()
      const currentUid = authData?.user?.id ?? null
      setUserId(currentUid)

      if (currentUid) {
        const { data: existingRating } = await supabase
          .from('app_ratings')
          .select('*')
          .eq('user_id', currentUid)
          .maybeSingle()

        if (existingRating) {
          setUserRating(existingRating)
          setSelectedRating(existingRating.rating)
          setReviewText(existingRating.review || '')
          setIsAnonymous(existingRating.is_anonymous || false)
        }
      }

      const { data: summaryData } = await supabase.rpc('get_app_rating_summary')
      if (summaryData) {
        setRatingSummary(summaryData)
      }
    } catch (err) {
      console.error('Failed to load rating data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSubmit = async () => {
    if (selectedRating < 1 || selectedRating > 5) {
      Alert.alert('Selection Required', 'Please select a star rating from 1 to 5.')
      return
    }

    setSubmitting(true)
    try {
      const { data, error } = await supabase.rpc('submit_app_rating', {
        p_rating: selectedRating,
        p_review: reviewText.trim() || null,
        p_is_anonymous: isAnonymous,
        p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
        p_device_info: {
          platform: Platform.OS,
          version: Platform.Version,
        },
      })

      if (error) throw error

      if (data?.error === 'ACCOUNT_RESTRICTED') {
        Alert.alert('Restricted', 'Your account is restricted from submitting ratings.')
        return
      }

      await loadData()
      Alert.alert('Feedback Recorded', 'Thank you! Your feedback has been securely stored. You can edit it at any time.')
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not save rating.')
    } finally {
      setSubmitting(false)
    }
  }

  const activePrompt = RATING_PROMPTS[selectedRating || 5]

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
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>Rate Private Voices</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
          <View style={styles.iconCircle}>
            <Star size={30} color="#d97706" fill="#f59e0b" />
          </View>

          <Text style={[styles.promptTitle, { color: themeColors.text }]}>
            How is your experience with Private Voices?
          </Text>
          <Text style={[styles.promptSubtitle, { color: themeColors.textSecondary }]}>
            Your honest rating directly shapes privacy protections and future releases.
          </Text>

          {/* 5-Star Selector */}
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => {
              const isFilled = selectedRating >= star
              return (
                <TouchableOpacity
                  key={star}
                  onPress={() => setSelectedRating(star)}
                  style={styles.starTouch}
                  activeOpacity={0.7}
                >
                  <Star
                    size={38}
                    color={isFilled ? '#f59e0b' : colors.gray300}
                    fill={isFilled ? '#f59e0b' : 'transparent'}
                  />
                </TouchableOpacity>
              )
            })}
          </View>

          <Text style={styles.ratingCountLabel}>
            {selectedRating > 0 ? `${selectedRating} of 5 Stars` : 'Tap to select stars'}
          </Text>

          {/* Rating Prompt Guidance */}
          {selectedRating > 0 && (
            <View style={[styles.followUpBox, { backgroundColor: isDark ? '#18181b' : '#f8fafc', borderColor: themeColors.surfaceBorder }]}>
              <Text style={[styles.followUpTitle, { color: themeColors.text }]}>{activePrompt.title}</Text>
              <Text style={[styles.followUpDesc, { color: themeColors.textSecondary }]}>{activePrompt.subtitle}</Text>
            </View>
          )}

          {/* Written Feedback Field */}
          <View style={styles.formGroup}>
            <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Optional Written Feedback</Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: isDark ? '#18181b' : '#f8fafc',
                  borderColor: themeColors.surfaceBorder,
                  color: themeColors.text,
                },
              ]}
              multiline
              numberOfLines={4}
              placeholder={activePrompt.placeholder}
              placeholderTextColor={colors.gray400}
              value={reviewText}
              onChangeText={setReviewText}
              maxLength={1000}
            />
            <Text style={styles.charCount}>{reviewText.length}/1000</Text>
          </View>

          {/* Anonymous Feedback Toggle */}
          <View style={[styles.anonRow, { borderColor: themeColors.surfaceBorder, backgroundColor: isDark ? '#18181b' : '#f8fafc' }]}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <View style={styles.anonTitleRow}>
                {isAnonymous ? <EyeOff size={15} color="#7c3aed" /> : <Eye size={15} color="#7c3aed" />}
                <Text style={[styles.anonTitle, { color: themeColors.text }]}>Submit Anonymously</Text>
              </View>
              <Text style={[styles.anonDesc, { color: themeColors.textSecondary }]}>
                {isAnonymous
                  ? 'Your username will be omitted from public community summaries.'
                  : 'Your feedback will be attributed to your verified profile.'}
              </Text>
            </View>
            <Switch
              value={isAnonymous}
              onValueChange={setIsAnonymous}
              trackColor={{ false: colors.gray300, true: colors.brand }}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, (selectedRating === 0 || submitting) && styles.disabledBtn]}
            disabled={selectedRating === 0 || submitting}
            onPress={handleSubmit}
          >
            <Text style={styles.submitBtnText}>
              {submitting ? 'Saving...' : userRating ? 'Update Feedback' : 'Submit Feedback'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Store Listing Notice */}
        <View style={[styles.storeCard, { backgroundColor: isDark ? '#18181b' : '#f8fafc', borderColor: themeColors.surfaceBorder }]}>
          <Text style={[styles.storeTitle, { color: themeColors.text }]}>Store Review Status</Text>
          <Text style={[styles.storeText, { color: themeColors.textSecondary }]}>
            Private Voices is distributed via preview channel. Native app store prompts will become active upon official public listing on Google Play and Apple App Store.
          </Text>
        </View>

        {/* Community Rating Summary */}
        {ratingSummary && ratingSummary.totalReviews > 0 && (
          <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
            <Text style={[styles.summaryTitle, { color: themeColors.text }]}>Community Rating Summary</Text>

            <View style={styles.summaryRow}>
              <View style={styles.scoreBlock}>
                <Text style={[styles.scoreBig, { color: themeColors.text }]}>{ratingSummary.averageRating}</Text>
                <View style={styles.starsMini}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={12}
                      color="#f59e0b"
                      fill={Math.round(ratingSummary.averageRating) >= s ? '#f59e0b' : 'transparent'}
                    />
                  ))}
                </View>
                <Text style={styles.totalReviewsText}>
                  {ratingSummary.totalReviews} verified rating{ratingSummary.totalReviews > 1 ? 's' : ''}
                </Text>
              </View>

              <View style={styles.barsBlock}>
                {[5, 4, 3, 2, 1].map((num) => {
                  const count = (ratingSummary.distribution as any)[num.toString()] || 0
                  const pct =
                    ratingSummary.totalReviews > 0
                      ? Math.round((count / ratingSummary.totalReviews) * 100)
                      : 0

                  return (
                    <View key={num} style={styles.barLine}>
                      <Text style={styles.barNum}>{num}</Text>
                      <View style={[styles.barTrack, { backgroundColor: isDark ? '#27272a' : '#e2e8f0' }]}>
                        <View style={[styles.barFill, { width: `${pct}%` }]} />
                      </View>
                      <Text style={styles.barCount}>{count}</Text>
                    </View>
                  )
                })}
              </View>
            </View>
          </View>
        )}
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
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  promptTitle: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  promptSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 6,
  },
  starTouch: {
    padding: 4,
  },
  ratingCountLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#d97706',
    textAlign: 'center',
  },
  followUpBox: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  followUpTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  followUpDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  formGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    fontSize: 13,
    textAlignVertical: 'top',
    minHeight: 90,
  },
  charCount: {
    fontSize: 10,
    color: colors.gray400,
    textAlign: 'right',
  },
  anonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  anonTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  anonTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  anonDesc: {
    fontSize: 10,
    marginTop: 2,
    lineHeight: 14,
  },
  submitBtn: {
    backgroundColor: '#d97706',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  storeCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  storeTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  storeText: {
    fontSize: 11,
    lineHeight: 16,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  scoreBlock: {
    alignItems: 'center',
    minWidth: 80,
  },
  scoreBig: {
    fontSize: 32,
    fontWeight: '800',
  },
  starsMini: {
    flexDirection: 'row',
    gap: 2,
    marginVertical: 4,
  },
  totalReviewsText: {
    fontSize: 9,
    color: colors.gray400,
  },
  barsBlock: {
    flex: 1,
    gap: 4,
  },
  barLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  barNum: {
    fontSize: 10,
    width: 10,
    color: colors.gray500,
    textAlign: 'right',
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#f59e0b',
    borderRadius: 3,
  },
  barCount: {
    fontSize: 9,
    width: 18,
    color: colors.gray400,
    textAlign: 'right',
  },
})
