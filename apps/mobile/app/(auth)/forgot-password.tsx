import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { ArrowLeft, Mail, CheckCircle2 } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { colors } from '../../constants/colors'
import { useTheme } from '../../context/ThemeContext'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { colors: themeColors, isDark } = useTheme()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSendReset() {
    if (!email.trim() || loading) return

    setLoading(true)

    try {
      // Supabase mobile redirect scheme
      const redirectTo = 'privatevoices://reset-password'

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      })

      // Security requirement: Never reveal whether an email is registered or not
      if (error) {
        console.error('Password reset request error:', error)
      }

      setSubmitted(true)
    } catch (err) {
      console.error('Reset password error:', err)
      setSubmitted(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back Button */}
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: themeColors.surfaceBorder }]}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={20} color={themeColors.text} />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={[styles.title, { color: themeColors.text }]}>Forgot Password?</Text>
          <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
            Enter the email associated with your account and we'll send you a secure link to reset your password.
          </Text>
        </View>

        {submitted ? (
          <View style={[styles.successCard, { backgroundColor: isDark ? '#143325' : '#ecfdf5', borderColor: isDark ? '#1e5e3a' : '#a7f3d0' }]}>
            <View style={styles.successIconCircle}>
              <CheckCircle2 size={32} color="#059669" />
            </View>
            <Text style={[styles.successTitle, { color: isDark ? '#6ee7b7' : '#065f46' }]}>Check your email</Text>
            <Text style={[styles.successDesc, { color: isDark ? '#a7f3d0' : '#047857' }]}>
              If an account matches <Text style={{ fontWeight: '700' }}>{email}</Text>, a password recovery link has been sent. Follow the instructions in the email to set a new password.
            </Text>
            <Text style={[styles.securityNotice, { color: isDark ? '#6ee7b7' : '#065f46' }]}>
              Reset links are single-use and expire quickly for your protection.
            </Text>

            <TouchableOpacity
              style={styles.returnBtn}
              onPress={() => router.replace('/(auth)/login')}
              activeOpacity={0.8}
            >
              <Text style={styles.returnBtnText}>Return to Sign In</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => {
                setSubmitted(false)
                setEmail('')
              }}
            >
              <Text style={[styles.retryText, { color: themeColors.textSecondary }]}>Try another email</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={[styles.label, { color: themeColors.text }]}>Email Address</Text>
            <View style={[styles.inputWrapper, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
              <Mail size={18} color={themeColors.textSecondary} style={{ marginRight: 10 }} />
              <TextInput
                style={[styles.input, { color: themeColors.text }]}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={themeColors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoFocus
              />
            </View>

            <TouchableOpacity
              style={[
                styles.submitBtn,
                (!email.trim() || loading) && styles.submitBtnDisabled,
              ]}
              onPress={handleSendReset}
              disabled={!email.trim() || loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitBtnText}>Send Reset Link</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  form: {
    gap: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
  },
  submitBtn: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  successCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  successIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  successDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  securityNotice: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.9,
  },
  returnBtn: {
    backgroundColor: colors.brand,
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  returnBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  retryBtn: {
    paddingVertical: 6,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '600',
  },
})
