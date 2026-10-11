'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Check, X, Phone, Mail, ShieldCheck, Loader2 } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createSupabaseBrowserClient()

  // Track referring inviter username (from URL /register?ref=username or sessionStorage)
  const [refInviter, setRefInviter] = useState<string>('')

  useEffect(() => {
    const refFromUrl = searchParams.get('ref')
    if (refFromUrl) {
      const cleanRef = refFromUrl.trim().toLowerCase().replace(/^@/, '')
      setRefInviter(cleanRef)
      try {
        sessionStorage.setItem('pv_referred_by', cleanRef)
      } catch {}
    } else {
      try {
        const stored = sessionStorage.getItem('pv_referred_by')
        if (stored) setRefInviter(stored)
      } catch {}
    }
  }, [searchParams])

  const [form, setForm] = useState({
    email: '',
    phone: '',
    password: '',
    username: '',
    displayName: '',
  })

  // Real-time immediate availability check states
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

  const usernameTimerRef = useRef<NodeJS.Timeout | null>(null)
  const emailTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Verification code states
  const [phoneOtp, setPhoneOtp] = useState('')
  const [emailOtp, setEmailOtp] = useState('')
  const [phoneCodeSent, setPhoneCodeSent] = useState(false)
  const [emailCodeSent, setEmailCodeSent] = useState(false)
  const [isPhoneVerified, setIsPhoneVerified] = useState(false)
  const [isEmailVerified, setIsEmailVerified] = useState(false)
  const [sendingCode, setSendingCode] = useState<'phone' | 'email' | null>(null)
  const [verifyingCode, setVerifyingCode] = useState<'phone' | 'email' | null>(null)
  const [codeFeedback, setCodeFeedback] = useState<string | null>(null)
  
  // Consent Checkbox state — starts UNCHECKED
  const [hasConsented, setHasConsented] = useState(false)

  // Modal state for Terms & Privacy
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Live Check: Username Availability
  useEffect(() => {
    const rawUsername = form.username.trim().toLowerCase()
    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current)

    if (!rawUsername) {
      setUsernameStatus({ checking: false })
      return
    }

    if (rawUsername.length < 3) {
      setUsernameStatus({
        checking: false,
        available: false,
        message: 'Username must be at least 3 characters',
      })
      return
    }

    setUsernameStatus({ checking: true })

    usernameTimerRef.current = setTimeout(async () => {
      try {
        // Direct RPC check
        const { data, error: rpcErr } = await supabase.rpc('check_username_available', {
          p_username: rawUsername,
        })

        if (!rpcErr && data) {
          setUsernameStatus({
            checking: false,
            available: data.available,
            message: data.message,
          })
          return
        }

        // Fallback: check profiles table directly
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .ilike('username', rawUsername)
          .maybeSingle()

        if (existingProfile) {
          setUsernameStatus({
            checking: false,
            available: false,
            message: `This username @${rawUsername} has already been taken.`,
          })
        } else {
          setUsernameStatus({
            checking: false,
            available: true,
            message: 'Username is available!',
          })
        }
      } catch {
        setUsernameStatus({ checking: false })
      }
    }, 350)

    return () => {
      if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current)
    }
  }, [form.username, supabase])

  // Auto-generation trigger refs to avoid duplicate dispatches
  const autoEmailTriggeredRef = useRef<string | null>(null)
  const autoPhoneTriggeredRef = useRef<string | null>(null)

  // Live Check & Automatic Code Generator for Email
  useEffect(() => {
    const rawEmail = form.email.trim().toLowerCase()
    if (emailTimerRef.current) clearTimeout(emailTimerRef.current)

    if (!rawEmail || !rawEmail.includes('@') || !rawEmail.includes('.')) {
      setEmailStatus({ checking: false })
      return
    }

    setEmailStatus({ checking: true })

    emailTimerRef.current = setTimeout(async () => {
      try {
        const { data, error: rpcErr } = await supabase.rpc('check_email_available', {
          p_email: rawEmail,
        })

        if (!rpcErr && data) {
          setEmailStatus({
            checking: false,
            available: data.available,
            message: data.message,
          })

          // Automatic code generation if email is available and hasn't been triggered yet
          if (data.available && autoEmailTriggeredRef.current !== rawEmail && !isEmailVerified) {
            autoEmailTriggeredRef.current = rawEmail
            handleSendVerificationCode('email')
          }
          return
        }

        const { data: existingReg } = await supabase
          .from('email_registry')
          .select('id')
          .eq('normalized_email', rawEmail)
          .maybeSingle()

        if (existingReg) {
          setEmailStatus({
            checking: false,
            available: false,
            message: 'This email has already been used.',
          })
        } else {
          setEmailStatus({
            checking: false,
            available: true,
            message: 'Email is available!',
          })

          // Automatic code generation
          if (autoEmailTriggeredRef.current !== rawEmail && !isEmailVerified) {
            autoEmailTriggeredRef.current = rawEmail
            handleSendVerificationCode('email')
          }
        }
      } catch {
        setEmailStatus({ checking: false })
      }
    }, 450)

    return () => {
      if (emailTimerRef.current) clearTimeout(emailTimerRef.current)
    }
  }, [form.email, isEmailVerified, supabase])

  // Automatic Code Generator for Phone (triggers automatically when 10+ digits are typed)
  useEffect(() => {
    const rawPhone = form.phone.trim().replace(/[^0-9+]/g, '')
    if (rawPhone.length >= 10 && autoPhoneTriggeredRef.current !== rawPhone && !isPhoneVerified) {
      const timer = setTimeout(() => {
        autoPhoneTriggeredRef.current = rawPhone
        handleSendVerificationCode('phone')
      }, 700)
      return () => clearTimeout(timer)
    }
  }, [form.phone, isPhoneVerified])

  async function handleSendVerificationCode(targetType: 'phone' | 'email') {
    const targetValue = targetType === 'phone' ? form.phone.trim() : form.email.trim()
    if (!targetValue) {
      setError(`Please provide your ${targetType} first to receive a verification code.`)
      return
    }

    setError(null)
    setCodeFeedback(null)
    setSendingCode(targetType)

    try {
      // 1. Call verification code RPC to generate 6-digit code
      const res = await supabase.rpc('request_verification_code', {
        p_target_type: targetType,
        p_target_value: targetValue,
      })

      const resData = res.data as any
      const rpcError = res.error

      if (rpcError) {
        console.error('request_verification_code error:', rpcError)
        setError(rpcError.message || 'Could not generate verification code.')
      } else if (resData?.success) {
        if (targetType === 'phone') {
          setPhoneCodeSent(true)
          if (resData?.dev_code) setPhoneOtp(resData.dev_code)

          // Trigger Twilio SMS fallback dispatch
          fetch('/api/twilio/send-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              targetType: 'phone',
              targetValue,
              code: resData?.dev_code,
            }),
          }).catch((e) => console.warn('Twilio dispatch notice:', e))
        }
        if (targetType === 'email') {
          setEmailCodeSent(true)
          if (resData?.dev_code) {
            setEmailOtp(resData.dev_code)

            // Trigger Resend email delivery
            fetch('/api/email/send-code', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: targetValue,
                code: resData.dev_code,
              }),
            })
              .then((r) => r.json())
              .then((json) => {
                if (json.success) {
                  setCodeFeedback(`Verification code sent to ${targetValue}! Please check your email inbox (and spam folder).`)
                }
              })
              .catch((e) => console.warn('Resend email dispatch error:', e))
          }
        }

        const msg = resData?.dev_code
          ? `Verification code sent to ${targetValue}! (Code: ${resData.dev_code} auto-filled for testing, also sent to your inbox)`
          : `Verification code sent to ${targetValue}. Please check your inbox and spam folder.`
        setCodeFeedback(msg)
      } else {
        setError(resData?.message || 'Could not send verification code.')
      }
    } catch (err: any) {
      console.error('RPC call error:', err)
      setError(err?.message || 'Failed to request verification code.')
    } finally {
      setSendingCode(null)
    }
  }

  async function handleConfirmVerificationCode(targetType: 'phone' | 'email') {
    const targetValue = targetType === 'phone' ? form.phone.trim() : form.email.trim()
    const code = targetType === 'phone' ? phoneOtp.trim() : emailOtp.trim()

    if (!code || code.length < 6) {
      setError('Please enter the 6-digit verification code.')
      return
    }

    setError(null)
    setVerifyingCode(targetType)

    try {
      const { data, error: rpcError } = await supabase.rpc('confirm_verification_code', {
        p_target_type: targetType,
        p_target_value: targetValue,
        p_code: code,
      })

      if (rpcError) {
        setError(rpcError.message)
      } else if (data?.success) {
        if (targetType === 'phone') setIsPhoneVerified(true)
        if (targetType === 'email') setIsEmailVerified(true)
        setCodeFeedback(`${targetType === 'phone' ? 'Phone number' : 'Email'} verified successfully!`)
      } else {
        setError(data?.message || 'Invalid or expired verification code.')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to verify code.')
    } finally {
      setVerifyingCode(null)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    // Force username to lowercase and strip spaces
    setForm((prev) => ({
      ...prev,
      [name]: name === 'username' ? value.toLowerCase().replace(/\s/g, '') : value,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!hasConsented) {
      setError('You must accept the Terms & Conditions and Privacy Policy to proceed.')
      return
    }

    setError(null)
    setLoading(true)

    const acceptedAt = new Date().toISOString()
    const normEmail = form.email.trim().toLowerCase()
    const normUsername = form.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')

    // 0. Pre-check email & username availability via atomic RPC
    try {
      const { data: availData, error: availError } = await supabase.rpc('check_registration_availability', {
        p_email: normEmail,
        p_username: normUsername,
      })

      if (!availError && availData && !availData.available) {
        setError(availData.message || 'This email or username is already taken.')
        setLoading(false)
        return
      }
    } catch {
      // Continue if RPC unavailable
    }

    // 1. Create the Supabase Auth user with terms consent metadata
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: normEmail,
      password: form.password,
      options: {
        data: {
          username: normUsername,
          display_name: form.displayName.trim(),
          accepted_terms: true,
          accepted_terms_at: acceptedAt,
        },
      },
    })

    if (signUpError) {
      if (signUpError.message?.toLowerCase().includes('already registered')) {
        setError('This email address is already registered and cannot be used again.')
      } else {
        setError(signUpError.message)
      }
      setLoading(false)
      return
    }

    if (!data.user) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    // 2. Create the profile with permanent email registry and username history recorded
    let profileCreated = false

    if (process.env.NEXT_PUBLIC_API_URL) {
      try {
        const apiRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/complete-profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: data.user.id,
            username: normUsername,
            displayName: form.displayName.trim(),
            email: normEmail,
            acceptedTerms: true,
            acceptedTermsAt: acceptedAt,
          }),
        })

        if (apiRes.ok) {
          profileCreated = true
        } else {
          const errBody = await apiRes.json().catch(() => null)
          if (errBody?.message) {
            setError(errBody.message)
            setLoading(false)
            return
          }
        }
      } catch {
        // Fallback to direct RPC below
      }
    }

    if (!profileCreated) {
      // Fallback: create profile directly via atomic create_profile stored procedure
      const { error: rpcError } = await supabase.rpc('create_profile', {
        p_user_id: data.user.id,
        p_username: normUsername,
        p_display_name: form.displayName.trim(),
        p_accepted_terms: true,
        p_accepted_terms_at: acceptedAt,
        p_email: normEmail,
      })

      if (rpcError) {
        if (rpcError.message?.includes('already registered') || rpcError.message?.includes('already taken')) {
          setError(rpcError.message)
          setLoading(false)
          return
        }
        console.warn('Profile creation error:', rpcError)
      }
    }

    // 3. Save phone number and verification states if present
    if (form.phone.trim()) {
      await supabase
        .from('profiles')
        .update({
          phone: form.phone.trim(),
          is_phone_verified: isPhoneVerified,
          is_email_verified: isEmailVerified,
          phone_verified_at: isPhoneVerified ? new Date().toISOString() : null,
          email_verified_at: isEmailVerified ? new Date().toISOString() : null,
        })
        .eq('id', data.user.id)
    }

    // 4. Process referral attribution if joined via invite link
    if (refInviter) {
      try {
        await supabase.rpc('process_referral', {
          p_new_user_id: data.user.id,
          p_inviter_username: refInviter,
        })
        try {
          sessionStorage.removeItem('pv_referred_by')
        } catch {}
      } catch (refErr) {
        console.warn('Referral processing note:', refErr)
      }
    }

    // Check if session was granted or requires email verification
    if (!data.session) {
      setSuccessMessage('Account created! Please check your email to confirm your account before logging in.')
      setLoading(false)
      return
    }

    router.push('/feed')
    router.refresh()
  }

  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleGoogleSignUp() {
    setError(null)
    setGoogleLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/feed`,
        },
      })
      if (error) {
        setError(error.message)
        setGoogleLoading(false)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initiate Google sign-in')
      setGoogleLoading(false)
    }
  }

  return (
    <>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Create your account</h2>

      {/* Google OAuth Button */}
      <button
        type="button"
        onClick={handleGoogleSignUp}
        disabled={googleLoading || loading}
        className="w-full py-2.5 px-4 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-sm flex items-center justify-center gap-3 transition-colors shadow-xs disabled:opacity-50"
      >
        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span>{googleLoading ? 'Connecting to Google…' : 'Sign up with Google'}</span>
      </button>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-gray-400">or register with email</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1.5">
              Display name
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              required
              value={form.displayName}
              onChange={handleChange}
              className="input-field"
              placeholder="Oghosa"
            />
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1.5">
              Username
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
              <input
                id="username"
                name="username"
                type="text"
                required
                pattern="^[a-zA-Z0-9_]{3,30}$"
                title="3–30 characters: letters, numbers, underscores"
                value={form.username}
                onChange={handleChange}
                className={`input-field pl-7 ${
                  usernameStatus.available === false
                    ? 'border-red-400 focus:ring-red-500 bg-red-50/30'
                    : usernameStatus.available === true
                    ? 'border-emerald-400 focus:ring-emerald-500 bg-emerald-50/20'
                    : ''
                }`}
                placeholder="oghosa"
              />
              {usernameStatus.checking && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
              )}
            </div>
            {usernameStatus.message && (
              <p
                className={`text-[11px] mt-1 font-medium ${
                  usernameStatus.available ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {usernameStatus.message}
              </p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-gray-500" /> Email
            </span>
            {isEmailVerified ? (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Verified
              </span>
            ) : (
              <button
                type="button"
                onClick={() => handleSendVerificationCode('email')}
                disabled={sendingCode === 'email' || !form.email || emailStatus.available === false}
                className="text-xs font-medium text-brand-600 hover:text-brand-700 cursor-pointer disabled:text-gray-400"
              >
                {sendingCode === 'email' ? 'Sending code...' : 'Send verification code'}
              </button>
            )}
          </label>
          <div className="relative">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={handleChange}
              className={`input-field ${
                emailStatus.available === false
                  ? 'border-red-400 focus:ring-red-500 bg-red-50/30'
                  : emailStatus.available === true
                  ? 'border-emerald-400 focus:ring-emerald-500 bg-emerald-50/20'
                  : ''
              }`}
              placeholder="you@example.com"
            />
            {emailStatus.checking && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
            )}
          </div>
          {emailStatus.message && (
            <p
              className={`text-[11px] mt-1 font-medium ${
                emailStatus.available ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {emailStatus.message}
            </p>
          )}

          {emailCodeSent && !isEmailVerified && (
            <div className="mt-2 p-3 bg-brand-50/60 border border-brand-200 rounded-xl flex items-center gap-2">
              <input
                type="text"
                maxLength={6}
                value={emailOtp}
                onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="6-digit email code"
                className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-mono tracking-widest flex-1 text-center"
              />
              <button
                type="button"
                onClick={() => handleConfirmVerificationCode('email')}
                disabled={verifyingCode === 'email' || emailOtp.length < 6}
                className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold disabled:bg-gray-300"
              >
                {verifyingCode === 'email' ? 'Verifying...' : 'Verify'}
              </button>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-gray-500" /> Phone number (optional)
            </span>
            {isPhoneVerified ? (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Verified
              </span>
            ) : (
              form.phone && (
                <button
                  type="button"
                  onClick={() => handleSendVerificationCode('phone')}
                  disabled={sendingCode === 'phone' || !form.phone}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700 cursor-pointer disabled:text-gray-400"
                >
                  {sendingCode === 'phone' ? 'Sending SMS...' : 'Send SMS code'}
                </button>
              )
            )}
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={handleChange}
            className="input-field"
            placeholder="+1 (555) 000-0000"
          />

          {phoneCodeSent && !isPhoneVerified && (
            <div className="mt-2 p-3 bg-brand-50/60 border border-brand-200 rounded-xl flex items-center gap-2">
              <input
                type="text"
                maxLength={6}
                value={phoneOtp}
                onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="6-digit SMS code"
                className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-mono tracking-widest flex-1 text-center"
              />
              <button
                type="button"
                onClick={() => handleConfirmVerificationCode('phone')}
                disabled={verifyingCode === 'phone' || phoneOtp.length < 6}
                className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold disabled:bg-gray-300"
              >
                {verifyingCode === 'phone' ? 'Verifying...' : 'Verify'}
              </button>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.password}
            onChange={handleChange}
            className="input-field"
            placeholder="At least 8 characters"
          />
        </div>

        {codeFeedback && (
          <p className="text-xs text-brand-700 bg-brand-50/80 border border-brand-200 rounded-lg px-3 py-2">
            {codeFeedback}
          </p>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {successMessage && (
          <div className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-1">
            <p className="font-semibold flex items-center gap-1.5 text-emerald-900">
              <Check className="w-4 h-4 text-emerald-600" /> Confirm your email address
            </p>
            <p>{successMessage}</p>
          </div>
        )}

        {/* Consent Checkbox */}
        <div className="pt-2">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={hasConsented}
              onChange={(e) => setHasConsented(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
            />
            <span className="text-xs text-gray-600 leading-normal">
              I agree to the{' '}
              <button
                type="button"
                onClick={() => setLegalModal('terms')}
                className="text-brand-600 hover:underline font-medium"
              >
                Terms & Conditions
              </button>{' '}
              and{' '}
              <button
                type="button"
                onClick={() => setLegalModal('privacy')}
                className="text-brand-600 hover:underline font-medium"
              >
                Privacy Policy
              </button>
              , and confirm that I meet the minimum age requirement to use Private Voices.
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={!hasConsented || loading}
          className={`w-full py-2.5 px-4 rounded-xl font-semibold text-sm transition-colors ${
            hasConsented && !loading
              ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {loading ? 'Creating account…' : 'Get Started'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>

      {/* Legal Content Modal */}
      {legalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl relative max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">
                {legalModal === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}
              </h3>
              <button
                onClick={() => setLegalModal(null)}
                className="p-1 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 overflow-y-auto space-y-3 text-sm text-gray-600 leading-relaxed flex-1">
              {legalModal === 'terms' ? (
                <>
                  <p className="font-semibold text-gray-900">Welcome to Private Voices.</p>
                  <p><strong>1. Acceptance of Terms:</strong> By creating an account or using Private Voices, you agree to comply with and be bound by these Terms & Conditions.</p>
                  <p><strong>2. Age Requirement:</strong> You confirm that you meet the minimum legal age requirement (at least 13 years old or age of consent in your jurisdiction) to access Private Voices.</p>
                  <p><strong>3. Privacy & One-Way Whispers:</strong> Anonymous Whispers are strictly one-way communications designed for safety. Harassment, hate speech, illegal activities, and spam are strictly prohibited.</p>
                  <p><strong>4. Account Responsibility:</strong> You are responsible for maintaining the confidentiality of your account credentials.</p>
                  <p><strong>5. Termination:</strong> Private Voices reserves the right to suspend or terminate accounts that violate platform standards.</p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-gray-900">Privacy Policy for Private Voices.</p>
                  <p><strong>1. Information We Collect:</strong> We collect basic account metadata (username, display name, email) and necessary device state to provide a secure private messaging experience.</p>
                  <p><strong>2. Anonymous Whispers:</strong> Whispers are routed confidentially without revealing sender identities to recipients.</p>
                  <p><strong>3. Data Security:</strong> Your data is protected using enterprise-grade encryption in transit and at rest with Supabase auth standards.</p>
                  <p><strong>4. Your Rights:</strong> You control your profile privacy settings, community visibility, and can request account or data deletion at any time in settings.</p>
                </>
              )}
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setLegalModal(null)}
                className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
