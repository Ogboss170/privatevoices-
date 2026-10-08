'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Mail, CheckCircle2, AlertCircle } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const supabase = createSupabaseBrowserClient()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || loading) return

    setLoading(true)
    setError(null)

    try {
      // Determine the origin redirect URL
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const redirectTo = `${origin}/reset-password`

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      })

      // Security requirement: Never reveal whether an email is registered or not
      if (resetError) {
        console.error('Password reset request error:', resetError)
      }

      setSubmitted(true)
    } catch (err: any) {
      console.error('Password reset exception:', err)
      // Still show success screen to preserve user enumeration privacy
      setSubmitted(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors mb-4"
        >
          <ArrowLeft size={14} />
          <span>Back to sign in</span>
        </Link>
        <h2 className="text-xl font-bold text-gray-900">Forgot password?</h2>
        <p className="text-xs text-gray-500 mt-1">
          No worries. Enter your email address and we'll send you a recovery link to reset your password.
        </p>
      </div>

      {submitted ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center space-y-3 animate-in fade-in duration-200">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-emerald-900">Check your email</h3>
            <p className="text-xs text-emerald-700 mt-1.5 leading-relaxed">
              If an account matches <span className="font-semibold">{email}</span>, a password reset link has been dispatched.
              The link is single-use and will expire shortly.
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              href="/login"
              className="btn-primary text-xs py-2.5 w-full block text-center"
            >
              Return to Login
            </Link>
            <button
              type="button"
              onClick={() => {
                setSubmitted(false)
                setEmail('')
              }}
              className="text-xs text-gray-500 hover:text-gray-800 transition-colors"
            >
              Didn't receive it? Try another email
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleResetRequest} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              Account Email
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field pl-10"
                placeholder="you@example.com"
                autoFocus
              />
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
              <AlertCircle size={15} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="btn-primary w-full py-2.5 text-sm font-semibold shadow-xs disabled:opacity-50"
          >
            {loading ? 'Sending recovery link…' : 'Send reset link'}
          </button>
        </form>
      )}
    </div>
  )
}
