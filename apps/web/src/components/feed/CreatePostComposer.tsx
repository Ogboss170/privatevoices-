'use client'

import React, { useState, useRef } from 'react'
import Image from 'next/image'
import { Image as ImageIcon, Send, X } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import MentionAutocomplete from '../common/MentionAutocomplete'

interface CreatePostComposerProps {
  onPostCreated?: () => void
}

export default function CreatePostComposer({ onPostCreated }: CreatePostComposerProps): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const [content, setContent] = useState('')
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return

    const incoming = Array.from(files)
    const availableSlots = 4 - imageFiles.length
    const toAdd = incoming.slice(0, availableSlots)

    if (toAdd.length > 0) {
      setImageFiles((prev) => [...prev, ...toAdd])
      const newUrls = toAdd.map((file) => URL.createObjectURL(file))
      setPreviewUrls((prev) => [...prev, ...newUrls])
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function handleRemoveImage(index: number) {
    URL.revokeObjectURL(previewUrls[index])
    setImageFiles((prev) => prev.filter((_, i) => i !== index))
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim() && imageFiles.length === 0) return

    setLoading(true)
    setError(null)

    const { data: user } = await supabase.auth.getUser()
    if (!user.user) {
      setError('You must be logged in to post.')
      setLoading(false)
      return
    }

    let uploadedUrls: string[] = []
    if (imageFiles.length > 0) {
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i]
        const fileExt = file.name.split('.').pop() || 'jpg'
        const fileName = `${user.user.id}/${Date.now()}_${i}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('post-media')
          .upload(fileName, file, {
            contentType: file.type || `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
            upsert: true,
          })

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from('post-media')
            .getPublicUrl(fileName)
          uploadedUrls.push(publicUrlData.publicUrl)
        } else {
          console.error('Failed to upload image:', uploadError)
        }
      }
    }

    const { error: postError } = await supabase.from('posts').insert({
      author_id: user.user.id,
      content: content.trim() || (uploadedUrls.length > 0 ? 'Voice attachment' : ''),
      image_urls: uploadedUrls,
    })

    if (postError) {
      setError(postError.message)
      setLoading(false)
      return
    }

    // Clean up previews
    previewUrls.forEach((url) => URL.revokeObjectURL(url))
    setContent('')
    setImageFiles([])
    setPreviewUrls([])
    setLoading(false)
    if (onPostCreated) onPostCreated()
  }

  return (
    <div className="card p-4 space-y-3">
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleImageSelect}
        />

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

        {/* Image preview strip */}
        {previewUrls.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {previewUrls.map((url, idx) => (
              <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0 group">
                <Image
                  src={url}
                  alt={`Preview ${idx + 1}`}
                  fill
                  unoptimized
                  className="object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(idx)}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-colors shadow"
                  title="Remove image"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={imageFiles.length >= 4}
              className="p-2 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors disabled:opacity-40"
              title={imageFiles.length >= 4 ? 'Maximum 4 images reached' : 'Add Image'}
            >
              <ImageIcon size={18} />
            </button>
            {imageFiles.length > 0 && (
              <span className="text-xs text-gray-400 font-medium">
                {imageFiles.length}/4
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || (!content.trim() && imageFiles.length === 0)}
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

