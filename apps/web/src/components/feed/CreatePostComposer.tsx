'use client'

import React, { useState, useRef } from 'react'
import Image from 'next/image'
import { Image as ImageIcon, Send, X, BarChart2, Plus, Trash2, Mic, Film, Square } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import MentionAutocomplete from '../common/MentionAutocomplete'
import { compressImage } from '@/lib/media/imageCompression'
import VoiceWaveformPlayer from '../common/VoiceWaveformPlayer'

interface CreatePostComposerProps {
  onPostCreated?: () => void
}

export default function CreatePostComposer({ onPostCreated }: CreatePostComposerProps): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const [content, setContent] = useState('')
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(null)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [audioPreview, setAudioPreview] = useState<string | null>(null)
  const [audioDuration, setAudioDuration] = useState<number>(0)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)

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

  function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('video/')) {
      alert('Please select a video file.')
      return
    }
    setVideoFile(file)
    setVideoPreview(URL.createObjectURL(file))
  }

  function handleRemoveVideo() {
    if (videoPreview) URL.revokeObjectURL(videoPreview)
    setVideoFile(null)
    setVideoPreview(null)
  }

  // Audio recording helpers
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data)
        }
      }

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const file = new File([audioBlob], `voice-whisper-${Date.now()}.webm`, { type: 'audio/webm' })
        setAudioFile(file)
        setAudioPreview(URL.createObjectURL(audioBlob))
        setAudioDuration(recordingSeconds)
        stream.getTracks().forEach((track) => track.stop())
      }

      recorder.start(100)
      setIsRecording(true)
      setRecordingSeconds(0)

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 120) {
            stopRecording()
            return prev
          }
          return prev + 1
        })
      }, 1000)
    } catch (err: any) {
      alert(`Could not start microphone: ${err.message || err}`)
    }
  }

  function stopRecording() {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }

  function handleRemoveAudio() {
    if (audioPreview) URL.revokeObjectURL(audioPreview)
    setAudioFile(null)
    setAudioPreview(null)
    setAudioDuration(0)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim() && imageFiles.length === 0 && !videoFile && !audioFile && !showPollCreator) return

    setLoading(true)
    setError(null)

    const { data: user } = await supabase.auth.getUser()
    if (!user.user) {
      setError('You must be logged in to post.')
      setLoading(false)
      return
    }

    let uploadedUrls: string[] = []
    let uploadedAudioUrl: string | null = null
    let uploadedVideoUrl: string | null = null

    // 1. Upload Images
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

    // 2. Upload Video
    if (videoFile) {
      const fileExt = videoFile.name.split('.').pop() || 'mp4'
      const fileName = `${user.user.id}/video_${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('post-media')
        .upload(fileName, videoFile, {
          contentType: videoFile.type || 'video/mp4',
          upsert: true,
        })

      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage
          .from('post-media')
          .getPublicUrl(fileName)
        uploadedVideoUrl = publicUrlData.publicUrl
      } else {
        console.error('Failed to upload video:', uploadError)
      }
    }

    // 3. Upload Audio
    if (audioFile) {
      const fileName = `${user.user.id}/audio_${Date.now()}.webm`

      const { error: uploadError } = await supabase.storage
        .from('post-media')
        .upload(fileName, audioFile, {
          contentType: 'audio/webm',
          upsert: true,
        })

      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage
          .from('post-media')
          .getPublicUrl(fileName)
        uploadedAudioUrl = publicUrlData.publicUrl
      } else {
        console.error('Failed to upload audio:', uploadError)
      }
    }

    // Prepare content text
    let finalContent = content.trim()
    if (!finalContent) {
      if (uploadedAudioUrl) finalContent = '🎙️ Voice Whisper note'
      else if (uploadedVideoUrl) finalContent = '🎥 Video post'
      else if (uploadedUrls.length > 0) finalContent = '📷 Photo attachment'
      else if (showPollCreator) finalContent = '📊 Community Poll'
      else finalContent = 'Shared a Voice'
    }

    // If audio or video uploaded, append URL into content as fallback so it works seamlessly even if columns are not present
    if (uploadedAudioUrl) {
      finalContent = `${finalContent}\n\n${uploadedAudioUrl}`
    }
    if (uploadedVideoUrl) {
      finalContent = `${finalContent}\n\n${uploadedVideoUrl}`
    }

    const { data: newPost, error: postError } = await supabase
      .from('posts')
      .insert({
        author_id: user.user.id,
        content: finalContent,
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

        {/* Video Preview */}
        {videoPreview && (
          <div className="relative rounded-2xl overflow-hidden bg-black max-h-56 border border-gray-200">
            <video
              src={videoPreview}
              controls
              playsInline
              className="w-full max-h-56 object-contain"
            />
            <button
              type="button"
              onClick={handleRemoveVideo}
              className="absolute top-2 right-2 w-6 h-6 bg-black/70 hover:bg-black/90 text-white rounded-full flex items-center justify-center transition-colors shadow z-10"
              title="Remove video"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Audio Waveform Preview */}
        {audioPreview && (
          <div className="relative rounded-2xl p-1 bg-brand-50/50 border border-brand-200">
            <VoiceWaveformPlayer
              audioUrl={audioPreview}
              duration={audioDuration}
              theme="brand"
              barCount={22}
            />
            <button
              type="button"
              onClick={handleRemoveAudio}
              className="absolute top-2 right-2 w-5 h-5 bg-gray-600 hover:bg-gray-800 text-white rounded-full flex items-center justify-center transition-colors shadow z-10"
              title="Remove audio"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Live Audio Recording Bar */}
        {isRecording && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-2 text-red-600 text-xs font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
              <span>Recording Voice Whisper ({recordingSeconds}s / 120s)</span>
            </div>
            <button
              type="button"
              onClick={stopRecording}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs"
            >
              <Square size={12} />
              <span>Done</span>
            </button>
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Image attachment */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={imageFiles.length >= 4}
              className="p-2 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors disabled:opacity-40"
              title={imageFiles.length >= 4 ? 'Maximum 4 images reached' : 'Add Photo'}
            >
              <ImageIcon size={18} />
            </button>

            {/* Video attachment */}
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className={`p-2 rounded-lg transition-colors ${
                videoFile
                  ? 'text-purple-600 bg-purple-50'
                  : 'text-gray-500 hover:text-purple-600 hover:bg-purple-50'
              }`}
              title="Add Video"
            >
              <Film size={18} />
            </button>

            {/* Voice Whisper Record */}
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`p-2 rounded-lg transition-colors ${
                isRecording
                  ? 'text-red-600 bg-red-100 animate-pulse'
                  : audioFile
                  ? 'text-brand-600 bg-brand-50'
                  : 'text-gray-500 hover:text-brand-600 hover:bg-brand-50'
              }`}
              title={isRecording ? 'Stop Recording' : 'Record Voice Whisper'}
            >
              <Mic size={18} />
            </button>

            {/* Poll creator */}
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

          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            onChange={handleVideoSelect}
            className="hidden"
          />

          <button
            type="submit"
            disabled={
              loading ||
              (!content.trim() &&
                imageFiles.length === 0 &&
                !videoFile &&
                !audioFile &&
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

