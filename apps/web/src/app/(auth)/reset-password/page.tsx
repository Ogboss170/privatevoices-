'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Lock, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const [verifyingSession, setVerifyingSession] = useState(true)
  const [sessionValid, setSessionValid] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Verify that an active recovery session exists or was established via hash fragment
  useEffect(() => {
    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (session) {
          setSessionValid(true)
          setVerifyingSession(false)
          return
        }

        // Check if there is an access_token in the URL hash (standard Supabase redirect format)
        if (typeof window !== 'undefined' && window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1))
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')

          if (accessToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            })

            if (!error) {
              setSessionValid(true)
              setVerifyingSession(false)
              return
            }
          }
        }

        // Listen for recovery event
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'PASSWORD_RECOVERY' || (session && event === 'SIGNED_IN')) {
            setSessionValid(true)
            setVerifyingSession(false)
          }
        })

        // Give a short grace period for session establishment
        const timer = setTimeout(() => {
          setVerifyingSession(false)
        }, 1200)

        return () => {
          clearTimeout(timer)
          authListener.subscription.unsubscribe()
        }
      } catch (err) {
        setVerifyingSession(false)
      }
    }

    checkSession()
  }, [supabase])

  // Password strength calculation
  const strength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: 'bg-gray-200' }
    let score = 0
    if (password.length >= 8) score += 1
    if (/[A-Z]/.test(password)) score += 1
    if (/[0-9]/.test(password)) score += 1
    if (/[^A-Za-z0-9]/.test(password)) score += 1

    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-red-500' }
    if (score === 2) return { score: 2, label: 'Fair', color: 'bg-amber-500' }
    if (score === 3) return { score: 3, label: 'Good', color: 'bg-blue-500' }
    return { score: 4, label: 'Strong', color: 'bg-emerald-500' }
  }, [password])

  // Requirements checks
  const meetsMinLength = password.length >= 8
  const hasUppercase = /[A-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const passwordsMatch = password.length > 0 && password === confirmPassword

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
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
        setErrorMessage(error.message || 'Failed to update password. Your recovery link may be expired or invalid.')
        setLoading(false)
        return
      }

      setSuccess(true)

      // Sign out from recovery session after successful reset to invalidate temporary tokens
      setTimeout(async () => {
        await supabase.auth.signOut()
      }, 500)
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred while resetting your password.')
    } finally {
      setLoading(false)
    }
  }

  if (verifyingSession) {
    return (
      <div className="text-center py-12 space-y-3">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-gray-500">Verifying secure recovery token…</p>
      </div>
    )
  }

  if (!sessionValid && !success) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
          <AlertCircle size={24} />
        </div>
        <div>
          <h3 className="font-bold text-base text-amber-900">Invalid or Expired Link</h3>
          <p className="text-xs text-amber-700 mt-1.5 leading-relaxed">
            This password reset link is invalid, has expired, or has already been used.
            Password reset tokens are single-use for your security.
          </p>
        </div>
        <Link
          href="/forgot-password"
          className="btn-primary text-xs py-2.5 px-4 inline-flex items-center gap-1.5 shadow-xs"
        >
          <span>Request New Reset Link</span>
          <ArrowRight size={14} />
        </Link>
      </div>
    )
  }

  if (success) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-4 animate-in fade-in duration-200">
        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
          <CheckCircle2 size={26} />
        </div>
        <div>
          <h3 className="font-bold text-base text-emerald-900">Password successfully changed!</h3>
          <p className="text-xs text-emerald-700 mt-1.5 leading-relaxed">
            Your Private Voices account password has been updated securely.
            You can now log in with your new credentials.
          </p>
        </div>
        <Link
          href="/login"
          className="btn-primary text-xs py-2.5 px-5 inline-flex items-center gap-2 shadow-xs"
        >
          <span>Sign In With New Password</span>
          <ArrowRight size={14} />
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Create new password</h2>
        <p className="text-xs text-gray-500 mt-1">
          Your new password must be secure and different from previous passwords.
        </p>
      </div>

      <form onSubmit={handleResetPassword} className="space-y-4">
        {/* New Password */}
        <div>
          <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1.5">
            New password
          </label>
          <div className="relative">
            <input
              id="new-password"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field pr-10"
              placeholder="••••••••"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Strength Meter */}
          {password.length > 0 && (
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-gray-500">Password strength:</span>
                <span className="font-semibold text-gray-700">{strength.label}</span>
              </div>
              <div className="grid grid-cols-4 gap-1 h-1.5">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`rounded-full transition-colors ${
                      strength.score >= step ? strength.color : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Confirm New Password */}
        <div>
          <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1.5">
            Confirm new password
          </label>
          <div className="relative">
            <input
              id="confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input-field pr-10"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              title={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Minimum Requirements List */}
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-1.5 text-xs">
          <span className="font-semibold text-gray-700 block mb-1">Password requirements:</span>
          <div className="flex items-center gap-1.5 text-gray-600">
            <span className={`w-1.5 h-1.5 rounded-full ${meetsMinLength ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            <span className={meetsMinLength ? 'text-emerald-700 font-medium' : ''}>At least 8 characters</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-600">
            <span className={`w-1.5 h-1.5 rounded-full ${hasUppercase ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            <span className={hasUppercase ? 'text-emerald-700 font-medium' : ''}>At least one uppercase letter (A-Z)</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-600">
            <span className={`w-1.5 h-1.5 rounded-full ${hasNumber ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            <span className={hasNumber ? 'text-emerald-700 font-medium' : ''}>At least one number (0-9)</span>
          </div>
          {confirmPassword.length > 0 && (
            <div className="flex items-center gap-1.5 text-gray-600">
              <span className={`w-1.5 h-1.5 rounded-full ${passwordsMatch ? 'bg-emerald-500' : 'bg-red-400'}`} />
              <span className={passwordsMatch ? 'text-emerald-700 font-medium' : 'text-red-600'}>
                {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
              </span>
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
            <AlertCircle size={15} className="flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !meetsMinLength || !passwordsMatch}
          className="btn-primary w-full py-2.5 text-sm font-semibold shadow-xs disabled:opacity-50"
        >
          {loading ? 'Updating password…' : 'Reset Password'}
        </button>
      </form>
    </div>
  )
}
