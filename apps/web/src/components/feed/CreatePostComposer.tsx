'use client'

import React, { useState, useRef } from 'react'
import Image from 'next/image'
import { Image as ImageIcon, Send, X, BarChart2, Plus, Trash2 } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import MentionAutocomplete from '../common/MentionAutocomplete'
import { compressImage } from '@/lib/media/imageCompression'

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

  const [showPollCreator, setShowPollCreator] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])

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
    if (!content.trim() && imageFiles.length === 0 && !showPollCreator) return

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
        let file = imageFiles[i]
        try {
          file = await compressImage(file, { maxWidth: 1920, maxHeight: 1920, quality: 0.82 })
        } catch (compErr) {
          console.warn('Image compression fallback to original:', compErr)
        }

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

    const { data: newPost, error: postError } = await supabase
      .from('posts')
      .insert({
        author_id: user.user.id,
        content: content.trim() || (uploadedUrls.length > 0 ? 'Voice attachment' : 'Community Poll'),
        image_urls: uploadedUrls,
      })
      .select('id')
      .single()

    if (postError) {
      setError(postError.message)
      setLoading(false)
      return
    }

    // Insert poll if created
    if (newPost && showPollCreator) {
      const validOptions = pollOptions.filter((o) => o.trim() !== '')
      if (validOptions.length >= 2) {
        const { data: newPoll } = await supabase
          .from('polls')
          .insert({
            post_id: newPost.id,
            question: pollQuestion.trim() || (content.trim() ? content.trim().slice(0, 80) : 'Poll'),
          })
          .select('id')
          .single()

        if (newPoll) {
          const optionRows = validOptions.map((opt, idx) => ({
            poll_id: newPoll.id,
            option_text: opt.trim(),
            option_order: idx,
            vote_count: 0,
          }))
          await supabase.from('poll_options').insert(optionRows)
        }
      }
    }

    // Clean up previews
    previewUrls.forEach((url) => URL.revokeObjectURL(url))
    setContent('')
    setImageFiles([])
    setPreviewUrls([])
    setShowPollCreator(false)
    setPollQuestion('')
    setPollOptions(['', ''])
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

        {/* Poll Builder Card */}
        {showPollCreator && (
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-2.5 relative">
            <button
              type="button"
              onClick={() => {
                setShowPollCreator(false)
                setPollQuestion('')
                setPollOptions(['', ''])
              }}
              className="absolute top-2.5 right-2.5 text-gray-400 hover:text-gray-600 p-1"
            >
              <X size={15} />
            </button>

            <div className="flex items-center gap-1.5 text-brand-600 font-bold text-xs uppercase tracking-wider">
              <BarChart2 size={15} />
              <span>Poll Details</span>
            </div>

            <input
              type="text"
              placeholder="Ask a question... (optional, or use voice text above)"
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-gray-200 bg-white text-gray-900 focus:outline-none focus:border-brand-500"
            />

            <div className="space-y-1.5">
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[10px] font-bold">
                    {i + 1}
                  </span>
                  <input
                    type="text"
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={(e) => {
                      const next = [...pollOptions]
                      next[i] = e.target.value
                      setPollOptions(next)
                    }}
                    className="flex-1 text-xs p-2 rounded-lg border border-gray-200 bg-white text-gray-900 focus:outline-none focus:border-brand-500"
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setPollOptions((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {pollOptions.length < 4 && (
              <button
                type="button"
                onClick={() => setPollOptions((prev) => [...prev, ''])}
                className="text-xs text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1 pt-1"
              >
                <Plus size={13} />
                <span>Add Option</span>
              </button>
            )}
          </div>
        )}

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

            <button
              type="button"
              onClick={() => setShowPollCreator(!showPollCreator)}
              className={`p-2 rounded-lg transition-colors ${
                showPollCreator
                  ? 'text-brand-600 bg-brand-50'
                  : 'text-gray-500 hover:text-brand-600 hover:bg-brand-50'
              }`}
              title="Create Poll"
            >
              <BarChart2 size={18} />
            </button>

            {imageFiles.length > 0 && (
              <span className="text-xs text-gray-400 font-medium">
                {imageFiles.length}/4
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={
              loading ||
              (!content.trim() &&
                imageFiles.length === 0 &&
                (!showPollCreator || pollOptions.filter((o) => o.trim()).length < 2))
            }
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

