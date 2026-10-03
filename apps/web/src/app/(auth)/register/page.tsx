'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Check, X } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [form, setForm] = useState({
    email: '',
    password: '',
    username: '',
    displayName: '',
  })
  
  // Consent Checkbox state — starts UNCHECKED
  const [hasConsented, setHasConsented] = useState(false)

  // Modal state for Terms & Privacy
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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

    // 1. Create the Supabase Auth user with terms consent metadata
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          username: form.username,
          display_name: form.displayName,
          accepted_terms: true,
          accepted_terms_at: acceptedAt,
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (!data.user) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    // 2. Create the profile with terms consent recorded
    let profileCreated = false

    if (process.env.NEXT_PUBLIC_API_URL) {
      try {
        const apiRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/complete-profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: data.user.id,
            username: form.username,
            displayName: form.displayName,
            acceptedTerms: true,
            acceptedTermsAt: acceptedAt,
          }),
        })

        if (apiRes.ok) {
          profileCreated = true
        }
      } catch {
        // Ignore network errors calling API, fallback below
      }
    }

    if (!profileCreated) {
      // Fallback: create profile directly via Supabase RPC / table insert
      const { error: rpcError } = await supabase.rpc('create_profile', {
        p_user_id: data.user.id,
        p_username: form.username,
        p_display_name: form.displayName,
        p_accepted_terms: true,
        p_accepted_terms_at: acceptedAt,
      })

      if (rpcError) {
        const { error: insertError } = await supabase.from('profiles').upsert({
          id: data.user.id,
          username: form.username,
          display_name: form.displayName,
          accepted_terms: true,
          accepted_terms_at: acceptedAt,
        })

        if (insertError) {
          console.warn('Profile creation error:', rpcError || insertError)
        }
      }
    }

    // Check if session was granted or requires verification
    if (!data.session) {
      setError('Account created! Please check your email to confirm your account before logging in.')
      setLoading(false)
      return
    }

    router.push('/feed')
    router.refresh()
  }

  return (
    <>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Create your account</h2>

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
                className="input-field pl-7"
                placeholder="oghosa"
              />
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={handleChange}
            className="input-field"
            placeholder="you@example.com"
          />
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

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
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
