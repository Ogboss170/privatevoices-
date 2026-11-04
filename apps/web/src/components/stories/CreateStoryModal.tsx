'use client'

import React, { useState, useRef } from 'react'
import Image from 'next/image'
import { X, Send, Sparkles, Image as ImageIcon, Trash2, Film, Mic, Play, Pause, Square, MapPin } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import VoiceWaveformPlayer from '@/components/common/VoiceWaveformPlayer'
import { LocationPickerModal } from '@/components/common/LocationPickerModal'
import type { LocationPlace, StoryLocationSticker } from '@private-voices/shared'

interface CreateStoryModalProps {
  onClose: () => void
  onCreated: () => void
}

export default function CreateStoryModal({ onClose, onCreated }: CreateStoryModalProps): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const [content, setContent] = useState('')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'audio'>('image')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Story Location Sticker state
  const [locationSticker, setLocationSticker] = useState<StoryLocationSticker | null>(null)
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [isDraggingSticker, setIsDraggingSticker] = useState(false)
  const stickerDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)

  // Voice Recording
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setMediaFile(file)
      setMediaPreview(URL.createObjectURL(file))
      if (file.type.startsWith('video/')) {
        setMediaType('video')
      } else if (file.type.startsWith('audio/')) {
        setMediaType('audio')
      } else {
        setMediaType('image')
      }
    }
  }

  function handleRemoveMedia() {
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview)
    }
    setMediaFile(null)
    setMediaPreview(null)
  }

  // Voice recording helpers
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
        const file = new File([audioBlob], `story-voice-${Date.now()}.webm`, { type: 'audio/webm' })
        setMediaFile(file)
        setMediaPreview(URL.createObjectURL(audioBlob))
        setMediaType('audio')
        stream.getTracks().forEach((track) => track.stop())
      }

      recorder.start(100)
      setIsRecording(true)
      setRecordingSeconds(0)

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 60) {
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
    let chosenMediaType = 'text'

    if (mediaFile) {
      const fileExt = mediaFile.name.split('.').pop() || (mediaType === 'audio' ? 'webm' : 'jpg')
      const fileName = `${userRes.user.id}/${Date.now()}.${fileExt}`

      const contentType = mediaFile.type || (mediaType === 'audio' ? 'audio/webm' : 'image/jpeg')

      const { error: uploadError } = await supabase.storage
        .from('stories')
        .upload(fileName, mediaFile, { contentType, upsert: true })

      if (uploadError) {
        setError(`Media upload failed: ${uploadError.message}`)
        setLoading(false)
        return
      }

      const { data: publicUrlData } = supabase.storage
        .from('stories')
        .getPublicUrl(fileName)

      uploadedUrl = publicUrlData.publicUrl
      chosenMediaType = mediaType
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const storyPayload: any = {
      author_id: userRes.user.id,
      content: content.trim() || null,
      media_url: uploadedUrl,
      media_type: chosenMediaType,
      expires_at: expiresAt,
    }

    if (locationSticker) {
      storyPayload.location_sticker = locationSticker
    }

    let { error: insertError } = await supabase.from('stories').insert(storyPayload)

    // Resilient fallback: if schema cache does not have location_sticker yet
    if (insertError && /location_sticker/i.test(insertError.message)) {
      const fallbackPayload = {
        author_id: userRes.user.id,
        content: content.trim() || null,
        media_url: uploadedUrl,
        media_type: chosenMediaType,
        expires_at: expiresAt,
      }
      const retry = await supabase.from('stories').insert(fallbackPayload)
      insertError = retry.error
    }

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

          {/* Media Preview or Add Media Buttons */}
          {mediaPreview ? (
            <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-950 p-2 group">
              {mediaType === 'video' ? (
                <video
                  src={mediaPreview}
                  controls
                  playsInline
                  className="w-full max-h-48 object-contain rounded-xl"
                />
              ) : mediaType === 'audio' ? (
                <div className="py-3 px-2">
                  <div className="flex items-center gap-2 mb-2 text-brand-300 text-xs font-semibold">
                    <Mic size={14} className="text-brand-400" />
                    <span>Recorded Voice Whisper</span>
                  </div>
                  <VoiceWaveformPlayer audioUrl={mediaPreview} theme="dark" barCount={20} />
                </div>
              ) : (
                <div className="relative w-full h-48 rounded-xl overflow-hidden">
                  <Image src={mediaPreview} alt="Story preview" fill className="object-cover" />
                </div>
              )}

              {/* Interactive Draggable / Scalable Location Sticker Overlay */}
              {locationSticker && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${locationSticker.x}%`,
                    top: `${locationSticker.y}%`,
                    transform: `translate(-50%, -50%) scale(${locationSticker.scale || 1.0})`,
                    cursor: isDraggingSticker ? 'grabbing' : 'grab',
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setIsDraggingSticker(true)
                    stickerDragRef.current = {
                      startX: e.clientX,
                      startY: e.clientY,
                      origX: locationSticker.x,
                      origY: locationSticker.y,
                    }

                    const handleMouseMove = (moveEvent: MouseEvent) => {
                      if (!stickerDragRef.current) return
                      const deltaX = moveEvent.clientX - stickerDragRef.current.startX
                      const deltaY = moveEvent.clientY - stickerDragRef.current.startY
                      const newX = Math.max(10, Math.min(90, stickerDragRef.current.origX + (deltaX / 300) * 100))
                      const newY = Math.max(10, Math.min(90, stickerDragRef.current.origY + (deltaY / 200) * 100))
                      setLocationSticker((prev) => prev ? { ...prev, x: newX, y: newY } : null)
                    }

                    const handleMouseUp = () => {
                      setIsDraggingSticker(false)
                      stickerDragRef.current = null
                      window.removeEventListener('mousemove', handleMouseMove)
                      window.removeEventListener('mouseup', handleMouseUp)
                    }

                    window.addEventListener('mousemove', handleMouseMove)
                    window.addEventListener('mouseup', handleMouseUp)
                  }}
                  className="z-20 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 text-gray-900 shadow-xl border border-white/50 backdrop-blur-md select-none group/sticker"
                >
                  <MapPin size={13} className="text-red-500 fill-red-500" />
                  <span className="font-bold text-xs">{locationSticker.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setLocationSticker(null)
                    }}
                    className="p-0.5 rounded-full hover:bg-gray-200 text-gray-500"
                    title="Remove sticker"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={handleRemoveMedia}
                className="absolute top-3 right-3 p-1.5 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors z-10"
                title="Remove attached media"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ) : isRecording ? (
            /* Live Voice Recording Status */
            <div className="w-full py-4 px-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-2 text-red-600 text-xs font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                <span>Recording Voice Whisper ({recordingSeconds}s / 60s)</span>
              </div>
              <button
                type="button"
                onClick={stopRecording}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <Square size={13} />
                <span>Done</span>
              </button>
            </div>
          ) : (
            /* Media Selector Tabs (Image / Video / Voice) */
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="py-3 border-2 border-dashed border-gray-200 hover:border-brand-400 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-gray-600 hover:text-brand-600 transition-colors"
              >
                <ImageIcon size={16} />
                <span>Photo / Video</span>
              </button>

              <button
                type="button"
                onClick={startRecording}
                className="py-3 border-2 border-dashed border-gray-200 hover:border-purple-400 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-gray-600 hover:text-purple-600 transition-colors"
              >
                <Mic size={16} />
                <span>Record Voice</span>
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {error && <p className="text-xs text-red-600">{error}</p>}

          {/* Location Sticker Toolbar Trigger */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setShowLocationPicker(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                locationSticker
                  ? 'bg-red-50 text-red-600 border border-red-200'
                  : 'text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <MapPin size={14} className={locationSticker ? 'text-red-500 fill-red-500' : 'text-gray-500'} />
              <span>{locationSticker ? `📍 ${locationSticker.name}` : 'Add Location Sticker'}</span>
            </button>
            {locationSticker && (
              <span className="text-[11px] text-gray-400">Drag to position sticker</span>
            )}
          </div>

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

      {/* Location Picker Modal for Story */}
      <LocationPickerModal
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        initialSelected={locationSticker ? { placeId: locationSticker.placeId, name: locationSticker.name, city: locationSticker.city, country: locationSticker.country } : null}
        onSelectLocation={(loc) => {
          setLocationSticker({
            placeId: loc.placeId,
            name: loc.name,
            city: loc.city || null,
            country: loc.country || null,
            x: 50,
            y: 40,
            scale: 1.0,
          })
        }}
      />
    </div>
  )
}
