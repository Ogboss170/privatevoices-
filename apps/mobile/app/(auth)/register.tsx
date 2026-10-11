import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { Link, useRouter, useLocalSearchParams } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { colors } from '../../constants/colors'
import { Phone, Mail, Check, Shield } from 'lucide-react-native'

export default function RegisterScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ ref?: string }>()
  const refInviter = params.ref ? String(params.ref).trim().toLowerCase().replace(/^@/, '') : ''

  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [hasConsented, setHasConsented] = useState(false)

  // Verification code states
  const [emailOtp, setEmailOtp] = useState('')
  const [phoneOtp, setPhoneOtp] = useState('')
  const [emailCodeSent, setEmailCodeSent] = useState(false)
  const [phoneCodeSent, setPhoneCodeSent] = useState(false)
  const [isEmailVerified, setIsEmailVerified] = useState(false)
  const [isPhoneVerified, setIsPhoneVerified] = useState(false)
  const [sendingCode, setSendingCode] = useState<'email' | 'phone' | null>(null)
  const [verifyingCode, setVerifyingCode] = useState<'email' | 'phone' | null>(null)

  // Live availability states
  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean
    available?: boolean
    message?: string
  }>({ checking: false })

  const [emailStatus, setEmailStatus] = useState<{
    checking: boolean
    available?: boolean
    message?: string
  }>({ checking: false })

  const [loading, setLoading] = useState(false)

  // Step 2: Verification step after sign up
  const [verificationStep, setVerificationStep] = useState(false)
  const [signupEmail, setSignupEmail] = useState('')
  const [signupOtp, setSignupOtp] = useState('')
  const [verifyingOtp, setVerifyingOtp] = useState(false)

  async function handleVerifyMobileOtp() {
    if (!signupOtp || signupOtp.trim().length < 6) {
      Alert.alert('Required', 'Please enter the 6-digit verification code.')
      return
    }

    setVerifyingOtp(true)
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: signupEmail,
        token: signupOtp.trim(),
        type: 'signup',
      })

      if (error) {
        const { error: fallbackError } = await supabase.auth.verifyOtp({
          email: signupEmail,
          token: signupOtp.trim(),
          type: 'email',
        })
        if (fallbackError) {
          Alert.alert('Verification Failed', error.message || fallbackError.message)
          setVerifyingOtp(false)
          return
        }
      }

      Alert.alert('Success', 'Your account has been verified!', [
        { text: 'Continue', onPress: () => router.replace('/(tabs)' as any) }
      ])
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to verify code.')
    } finally {
      setVerifyingOtp(false)
    }
  }

  async function handleResendMobileOtp() {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: signupEmail,
      })
      if (error) {
        Alert.alert('Resend Failed', error.message)
      } else {
        Alert.alert('Sent', 'A new verification code was sent to your email.')
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not resend code.')
    }
  }

  // Realtime username check
  React.useEffect(() => {
    const rawUsername = username.trim().toLowerCase()
    if (!rawUsername) {
      setUsernameStatus({ checking: false })
      return
    }
    if (rawUsername.length < 3) {
      setUsernameStatus({ checking: false, available: false, message: 'Must be at least 3 characters' })
      return
    }

    setUsernameStatus({ checking: true })
    const timer = setTimeout(async () => {
      try {
        const { data } = await supabase.rpc('check_username_available', { p_username: rawUsername })
        if (data) {
          setUsernameStatus({ checking: false, available: data.available, message: data.message })
          return
        }
        const { data: profile } = await supabase.from('profiles').select('id').ilike('username', rawUsername).maybeSingle()
        setUsernameStatus({
          checking: false,
          available: !profile,
          message: profile ? `Username @${rawUsername} is already taken.` : 'Username is available!',
        })
      } catch {
        setUsernameStatus({ checking: false })
      }
    }, 350)

    return () => clearTimeout(timer)
  }, [username])

  // Realtime email check
  React.useEffect(() => {
    const rawEmail = email.trim().toLowerCase()
    if (!rawEmail || !rawEmail.includes('@') || !rawEmail.includes('.')) {
      setEmailStatus({ checking: false })
      return
    }

    setEmailStatus({ checking: true })
    const timer = setTimeout(async () => {
      try {
        const { data } = await supabase.rpc('check_email_available', { p_email: rawEmail })
        if (data) {
          setEmailStatus({ checking: false, available: data.available, message: data.message })
          return
        }
        const { data: reg } = await supabase.from('email_registry').select('id').eq('normalized_email', rawEmail).maybeSingle()
        setEmailStatus({
          checking: false,
          available: !reg,
          message: reg ? 'This email has already been used.' : 'Email is available!',
        })
      } catch {
        setEmailStatus({ checking: false })
      }
    }, 450)

    return () => clearTimeout(timer)
  }, [email])

  // Realtime phone automatic code generation
  React.useEffect(() => {
    const rawPhone = phone.trim().replace(/[^0-9+]/g, '')
    if (rawPhone.length >= 10 && !phoneCodeSent && !isPhoneVerified) {
      const timer = setTimeout(() => {
        handleSendVerificationCode('phone')
      }, 700)
      return () => clearTimeout(timer)
    }
  }, [phone, phoneCodeSent, isPhoneVerified])

  async function handleSendVerificationCode(targetType: 'email' | 'phone') {
    const targetValue = targetType === 'email' ? email.trim() : phone.trim()
    if (!targetValue) {
      Alert.alert('Required', `Please enter your ${targetType} address first.`)
      return
    }

    setSendingCode(targetType)
    try {
      const { data, error } = await supabase.rpc('request_verification_code', {
        p_target_type: targetType,
        p_target_value: targetValue,
      })

      if (error) {
        Alert.alert('Error', error.message)
      } else if (data?.success) {
        if (targetType === 'email') {
          setEmailCodeSent(true)
          if (data?.dev_code) setEmailOtp(data.dev_code)
        }
        if (targetType === 'phone') {
          setPhoneCodeSent(true)
          if (data?.dev_code) setPhoneOtp(data.dev_code)
        }
        Alert.alert(
          'Verification Code',
          `Your 6-digit code for ${targetValue} is: ${data?.dev_code || 'Sent via email/SMS'}.\n\nIt has been automatically filled in for you.`
        )
      } else {
        Alert.alert('Notice', data?.message || 'Could not send verification code.')
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to request verification code.')
    } finally {
      setSendingCode(null)
    }
  }

  async function handleConfirmVerificationCode(targetType: 'email' | 'phone') {
    const targetValue = targetType === 'email' ? email.trim() : phone.trim()
    const code = targetType === 'email' ? emailOtp.trim() : phoneOtp.trim()

    if (!code || code.length < 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit verification code.')
      return
    }

    setVerifyingCode(targetType)
    try {
      const { data, error } = await supabase.rpc('confirm_verification_code', {
        p_target_type: targetType,
        p_target_value: targetValue,
        p_code: code,
      })

      if (error) {
        Alert.alert('Verification Failed', error.message)
      } else if (data?.success) {
        if (targetType === 'email') setIsEmailVerified(true)
        if (targetType === 'phone') setIsPhoneVerified(true)
        Alert.alert('Verified', `${targetType === 'email' ? 'Email' : 'Phone'} verified successfully!`)
      } else {
        Alert.alert('Error', data?.message || 'Invalid verification code.')
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to confirm code.')
    } finally {
      setVerifyingCode(null)
    }
  }

  async function handleRegister() {
    if (!hasConsented) {
      Alert.alert('Terms Required', 'Please accept the Terms & Conditions and Privacy Policy.')
      return
    }
    if (!email || !password || !username || !displayName) {
      Alert.alert('Incomplete Form', 'Please fill in all required fields.')
      return
    }

    setLoading(true)
    const normEmail = email.trim().toLowerCase()
    const normUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    const acceptedAt = new Date().toISOString()

    try {
      // 1. Sign up Supabase auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normEmail,
        password,
        options: {
          data: {
            username: normUsername,
            display_name: displayName.trim(),
            accepted_terms: true,
            accepted_terms_at: acceptedAt,
          },
        },
      })

      if (signUpError) {
        Alert.alert('Sign up failed', signUpError.message)
        setLoading(false)
        return
      }

      if (!data.user) {
        Alert.alert('Error', 'Could not create account.')
        setLoading(false)
        return
      }

      // 2. Create profile
      await supabase.rpc('create_profile', {
        p_user_id: data.user.id,
        p_username: normUsername,
        p_display_name: displayName.trim(),
        p_accepted_terms: true,
        p_accepted_terms_at: acceptedAt,
        p_email: normEmail,
      })

      // 3. Update phone and verification flags
      if (phone.trim()) {
        await supabase
          .from('profiles')
          .update({
            phone: phone.trim(),
            is_phone_verified: isPhoneVerified,
            is_email_verified: isEmailVerified,
            phone_verified_at: isPhoneVerified ? new Date().toISOString() : null,
            email_verified_at: isEmailVerified ? new Date().toISOString() : null,
          })
          .eq('id', data.user.id)
      }

      // 4. Process referral if joined via invite link
      if (refInviter) {
        try {
          await supabase.rpc('process_referral', {
            p_new_user_id: data.user.id,
            p_inviter_username: refInviter,
          })
        } catch (refErr) {
          console.warn('Referral attribution notice:', refErr)
        }
      }

      // If email verification is required and session is null
      if (!data.session) {
        setSignupEmail(normEmail)
        setVerificationStep(true)
        Alert.alert(
          'Check Your Email',
          `We sent a 6-digit confirmation code to ${normEmail}. Please enter it to complete registration.`
        )
        return
      }

      Alert.alert(
        'Account Created',
        'Your Private Voices account is ready!',
        [{ text: 'Continue', onPress: () => router.replace('/(tabs)' as any) }]
      )
    } catch (err: any) {
      Alert.alert('Registration Error', err?.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  if (verificationStep) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12 }}>
              <Mail size={28} color="#4f46e5" />
            </View>
            <Text style={styles.title}>Check your inbox</Text>
            <Text style={[styles.subtitle, { textAlign: 'center', marginTop: 4 }]}>
              Enter the 6-digit verification code sent to{'\n'}
              <Text style={{ fontWeight: '700', color: '#111827' }}>{signupEmail}</Text>
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={[styles.label, { textAlign: 'center' }]}>6-Digit Verification Code</Text>
            <TextInput
              style={[
                styles.input,
                { textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: '700', color: '#4f46e5' }
              ]}
              value={signupOtp}
              onChangeText={(t) => setSignupOtp(t.replace(/\D/g, ''))}
              placeholder="123456"
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />

            <TouchableOpacity
              style={[styles.button, (verifyingOtp || signupOtp.length < 6) && styles.buttonDisabled]}
              onPress={handleVerifyMobileOtp}
              disabled={verifyingOtp || signupOtp.length < 6}
            >
              {verifyingOtp ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verify and Continue</Text>
              )}
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
              <TouchableOpacity onPress={() => setVerificationStep(false)}>
                <Text style={{ fontSize: 13, color: '#6b7280' }}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleResendMobileOtp}>
                <Text style={{ fontSize: 13, color: '#4f46e5', fontWeight: '600' }}>Resend code</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Join Private Voices</Text>
          <Text style={styles.subtitle}>Speak freely. Stay private.</Text>
        </View>

        {/* Inputs */}
        <View style={styles.form}>
          <Text style={styles.label}>Display Name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Oghosa"
            placeholderTextColor="#9ca3af"
          />

          <Text style={styles.label}>Username</Text>
          <TextInput
            style={[
              styles.input,
              usernameStatus.available === false && styles.inputError,
              usernameStatus.available === true && styles.inputSuccess,
            ]}
            value={username}
            onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            placeholder="oghosa"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
          />
          {usernameStatus.message && (
            <Text
              style={[
                styles.helperText,
                usernameStatus.available ? styles.helperSuccess : styles.helperError,
              ]}
            >
              {usernameStatus.message}
            </Text>
          )}

          {/* Email */}
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[
              styles.input,
              emailStatus.available === false && styles.inputError,
              emailStatus.available === true && styles.inputSuccess,
            ]}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#9ca3af"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {emailStatus.message && (
            <Text
              style={[
                styles.helperText,
                emailStatus.available ? styles.helperSuccess : styles.helperError,
              ]}
            >
              {emailStatus.message}
            </Text>
          )}

          {/* Phone with OTP */}
          <View style={styles.labelRow}>
            <Text style={styles.label}>Phone Number (Optional)</Text>
            {isPhoneVerified ? (
              <View style={styles.verifiedBadge}>
                <Check size={12} color="#059669" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            ) : (
              phone.trim().length > 0 && (
                <TouchableOpacity
                  onPress={() => handleSendVerificationCode('phone')}
                  disabled={sendingCode === 'phone'}
                >
                  <Text style={[styles.actionLink, sendingCode === 'phone' && styles.disabledText]}>
                    {sendingCode === 'phone' ? 'Sending SMS...' : 'Send SMS code'}
                  </Text>
                </TouchableOpacity>
              )
            )}
          </View>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+1 (555) 000-0000"
            placeholderTextColor="#9ca3af"
            keyboardType="phone-pad"
          />

          {phoneCodeSent && !isPhoneVerified && (
            <View style={styles.otpRow}>
              <TextInput
                style={[styles.input, styles.otpInput]}
                value={phoneOtp}
                onChangeText={(t) => setPhoneOtp(t.replace(/\D/g, ''))}
                placeholder="6-digit code"
                placeholderTextColor="#9ca3af"
                keyboardType="number-pad"
                maxLength={6}
              />
              <TouchableOpacity
                style={styles.verifyBtn}
                onPress={() => handleConfirmVerificationCode('phone')}
                disabled={verifyingCode === 'phone' || phoneOtp.length < 6}
              >
                <Text style={styles.verifyBtnText}>
                  {verifyingCode === 'phone' ? 'Verifying...' : 'Verify'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="•••••••• (Min 8 characters)"
            placeholderTextColor="#9ca3af"
            secureTextEntry
          />

          {/* Consent */}
          <TouchableOpacity
            style={styles.consentRow}
            onPress={() => setHasConsented(!hasConsented)}
          >
            <View style={[styles.checkbox, hasConsented && styles.checkboxActive]}>
              {hasConsented && <Check size={14} color="#fff" />}
            </View>
            <Text style={styles.consentText}>
              I agree to the Terms & Conditions and Privacy Policy.
            </Text>
          </TouchableOpacity>

          {/* Register Button */}
          <TouchableOpacity
            style={[styles.button, (!hasConsented || loading) && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={!hasConsented || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href={'/(auth)/login' as any}>
            <Text style={styles.link}>Sign in</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  scrollContent: { paddingHorizontal: 24, paddingVertical: 40, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 28 },
  title: { fontSize: 26, fontWeight: '800', color: '#111827', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  form: { gap: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  actionLink: { fontSize: 12, fontWeight: '600', color: colors.brand },
  disabledText: { color: '#9ca3af' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedText: { fontSize: 12, fontWeight: '700', color: '#059669' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    backgroundColor: '#fff',
    color: '#111827',
    marginBottom: 4,
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  inputSuccess: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  helperText: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: -2,
    paddingHorizontal: 2,
  },
  helperError: {
    color: '#dc2626',
  },
  helperSuccess: {
    color: '#059669',
  },
  otpRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  otpInput: { flex: 1, letterSpacing: 4, textAlign: 'center', fontWeight: '700' },
  verifyBtn: {
    backgroundColor: colors.brand,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    marginBottom: 8,
  },
  verifyBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  consentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 10 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#9ca3af',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  consentText: { fontSize: 13, color: '#4b5563', flex: 1 },
  button: {
    backgroundColor: colors.brand,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: '#6b7280', fontSize: 14 },
  link: { color: colors.brand, fontWeight: '600', fontSize: 14 },
})
