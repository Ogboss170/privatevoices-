'use client'

import React, { useState } from 'react'
import { X, Send, Sparkles } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

interface CreateStoryModalProps {
  onClose: () => void
  onCreated: () => void
}

export default function CreateStoryModal({ onClose, onCreated }: CreateStoryModalProps): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return

    setLoading(true)
    setError(null)

    const { data: user } = await supabase.auth.getUser()
    if (!user.user) {
      setError('Not authenticated')
      setLoading(false)
      return
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const { error: insertError } = await supabase.from('stories').insert({
      author_id: user.user.id,
      content: content.trim(),
      media_type: 'text',
      expires_at: expiresAt,
    })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    setLoading(false)
    onCreated()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-6 bg-white space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-brand-600" />
            <h2 className="text-sm font-bold text-gray-900">Add to Story</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <textarea
              rows={4}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's happening right now? Story disappears in 24 hours..."
              className="input-field text-sm resize-none bg-brand-50/50 border-brand-200"
              maxLength={280}
            />
            <span className="text-[10px] text-gray-400 text-right block mt-1">{content.length}/280</span>
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
              <span>{loading ? 'Posting…' : 'Share Story'}</span>
              <Send size={14} />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
