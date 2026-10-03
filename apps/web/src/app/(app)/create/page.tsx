'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  X,
  Image as ImageIcon,
  Camera,
  Film,
  Smile,
  BarChart2,
  Globe,
  Users,
  Star,
  Plus,
  Trash2,
  Check,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

const SAMPLE_GIFS = [
  'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM2Q1Y2E0MmE5OWIyZTZjNmEzZTVjMjIxM2ZhMWRlYTUwNmNlZjJjZCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0HlHJGHe3yAMhdQY/giphy.gif',
  'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM2Q1Y2E0MmE5OWIyZTZjNmEzZTVjMjIxM2ZhMWRlYTUwNmNlZjJjZCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26u4cqiYI30juCOGY/giphy.gif',
  'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM2Q1Y2E0MmE5OWIyZTZjNmEzZTVjMjIxM2ZhMWRlYTUwNmNlZjJjZCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l3vR85PnGsBwu1PfG/giphy.gif',
  'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM2Q1Y2E0MmE5OWIyZTZjNmEzZTVjMjIxM2ZhMWRlYTUwNmNlZjJjZCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKSjRrfIPjeiVyM/giphy.gif',
]

const EMOJIS = ['😊', '🤫', '🔥', '❤️', '🙌', '🎉', '💯', '✨', '👀', '💡', '🚀', '😎']

export default function CreatePostPage(): React.JSX.Element {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [profile, setProfile] = useState<any>(null)
  const [content, setContent] = useState('')
  const [audience, setAudience] = useState<'everyone' | 'followers' | 'close_friends'>('everyone')
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [selectedGif, setSelectedGif] = useState<string | null>(null)
  const [showPollCreator, setShowPollCreator] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState<string[]>(['', ''])

  const [showGifPicker, setShowGifPicker] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showDiscardModal, setShowDiscardModal] = useState(false)
  const [loading, setLoading] = useState(false)

  const imageInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const maxLength = 500

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase.from('profiles').select('*').eq('id', data.user.id).single().then(({ data: prof }) => {
          if (prof) setProfile(prof)
        })
      }
    })
  }, [supabase])

  // Auto-expand textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.max(160, textareaRef.current.scrollHeight)}px`
    }
  }, [content])

  const hasUnsavedChanges =
    content.trim().length > 0 ||
    selectedImages.length > 0 ||
    selectedGif !== null ||
    (showPollCreator && (pollQuestion.trim() !== '' || pollOptions.some((o) => o.trim() !== '')))

  function handleCancel() {
    if (hasUnsavedChanges) {
      setShowDiscardModal(true)
    } else {
      router.back()
    }
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return

    const incoming = Array.from(files)
    const availableSlots = 4 - imageFiles.length
    const toAdd = incoming.slice(0, availableSlots)

    if (toAdd.length > 0) {
      setImageFiles((prev) => [...prev, ...toAdd])
      const newUrls = toAdd.map((file) => URL.createObjectURL(file))
      setSelectedImages((prev) => [...prev, ...newUrls])
    }
  }

  function handleAddPollOption() {
    if (pollOptions.length < 4) {
      setPollOptions((prev) => [...prev, ''])
    }
  }

  function handlePollOptionChange(index: number, val: string) {
    setPollOptions((prev) => {
      const next = [...prev]
      next[index] = val
      return next
    })
  }

  function handleRemovePollOption(index: number) {
    if (pollOptions.length > 2) {
      setPollOptions((prev) => prev.filter((_, i) => i !== index))
    }
  }

  async function handlePublish() {
    if (!hasUnsavedChanges || loading) return
    setLoading(true)

    const { data: userRes } = await supabase.auth.getUser()
    if (!userRes.user) {
      alert('You must be logged in to create a Voice.')
      setLoading(false)
      return
    }

    let finalContent = content.trim()
    if (selectedGif) {
      finalContent += `\n\n![GIF](${selectedGif})`
    }
    if (showPollCreator && pollQuestion.trim()) {
      const validOptions = pollOptions.filter((o) => o.trim() !== '')
      if (validOptions.length >= 2) {
        finalContent += `\n\n📊 Poll: ${pollQuestion.trim()}\n` + validOptions.map((o, i) => `${i + 1}. ${o.trim()}`).join('\n')
      }
    }

    let uploadedUrls: string[] = []
    if (imageFiles.length > 0) {
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i]
        const fileExt = file.name.split('.').pop() || 'jpg'
        const fileName = `${userRes.user.id}/${Date.now()}_${i}.${fileExt}`

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

    if (selectedGif && !uploadedUrls.includes(selectedGif)) {
      uploadedUrls.push(selectedGif)
    }

    const { data: newPost, error } = await supabase
      .from('posts')
      .insert({
        author_id: userRes.user.id,
        content: finalContent || 'Voice attachment',
        image_urls: uploadedUrls,
      })
      .select('id')
      .single()

    if (!error && newPost && showPollCreator && pollQuestion.trim()) {
      const validOptions = pollOptions.filter((o) => o.trim() !== '')
      if (validOptions.length >= 2) {
        const { data: newPoll } = await supabase
          .from('polls')
          .insert({
            post_id: newPost.id,
            question: pollQuestion.trim(),
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

    setLoading(false)

    if (error) {
      alert(`Publish failed: ${error.message}`)
    } else {
      router.push('/feed')
      router.refresh()
    }
  }

  const isPublishEnabled =
    !loading &&
    (content.trim().length > 0 ||
      selectedImages.length > 0 ||
      selectedGif !== null ||
      (showPollCreator && pollQuestion.trim() !== '' && pollOptions.filter((o) => o.trim()).length >= 2))

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col justify-between">
      {/* ── Hidden File Inputs ── */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleImageUpload}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* ── Top Header Bar ── */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <button
          onClick={handleCancel}
          className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors px-2 py-1 rounded-lg hover:bg-gray-100"
        >
          Cancel
        </button>

        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          New Voice
        </span>

        <button
          onClick={handlePublish}
          disabled={!isPublishEnabled}
          className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:hover:bg-brand-600 text-white font-bold rounded-full text-xs transition-all shadow-sm flex items-center space-x-1.5"
        >
          {loading ? (
            <span className="animate-pulse">Publishing…</span>
          ) : (
            <span>Post</span>
          )}
        </button>
      </header>

      {/* ── Composer Body ── */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 space-y-6">
        {/* User Info & Audience Selector */}
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-700 text-lg flex-shrink-0">
            {profile?.avatar_url ? (
              <Image src={profile.avatar_url} alt="Profile" width={44} height={44} className="rounded-full object-cover" />
            ) : (
              profile?.display_name?.charAt(0)?.toUpperCase() || 'G'
            )}
          </div>

          <div className="space-y-1">
            <h2 className="text-sm font-bold text-gray-900">
              {profile?.display_name || 'Ghost'}
            </h2>

            {/* Audience Dropdown */}
            <div className="relative inline-block">
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value as any)}
                className="text-xs font-semibold bg-gray-100 border border-gray-200 text-gray-700 rounded-full px-2.5 py-0.5 pr-6 appearance-none cursor-pointer outline-none hover:bg-gray-200/70 transition-colors"
              >
                <option value="everyone">🌐 Everyone</option>
                <option value="followers">👥 Followers</option>
                <option value="close_friends">⭐️ Close Friends</option>
              </select>
            </div>
          </div>
        </div>

        {/* Text Input */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            rows={5}
            maxLength={maxLength}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind?"
            className="w-full text-base text-gray-900 placeholder-gray-400 bg-transparent border-none outline-none resize-none p-0 focus:ring-0 leading-relaxed"
          />
        </div>

        {/* Media Previews (Images Grid) */}
        {selectedImages.length > 0 && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            {selectedImages.map((src, index) => (
              <div key={index} className="relative aspect-video rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 group">
                <img src={src} alt={`Upload preview ${index + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => {
                    setSelectedImages((prev) => prev.filter((_, i) => i !== index))
                    setImageFiles((prev) => prev.filter((_, i) => i !== index))
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all"
                  title="Remove image"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* GIF Preview */}
        {selectedGif && (
          <div className="relative rounded-2xl overflow-hidden border border-gray-200 max-w-sm">
            <img src={selectedGif} alt="Selected GIF" className="w-full h-auto rounded-2xl" />
            <button
              onClick={() => setSelectedGif(null)}
              className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Poll Creator Preview Card */}
        {showPollCreator && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3 relative">
            <button
              onClick={() => {
                setShowPollCreator(false)
                setPollQuestion('')
                setPollOptions(['', ''])
              }}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>

            <div className="flex items-center space-x-2">
              <BarChart2 size={16} className="text-brand-600" />
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Create a Poll</h3>
            </div>

            <input
              type="text"
              placeholder="Ask a question..."
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              className="input-field text-xs bg-white"
            />

            <div className="space-y-2">
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center text-[10px] font-bold text-gray-400">
                    {i + 1}
                  </span>
                  <input
                    type="text"
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={(e) => handlePollOptionChange(i, e.target.value)}
                    className="input-field text-xs bg-white flex-1"
                  />
                  {pollOptions.length > 2 && (
                    <button
                      onClick={() => handleRemovePollOption(i)}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {pollOptions.length < 4 && (
              <button
                onClick={handleAddPollOption}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center space-x-1 pt-1"
              >
                <Plus size={14} />
                <span>Add option</span>
              </button>
            )}
          </div>
        )}
      </main>

      {/* ── Attachment Toolbar (Sticky Bottom) ── */}
      <footer className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 z-30">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-1 sm:space-x-2">
            <button
              onClick={() => imageInputRef.current?.click()}
              className="p-2.5 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-colors"
              title="Gallery"
            >
              <ImageIcon size={20} />
            </button>

            <button
              onClick={() => cameraInputRef.current?.click()}
              className="p-2.5 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-colors"
              title="Camera"
            >
              <Camera size={20} />
            </button>

            <button
              onClick={() => setShowGifPicker((prev) => !prev)}
              className="p-2.5 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-colors"
              title="GIF"
            >
              <Film size={20} />
            </button>

            <button
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className="p-2.5 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-colors"
              title="Emoji"
            >
              <Smile size={20} />
            </button>

            <button
              onClick={() => setShowPollCreator((prev) => !prev)}
              className={`p-2.5 rounded-full transition-colors ${
                showPollCreator ? 'text-brand-600 bg-brand-50' : 'text-gray-500 hover:text-brand-600 hover:bg-brand-50'
              }`}
              title="Poll"
            >
              <BarChart2 size={20} />
            </button>
          </div>

          <div className="text-xs font-mono text-gray-400">
            {content.length} / {maxLength}
          </div>
        </div>

        {/* Popovers: GIF Picker */}
        {showGifPicker && (
          <div className="max-w-2xl mx-auto mt-3 p-3 bg-gray-50 border border-gray-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-gray-700">
              <span>Select a GIF</span>
              <button onClick={() => setShowGifPicker(false)}>
                <X size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SAMPLE_GIFS.map((gif, idx) => (
                <img
                  key={idx}
                  src={gif}
                  alt={`GIF ${idx}`}
                  onClick={() => {
                    setSelectedGif(gif)
                    setShowGifPicker(false)
                  }}
                  className="w-full h-24 object-cover rounded-xl cursor-pointer hover:opacity-80 transition-opacity border border-gray-200"
                />
              ))}
            </div>
          </div>
        )}

        {/* Popovers: Emoji Picker */}
        {showEmojiPicker && (
          <div className="max-w-2xl mx-auto mt-3 p-3 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-between">
            <div className="flex items-center space-x-2 flex-wrap">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => {
                    setContent((prev) => prev + e)
                    setShowEmojiPicker(false)
                  }}
                  className="text-xl p-1.5 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  {e}
                </button>
              ))}
            </div>
            <button onClick={() => setShowEmojiPicker(false)} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </div>
        )}
      </footer>

      {/* Discard Confirmation Modal */}
      {showDiscardModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <h3 className="text-lg font-bold text-gray-900">Discard Voice?</h3>
            <p className="text-xs text-gray-500">
              Your post draft will be deleted. This action cannot be undone.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowDiscardModal(false)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-2xl text-xs hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDiscardModal(false)
                  router.back()
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl text-xs shadow-md"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
