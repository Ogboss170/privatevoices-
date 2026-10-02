'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

interface RecipientProfile {
  id: string
  username: string
  display_name: string
  avatar_url?: string | null
  bio?: string | null
}

interface Props {
  recipient: RecipientProfile | null
  cleanUsername: string
  whisperVisibility: string
}

export default function PublicWhisperForm({
  recipient,
  cleanUsername,
  whisperVisibility,
}: Props) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const maxLength = 500

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim() || !recipient) return

    setLoading(true)
    setError(null)

    let delivered = false

    // 1. Try sending via NestJS API if NEXT_PUBLIC_API_URL is available
    if (process.env.NEXT_PUBLIC_API_URL) {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/whispers/${cleanUsername}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: content.trim() }),
        })
        if (res.ok) {
          delivered = true
        } else {
          const errData = await res.json()
          setError(errData.message || 'Failed to send whisper.')
          setLoading(false)
          return
        }
      } catch {
        // Fallback to Supabase below
      }
    }

    // 2. Fallback directly to Supabase client
    if (!delivered) {
      const supabase = createSupabaseBrowserClient()
      const { error: insertError } = await supabase.from('whispers').insert({
        recipient_id: recipient.id,
        content: content.trim(),
      })

      if (insertError) {
        setError('Unable to deliver whisper right now. Please try again.')
        setLoading(false)
        return
      }
    }

    setLoading(false)
    setSent(true)
  }

  if (!recipient) {
    return (
      <div className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto text-3xl">
          🔍
        </div>
        <h2 className="text-2xl font-bold text-white">User Not Found</h2>
        <p className="text-gray-300 text-sm">
          We couldn&apos;t find a Private Voices user with the username <span className="font-semibold text-purple-300">@{cleanUsername}</span>.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-full font-medium text-sm transition-all shadow-lg"
        >
          Return to Private Voices
        </Link>
      </div>
    )
  }

  if (whisperVisibility === 'nobody') {
    return (
      <div className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
        <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto text-3xl">
          🤫
        </div>
        <h2 className="text-2xl font-bold text-white">Whispers Disabled</h2>
        <p className="text-gray-300 text-sm">
          <span className="font-semibold text-purple-300">@{recipient.username}</span> is currently not accepting anonymous Whispers.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full font-medium text-sm transition-all"
        >
          Explore Private Voices
        </Link>
      </div>
    )
  }

  if (sent) {
    return (
      <div className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-3xl p-8 text-center space-y-5 shadow-2xl animate-fade-in">
        <div className="w-20 h-20 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto text-4xl shadow-lg shadow-purple-500/30">
          🤫
        </div>
        <div>
          <h2 className="text-2xl font-black text-white">Whisper Sent!</h2>
          <p className="text-purple-200 text-sm mt-1">
            Your anonymous message has been delivered to{' '}
            <span className="font-bold text-white">{recipient.display_name}</span>.
          </p>
        </div>

        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-xs text-gray-300 leading-relaxed">
          🔒 Your identity is 100% protected. Sender details are never shared with the recipient.
        </div>

        <div className="pt-2 space-y-3">
          <button
            onClick={() => {
              setContent('')
              setSent(false)
            }}
            className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-2xl transition-all text-sm"
          >
            Send Another Whisper
          </button>
          <Link
            href="/register"
            className="block w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-2xl transition-all text-sm shadow-lg shadow-purple-500/25"
          >
            Create Your Own Whisper Link
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
      {/* Recipient Profile Card */}
      <div className="flex items-center space-x-4">
        {recipient.avatar_url ? (
          <img
            src={recipient.avatar_url}
            alt={recipient.display_name}
            className="w-14 h-14 rounded-full object-cover border-2 border-purple-400 shadow-md"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-extrabold text-xl shadow-md border-2 border-purple-300">
            {recipient.display_name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-white truncate">{recipient.display_name}</h1>
          <p className="text-xs text-purple-300 font-medium">@{recipient.username}</p>
          {recipient.bio && (
            <p className="text-xs text-gray-300 line-clamp-1 mt-0.5">{recipient.bio}</p>
          )}
        </div>
      </div>

      <div className="border-t border-white/10 pt-5 space-y-1">
        <h2 className="text-lg font-extrabold text-white">
          Send an Anonymous Whisper to {recipient.display_name}
        </h2>
        <p className="text-xs text-purple-200">
          Your identity will not be shown to the recipient.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <textarea
            rows={5}
            required
            maxLength={maxLength}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your Whisper..."
            className="w-full bg-black/40 border border-white/20 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30 rounded-2xl p-4 text-white placeholder-gray-400 text-sm resize-none outline-none transition-all"
          />
          <div className="absolute right-3 bottom-3 text-[11px] font-mono text-gray-400 bg-black/60 px-2 py-0.5 rounded-md">
            {content.length} / {maxLength}
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-300 bg-red-500/20 border border-red-500/30 rounded-xl p-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !content.trim()}
          className="w-full py-3.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 text-white font-bold rounded-2xl transition-all shadow-lg shadow-purple-500/30 flex items-center justify-center space-x-2 text-sm"
        >
          <span>{loading ? 'Sending Whisper…' : 'Send Whisper'}</span>
          <span>🤫</span>
        </button>
      </form>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 text-center">
        <p className="text-[11px] text-gray-300">
          Receive honest thoughts from people around you — anonymously.
        </p>
      </div>
    </div>
  )
}
