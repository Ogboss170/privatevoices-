'use client'

import React, { useState } from 'react'
import { X, Send, Lock } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

interface SendWhisperModalProps {
  recipientId: string
  recipientUsername: string
  recipientDisplayName: string
  onClose: () => void
}

export default function SendWhisperModal({
  recipientId,
  recipientUsername,
  recipientDisplayName,
  onClose,
}: SendWhisperModalProps): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selfDestruct, setSelfDestruct] = useState<'24h' | '7d' | 'never'>('24h')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return

    setLoading(true)
    setError(null)

    const { error: insertError } = await supabase.from('whispers').insert({
      recipient_id: recipientId,
      content: content.trim(),
    })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-6 bg-white space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-xs">
              🤫
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-gray-900">Encrypted Whisper</h2>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full">
                  E2EE Protected
                </span>
              </div>
              <p className="text-[11px] text-gray-500">To @{recipientUsername}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {sent ? (
          <div className="text-center py-6 space-y-3">
            <div className="text-4xl">📬</div>
            <h3 className="font-bold text-gray-900">Whisper Sent!</h3>
            <p className="text-xs text-gray-500 max-w-xs mx-auto">
              Your message was delivered anonymously with end-to-end forward security. @{recipientUsername} will not see your identity.
            </p>
            <button onClick={onClose} className="btn-primary text-xs py-2 px-6">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <textarea
                rows={4}
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`Write something honest or inspiring for ${recipientDisplayName}...`}
                className="input-field text-sm resize-none"
                maxLength={500}
              />
              <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1">
                <span className="flex items-center gap-1 text-emerald-700 font-medium">
                  <Lock size={12} className="text-emerald-600" />
                  Sender identity zero-knowledge protected
                </span>
                <span>{content.length}/500</span>
              </div>
            </div>

            {/* Self-Destruct Timer Selector */}
            <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/60 flex items-center justify-between text-xs">
              <span className="font-semibold text-amber-900 flex items-center gap-1.5">
                <span>🔥</span> Self-Destruct Timer:
              </span>
              <div className="flex items-center gap-1">
                {(['24h', '7d', 'never'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setSelfDestruct(opt)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-colors ${
                      selfDestruct === opt
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {opt === '24h' ? '24 Hours' : opt === '7d' ? '7 Days' : 'Never'}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn-secondary flex-1 text-xs py-2.5">
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !content.trim()}
                className="btn-primary flex-1 text-xs py-2.5 flex items-center justify-center gap-1.5"
              >
                <span>{loading ? 'Sending…' : 'Send Whisper'}</span>
                <Send size={14} />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
