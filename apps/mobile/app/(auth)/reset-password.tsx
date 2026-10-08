import React, { useState, useMemo } from 'react'
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
  Alert,
} from 'react-native'
import { Eye, EyeOff, Lock, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { colors } from '../../constants/colors'
import { useTheme } from '../../context/ThemeContext'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function ResetPasswordScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { colors: themeColors, isDark } = useTheme()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Password strength calculation
  const strength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: '#e2e8f0' }
    let score = 0
    if (password.length >= 8) score += 1
    if (/[A-Z]/.test(password)) score += 1
    if (/[0-9]/.test(password)) score += 1
    if (/[^A-Za-z0-9]/.test(password)) score += 1

    if (score <= 1) return { score: 1, label: 'Weak', color: '#ef4444' }
    if (score === 2) return { score: 2, label: 'Fair', color: '#f59e0b' }
    if (score === 3) return { score: 3, label: 'Good', color: '#3b82f6' }
    return { score: 4, label: 'Strong', color: '#10b981' }
  }, [password])

  const meetsMinLength = password.length >= 8
  const hasUppercase = /[A-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const passwordsMatch = password.length > 0 && password === confirmPassword

  async function handleResetPassword() {
    setErrorMessage(null)

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please ensure both fields are identical.')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) {
        setErrorMessage(error.message || 'Failed to update password. Your recovery link may be expired.')
        setLoading(false)
        return
      }

      setSuccess(true)

      // Sign out from recovery session after successful reset
      setTimeout(async () => {
        await supabase.auth.signOut()
      }, 500)
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while updating your password.')
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
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: themeColors.surfaceBorder }]}
          onPress={() => router.replace('/(auth)/login')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={20} color={themeColors.text} />
        </TouchableOpacity>

        {success ? (
          <View style={[styles.successCard, { backgroundColor: isDark ? '#143325' : '#ecfdf5', borderColor: isDark ? '#1e5e3a' : '#a7f3d0' }]}>
            <View style={styles.successIconCircle}>
              <CheckCircle2 size={34} color="#059669" />
            </View>
            <Text style={[styles.successTitle, { color: isDark ? '#6ee7b7' : '#065f46' }]}>Password successfully changed!</Text>
            <Text style={[styles.successDesc, { color: isDark ? '#a7f3d0' : '#047857' }]}>
              Your Private Voices account password has been updated securely. You can now log in with your new credentials.
            </Text>

            <TouchableOpacity
              style={styles.loginBtn}
              onPress={() => router.replace('/(auth)/login')}
              activeOpacity={0.8}
            >
              <Text style={styles.loginBtnText}>Sign In Now</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: themeColors.text }]}>Reset Password</Text>
              <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
                Choose a strong new password with at least 8 characters.
              </Text>
            </View>

            {/* New Password Field */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: themeColors.text }]}>New Password</Text>
              <View style={[styles.inputWrapper, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
                <Lock size={18} color={themeColors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.input, { color: themeColors.text }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={themeColors.textSecondary}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoFocus
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {showPassword ? (
                    <EyeOff size={18} color={themeColors.textSecondary} />
                  ) : (
                    <Eye size={18} color={themeColors.textSecondary} />
                  )}
                </TouchableOpacity>
              </View>

              {/* Password Strength Indicator */}
              {password.length > 0 && (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthHeader}>
                    <Text style={[styles.strengthLabel, { color: themeColors.textSecondary }]}>Password strength:</Text>
                    <Text style={[styles.strengthValue, { color: strength.color }]}>{strength.label}</Text>
                  </View>
                  <View style={styles.strengthBarsRow}>
                    {[1, 2, 3, 4].map((step) => (
                      <View
                        key={step}
                        style={[
                          styles.strengthBar,
                          {
                            backgroundColor: strength.score >= step ? strength.color : themeColors.surfaceBorder,
                          },
                        ]}
                      />
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* Confirm New Password Field */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: themeColors.text }]}>Confirm New Password</Text>
              <View style={[styles.inputWrapper, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
                <Lock size={18} color={themeColors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.input, { color: themeColors.text }]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="••••••••"
                  placeholderTextColor={themeColors.textSecondary}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} color={themeColors.textSecondary} />
                  ) : (
                    <Eye size={18} color={themeColors.textSecondary} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Requirements Box */}
            <View style={[styles.requirementsCard, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
              <Text style={[styles.reqTitle, { color: themeColors.text }]}>Requirements:</Text>
              <Text style={[styles.reqItem, { color: meetsMinLength ? '#059669' : themeColors.textSecondary }]}>
                {meetsMinLength ? '✓' : '•'} At least 8 characters
              </Text>
              <Text style={[styles.reqItem, { color: hasUppercase ? '#059669' : themeColors.textSecondary }]}>
                {hasUppercase ? '✓' : '•'} At least one uppercase letter (A-Z)
              </Text>
              <Text style={[styles.reqItem, { color: hasNumber ? '#059669' : themeColors.textSecondary }]}>
                {hasNumber ? '✓' : '•'} At least one number (0-9)
              </Text>
              {confirmPassword.length > 0 && (
                <Text style={[styles.reqItem, { color: passwordsMatch ? '#059669' : '#ef4444' }]}>
                  {passwordsMatch ? '✓ Passwords match' : '✕ Passwords do not match'}
                </Text>
              )}
            </View>

            {errorMessage && (
              <View style={styles.errorBox}>
                <AlertCircle size={16} color="#ef4444" style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.submitBtn,
                (!meetsMinLength || !passwordsMatch || loading) && styles.submitBtnDisabled,
              ]}
              onPress={handleResetPassword}
              disabled={!meetsMinLength || !passwordsMatch || loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitBtnText}>Reset Password</Text>
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
    marginBottom: 20,
  },
  header: {
    marginBottom: 24,
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
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
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
  strengthContainer: {
    marginTop: 6,
    gap: 4,
  },
  strengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  strengthLabel: {
    fontSize: 11,
  },
  strengthValue: {
    fontSize: 11,
    fontWeight: '700',
  },
  strengthBarsRow: {
    flexDirection: 'row',
    gap: 4,
    height: 4,
  },
  strengthBar: {
    flex: 1,
    borderRadius: 2,
  },
  requirementsCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  reqTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  reqItem: {
    fontSize: 12,
    fontWeight: '500',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 12,
    flex: 1,
  },
  submitBtn: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
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
    marginTop: 20,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  successDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  loginBtn: {
    backgroundColor: colors.brand,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
})
