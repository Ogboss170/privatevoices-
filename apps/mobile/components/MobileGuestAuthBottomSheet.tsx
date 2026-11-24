import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Heart, MessageCircle, X, Sparkles, ArrowRight, Eye, EyeOff } from 'lucide-react-native'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'
import { useTheme } from '../context/ThemeContext'

interface MobileGuestAuthBottomSheetProps {
  visible: boolean
  onClose: () => void
  actionTitle?: string
  actionDescription?: string
}

export function MobileGuestAuthBottomSheet({
  visible,
  onClose,
  actionTitle = 'Join the conversation',
  actionDescription = 'Sign in or create an account to like, comment, and connect on Private Voices.',
}: MobileGuestAuthBottomSheetProps) {
  const router = useRouter()
  const { colors: themeColors, isDark } = useTheme()

  const [mode, setMode] = useState<'options' | 'quick-login' | 'quick-signup'>('options')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  function resetState() {
    setMode('options')
    setEmail('')
    setPassword('')
    setUsername('')
    setLoading(false)
    setShowPassword(false)
  }

  function handleClose() {
    resetState()
    onClose()
  }

  async function handleQuickLogin() {
    if (!email || !password) {
      Alert.alert('Missing info', 'Please enter your email and password.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setLoading(false)

    if (error) {
      Alert.alert('Sign In Failed', error.message)
    } else {
      handleClose()
    }
  }

  async function handleQuickSignup() {
    if (!email || !password) {
      Alert.alert('Missing info', 'Please enter your email and password.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          username: username.trim() || undefined,
          display_name: username.trim() || undefined,
        },
      },
    })
    setLoading(false)

    if (error) {
      Alert.alert('Sign Up Failed', error.message)
    } else {
      Alert.alert('Account Created!', 'Welcome to Private Voices.')
      handleClose()
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={[
                styles.sheet,
                { backgroundColor: isDark ? '#111827' : '#ffffff' },
              ]}
            >
              {/* Drag Indicator */}
              <View style={styles.dragIndicator} />

              {/* Close Button */}
              <TouchableOpacity
                onPress={handleClose}
                style={[
                  styles.closeButton,
                  { backgroundColor: isDark ? '#1f2937' : '#f3f4f6' },
                ]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={18} color={isDark ? '#9ca3af' : '#6b7280'} />
              </TouchableOpacity>

              {mode === 'options' ? (
                <View style={styles.content}>
                  {/* Visual Header */}
                  <View style={styles.iconCircle}>
                    <Sparkles size={24} color="#ffffff" />
                  </View>

                  <Text
                    style={[
                      styles.title,
                      { color: isDark ? '#f9fafb' : '#111827' },
                    ]}
                  >
                    {actionTitle}
                  </Text>
                  <Text
                    style={[
                      styles.description,
                      { color: isDark ? '#9ca3af' : '#4b5563' },
                    ]}
                  >
                    {actionDescription}
                  </Text>

                  {/* Highlights Grid */}
                  <View style={styles.featuresRow}>
                    <View
                      style={[
                        styles.featureBox,
                        {
                          backgroundColor: isDark ? '#1f2937' : '#f9fafb',
                          borderColor: isDark ? '#374151' : '#f3f4f6',
                        },
                      ]}
                    >
                      <Heart size={18} color="#ef4444" style={styles.featureIcon} />
                      <Text
                        style={[
                          styles.featureTitle,
                          { color: isDark ? '#f3f4f6' : '#1f2937' },
                        ]}
                      >
                        Like & React
                      </Text>
                      <Text style={styles.featureSub}>Support voices</Text>
                    </View>

                    <View
                      style={[
                        styles.featureBox,
                        {
                          backgroundColor: isDark ? '#1f2937' : '#f9fafb',
                          borderColor: isDark ? '#374151' : '#f3f4f6',
                        },
                      ]}
                    >
                      <MessageCircle size={18} color={colors.brand} style={styles.featureIcon} />
                      <Text
                        style={[
                          styles.featureTitle,
                          { color: isDark ? '#f3f4f6' : '#1f2937' },
                        ]}
                      >
                        Comment
                      </Text>
                      <Text style={styles.featureSub}>Share thoughts</Text>
                    </View>
                  </View>

                  {/* Quick Action Buttons */}
                  <View style={styles.actions}>
                    <TouchableOpacity
                      onPress={() => setMode('quick-signup')}
                      style={styles.primaryButton}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.primaryButtonText}>Create Account</Text>
                      <ArrowRight size={16} color="#ffffff" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setMode('quick-login')}
                      style={[
                        styles.secondaryButton,
                        {
                          backgroundColor: isDark ? '#1f2937' : '#f3f4f6',
                        },
                      ]}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.secondaryButtonText,
                          { color: isDark ? '#f9fafb' : '#111827' },
                        ]}
                      >
                        Log In
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.content}>
                  <Text
                    style={[
                      styles.title,
                      { color: isDark ? '#f9fafb' : '#111827' },
                    ]}
                  >
                    {mode === 'quick-login' ? 'Welcome Back' : 'Create an Account'}
                  </Text>
                  <Text
                    style={[
                      styles.description,
                      { color: isDark ? '#9ca3af' : '#4b5563' },
                    ]}
                  >
                    {mode === 'quick-login'
                      ? 'Sign in to continue where you left off.'
                      : 'Join the community in seconds.'}
                  </Text>

                  <View style={styles.form}>
                    {mode === 'quick-signup' && (
                      <TextInput
                        style={[
                          styles.input,
                          {
                            backgroundColor: isDark ? '#1f2937' : '#f9fafb',
                            color: isDark ? '#ffffff' : '#111827',
                            borderColor: isDark ? '#374151' : '#e5e7eb',
                          },
                        ]}
                        placeholder="Username (optional)"
                        placeholderTextColor="#9ca3af"
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                      />
                    )}

                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: isDark ? '#1f2937' : '#f9fafb',
                          color: isDark ? '#ffffff' : '#111827',
                          borderColor: isDark ? '#374151' : '#e5e7eb',
                        },
                      ]}
                      placeholder="Email address"
                      placeholderTextColor="#9ca3af"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />

                    <View style={styles.passwordContainer}>
                      <TextInput
                        style={[
                          styles.input,
                          styles.passwordInput,
                          {
                            backgroundColor: isDark ? '#1f2937' : '#f9fafb',
                            color: isDark ? '#ffffff' : '#111827',
                            borderColor: isDark ? '#374151' : '#e5e7eb',
                          },
                        ]}
                        placeholder="Password"
                        placeholderTextColor="#9ca3af"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        style={styles.eyeIcon}
                      >
                        {showPassword ? (
                          <EyeOff size={18} color="#9ca3af" />
                        ) : (
                          <Eye size={18} color="#9ca3af" />
                        )}
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      onPress={
                        mode === 'quick-login' ? handleQuickLogin : handleQuickSignup
                      }
                      disabled={loading}
                      style={styles.primaryButton}
                      activeOpacity={0.85}
                    >
                      {loading ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                      ) : (
                        <Text style={styles.primaryButtonText}>
                          {mode === 'quick-login' ? 'Sign In' : 'Sign Up'}
                        </Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() =>
                        setMode(mode === 'quick-login' ? 'quick-signup' : 'quick-login')
                      }
                      style={styles.switchModeButton}
                    >
                      <Text
                        style={[
                          styles.switchModeText,
                          { color: isDark ? '#9ca3af' : '#6b7280' },
                        ]}
                      >
                        {mode === 'quick-login'
                          ? "Don't have an account? "
                          : 'Already have an account? '}
                        <Text style={{ color: colors.brand, fontWeight: '700' }}>
                          {mode === 'quick-login' ? 'Sign Up' : 'Log In'}
                        </Text>
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d1d5db',
    alignSelf: 'center',
    marginBottom: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  content: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  featuresRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
    width: '100%',
  },
  featureBox: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  featureIcon: {
    marginBottom: 4,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  featureSub: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  actions: {
    width: '100%',
    gap: 10,
  },
  primaryButton: {
    backgroundColor: colors.brand,
    paddingVertical: 14,
    borderRadius: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 13,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  form: {
    width: '100%',
    gap: 12,
    marginTop: 6,
  },
  input: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 14,
  },
  passwordContainer: {
    position: 'relative',
    width: '100%',
  },
  passwordInput: {
    paddingRight: 44,
  },
  eyeIcon: {
    position: 'absolute',
    right: 14,
    top: 14,
  },
  switchModeButton: {
    marginTop: 4,
    alignItems: 'center',
    paddingVertical: 6,
  },
  switchModeText: {
    fontSize: 13,
  },
})
