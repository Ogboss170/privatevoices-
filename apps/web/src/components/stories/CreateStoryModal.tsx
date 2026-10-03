'use client'

import React, { useState, useRef } from 'react'
import Image from 'next/image'
import { X, Send, Sparkles, Image as ImageIcon, Trash2 } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

interface CreateStoryModalProps {
  onClose: () => void
  onCreated: () => void
}

export default function CreateStoryModal({ onClose, onCreated }: CreateStoryModalProps): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const [content, setContent] = useState('')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setMediaFile(file)
      setMediaPreview(URL.createObjectURL(file))
    }
  }

  function handleRemoveMedia() {
    setMediaFile(null)
    setMediaPreview(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim() && !mediaFile) return

    setLoading(true)
    setError(null)

    const { data: userRes } = await supabase.auth.getUser()
    if (!userRes.user) {
      setError('Not authenticated')
      setLoading(false)
      return
    }

    let uploadedUrl: string | null = null
    let mediaType = 'text'

    if (mediaFile) {
      const fileExt = mediaFile.name.split('.').pop()
      const fileName = `${userRes.user.id}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('stories')
        .upload(fileName, mediaFile, { upsert: true })

      if (uploadError) {
        setError(`Image upload failed: ${uploadError.message}`)
        setLoading(false)
        return
      }

      const { data: publicUrlData } = supabase.storage
        .from('stories')
        .getPublicUrl(fileName)

      uploadedUrl = publicUrlData.publicUrl
      mediaType = mediaFile.type.startsWith('video/') ? 'video' : 'image'
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const { error: insertError } = await supabase.from('stories').insert({
      author_id: userRes.user.id,
      content: content.trim() || null,
      media_url: uploadedUrl,
      media_type: mediaType,
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
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's happening right now? Story disappears in 24 hours..."
              className="input-field text-sm resize-none bg-brand-50/50 border-brand-200"
              maxLength={280}
            />
            <span className="text-[10px] text-gray-400 text-right block mt-1">{content.length}/280</span>
          </div>

          {/* Media Preview or Add Media Button */}
          {mediaPreview ? (
            <div className="relative rounded-xl overflow-hidden max-h-48 border border-gray-200 group">
              <Image src={mediaPreview} alt="Story preview" width={400} height={200} className="w-full h-48 object-cover" />
              <button
                type="button"
                onClick={handleRemoveMedia}
                className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 border-2 border-dashed border-gray-200 hover:border-brand-400 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-gray-600 hover:text-brand-600 transition-colors"
            >
              <ImageIcon size={18} />
              <span>Attach Image to Story</span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-xs py-2.5">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (!content.trim() && !mediaFile)}
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
