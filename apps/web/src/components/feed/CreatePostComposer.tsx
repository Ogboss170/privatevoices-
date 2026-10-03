'use client'

import React, { useState } from 'react'
import { Image as ImageIcon, Send } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import MentionAutocomplete from '../common/MentionAutocomplete'

interface CreatePostComposerProps {
  onPostCreated?: () => void
}

export default function CreatePostComposer({ onPostCreated }: CreatePostComposerProps): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mentionMatch = content.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/)
  const mentionQuery = mentionMatch ? mentionMatch[1] : null
  const isMentioning = mentionQuery !== null

  function handleSelectMention(username: string) {
    setContent((prev) => {
      return prev.replace(/(?:^|\s)@([a-zA-Z0-9_]*)$/, (match) => {
        const prefix = match.startsWith(' ') ? ' ' : ''
        return `${prefix}@${username} `
      })
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return

    setLoading(true)
    setError(null)

    const { data: user } = await supabase.auth.getUser()
    if (!user.user) {
      setError('You must be logged in to post.')
      setLoading(false)
      return
    }

    const { error: postError } = await supabase.from('posts').insert({
      author_id: user.user.id,
      content: content.trim(),
    })

    if (postError) {
      setError(postError.message)
      setLoading(false)
      return
    }

    setContent('')
    setLoading(false)
    if (onPostCreated) onPostCreated()
  }

  return (
    <div className="card p-4 space-y-3">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <MentionAutocomplete
            query={mentionQuery ?? ''}
            visible={isMentioning}
            onSelect={handleSelectMention}
          />
          <textarea
            rows={3}
            placeholder="What's on your mind? Speak freely... (use @ to mention someone)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full resize-none border-0 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
              title="Add Image (Coming soon)"
            >
              <ImageIcon size={18} />
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
          >
            <span>{loading ? 'Posting…' : 'Post'}</span>
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  )
}
