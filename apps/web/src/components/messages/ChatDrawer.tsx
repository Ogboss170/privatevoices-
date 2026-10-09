'use client'

import React, { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { X, Send, Loader2, Image as ImageIcon, ExternalLink, Trash2, Mic, Play, Pause, Square, Volume2 } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

interface ChatDrawerProps {
  conversationId: string
  partner: {
    id: string
    username: string
    displayName: string
    avatarUrl: string | null
  }
  currentUserId: string
  onClose: () => void
}

export default function ChatDrawer({
  conversationId,
  partner,
  currentUserId,
  onClose,
}: ChatDrawerProps): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const [messages, setMessages] = useState<any[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null)

  // Presence & Typing State
  const [isPartnerTyping, setIsPartnerTyping] = useState(false)
  const [isPartnerOnline, setIsPartnerOnline] = useState(false)

  // Voice Note / Audio Whisper State
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null)
  const [audioSpeed, setAudioSpeed] = useState<1 | 1.5 | 2>(1)
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0)
  const [audioDuration, setAudioDuration] = useState<number>(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const currentAudioElementRef = useRef<HTMLAudioElement | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const channelRef = useRef<any>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    async function loadMessages() {
      setLoading(true)
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      setMessages(data ?? [])
      setLoading(false)
      scrollToBottom()

      // Mark unread messages as read
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', currentUserId)
    }

    loadMessages()

    // Setup Realtime Channel with Broadcast & Presence
    const channel = supabase.channel(`chat:${conversationId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: currentUserId },
      },
    })

    channelRef.current = channel

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
          setIsPartnerTyping(false)
          scrollToBottom()

          // Mark newly received message as read if drawer is open
          if (payload.new.sender_id !== currentUserId) {
            supabase
              .from('messages')
              .update({ is_read: true })
              .eq('id', payload.new.id)
              .then(() => {})
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === payload.new.id ? { ...m, is_read: payload.new.is_read } : m))
          )
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id))
        }
      )
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload?.userId !== currentUserId) {
          setIsPartnerTyping(!!payload?.isTyping)
          if (payload?.isTyping) {
            scrollToBottom()
          }
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const partnerActive = Object.values(state).some((presences: any) =>
          presences.some((p: any) => p.user_id === partner.id)
        )
        setIsPartnerOnline(partnerActive)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: currentUserId, online: true })
        }
      })

    return () => {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: { userId: currentUserId, isTyping: false },
        })
      }
      supabase.removeChannel(channel)

      if (currentAudioElementRef.current) {
        currentAudioElementRef.current.pause()
        currentAudioElementRef.current = null
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [supabase, conversationId, currentUserId, partner.id])

  // --- Web Audio Recording & Playback ---
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.start()
      setIsRecording(true)
      setRecordingSeconds(0)

      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1)
      }, 1000)
    } catch (err) {
      console.error('Failed to get user audio media:', err)
      alert('Microphone access is required to record voice notes.')
    }
  }

  function cancelRecording() {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current)
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop())
      mediaRecorderRef.current.stop()
    }
    audioChunksRef.current = []
    setIsRecording(false)
    setRecordingSeconds(0)
  }

  async function stopAndSendRecording() {
    if (!mediaRecorderRef.current) return
    const duration = recordingSeconds

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current)
    }
    setIsRecording(false)
    setRecordingSeconds(0)

    mediaRecorderRef.current.onstop = async () => {
      mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop())
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      audioChunksRef.current = []

      await uploadAndSendAudio(audioBlob, duration)
    }

    mediaRecorderRef.current.stop()
  }

  async function uploadAndSendAudio(blob: Blob, durationSec: number) {
    setSending(true)
    const tempId = 'temp-audio-' + Date.now()
    const tempAudioUrl = URL.createObjectURL(blob)

    const optimisticMsg = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: '🎙️ Voice note',
      audio_url: tempAudioUrl,
      audio_duration: durationSec,
      is_read: false,
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, optimisticMsg])
    scrollToBottom()

    try {
      const fileName = `voice-notes/${conversationId}/${Date.now()}.webm`
      let uploadRes = await supabase.storage
        .from('chat-media')
        .upload(fileName, blob, { contentType: 'audio/webm', upsert: true })

      if (uploadRes.error) {
        uploadRes = await supabase.storage
          .from('stories')
          .upload(`chat/${fileName}`, blob, { contentType: 'audio/webm', upsert: true })
      }

      let uploadedUrl = tempAudioUrl
      if (uploadRes.data) {
        const bucket = uploadRes.data.path.startsWith('chat/') ? 'stories' : 'chat-media'
        const { data: publicUrlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(uploadRes.data.path)
        uploadedUrl = publicUrlData.publicUrl
      }

      const { data: newMsg, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: '🎙️ Voice note',
          audio_url: uploadedUrl,
          audio_duration: durationSec,
        })
        .select('*')
        .single()

      if (error) {
        console.error('Failed to send audio message:', error)
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        alert(`Failed to send voice note: ${error.message}`)
      } else if (newMsg) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? newMsg : m)))
        await supabase
          .from('conversations')
          .update({
            last_message: '🎙️ Voice note',
            last_message_at: new Date().toISOString(),
          })
          .eq('id', conversationId)
      }
    } catch (err) {
      console.error('Error uploading voice note:', err)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
    } finally {
      setSending(false)
    }
  }

  function handleToggleAudio(msgId: string, audioUrl: string) {
    if (playingAudioId === msgId) {
      if (currentAudioElementRef.current) {
        currentAudioElementRef.current.pause()
        currentAudioElementRef.current = null
      }
      setPlayingAudioId(null)
      setAudioCurrentTime(0)
      return
    }

    if (currentAudioElementRef.current) {
      currentAudioElementRef.current.pause()
    }

    const audio = new window.Audio(audioUrl)
    audio.playbackRate = audioSpeed
    currentAudioElementRef.current = audio
    setPlayingAudioId(msgId)

    audio.ontimeupdate = () => {
      setAudioCurrentTime(audio.currentTime)
      if (audio.duration && !isNaN(audio.duration)) {
        setAudioDuration(audio.duration)
      }
    }

    audio.onloadedmetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setAudioDuration(audio.duration)
      }
    }

    audio.onended = () => {
      setPlayingAudioId(null)
      setAudioCurrentTime(0)
      currentAudioElementRef.current = null
    }

    audio.onerror = () => {
      alert('Could not play audio message.')
      setPlayingAudioId(null)
      setAudioCurrentTime(0)
      currentAudioElementRef.current = null
    }

    audio.play().catch((err) => {
      console.error('Audio play error:', err)
      setPlayingAudioId(null)
      setAudioCurrentTime(0)
    })
  }

  function handleToggleWebAudioSpeed() {
    const nextSpeed: 1 | 1.5 | 2 = audioSpeed === 1 ? 1.5 : audioSpeed === 1.5 ? 2 : 1
    setAudioSpeed(nextSpeed)
    if (currentAudioElementRef.current) {
      currentAudioElementRef.current.playbackRate = nextSpeed
    }
  }

  function handleScrubWebAudio(fraction: number) {
    if (!currentAudioElementRef.current || !audioDuration) return
    const targetSec = fraction * audioDuration
    currentAudioElementRef.current.currentTime = targetSec
    setAudioCurrentTime(targetSec)
  }

  function formatAudioDuration(sec: number) {
    const mins = Math.floor(sec / 60)
    const secs = sec % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  function scrollToBottom() {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 80)
  }

  function handleTextChange(val: string) {
    setText(val)

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUserId, isTyping: true },
      })

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      typingTimeoutRef.current = setTimeout(() => {
        channelRef.current?.send({
          type: 'broadcast',
          event: 'typing',
          payload: { userId: currentUserId, isTyping: false },
        })
      }, 2500)
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Image size exceeds 10MB limit.')
      return
    }

    setImageFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  function handleRemoveImage() {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if ((!text.trim() && !imageFile) || sending) return

    // Immediately stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    channelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: currentUserId, isTyping: false },
    })

    const messageContent = text.trim() || '📷 Photo'
    const currentImgFile = imageFile
    const currentImgPreview = imagePreview

    setText('')
    handleRemoveImage()
    setSending(true)

    // Optimistic message
    const tempId = 'temp-' + Date.now()
    const optimisticMsg = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: messageContent,
      image_url: currentImgPreview,
      is_read: false,
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, optimisticMsg])
    scrollToBottom()

    try {
      let uploadedUrl: string | null = null

      if (currentImgFile) {
        const fileExt = currentImgFile.name.split('.').pop() || 'jpg'
        const fileName = `${currentUserId}/${Date.now()}.${fileExt}`

        let uploadRes = await supabase.storage
          .from('chat-media')
          .upload(fileName, currentImgFile, { upsert: true })

        if (uploadRes.error) {
          uploadRes = await supabase.storage
            .from('stories')
            .upload(`chat/${fileName}`, currentImgFile, { upsert: true })
        }

        if (uploadRes.data) {
          const bucket = uploadRes.data.path.startsWith('chat/') ? 'stories' : 'chat-media'
          const { data: publicUrlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(uploadRes.data.path)

          uploadedUrl = publicUrlData.publicUrl
        }
      }

      const { data: newMsg, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: messageContent,
          image_url: uploadedUrl,
        })
        .select('*')
        .single()

      if (error) {
        console.error('Failed to send message:', error)
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        alert(`Failed to send message: ${error.message}`)
      } else if (newMsg) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? newMsg : m)))

        // Update conversation last_message
        await supabase
          .from('conversations')
          .update({
            last_message: messageContent,
            last_message_at: new Date().toISOString(),
          })
          .eq('id', conversationId)
      }
    } catch (err) {
      console.error('Error sending message:', err)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
    } finally {
      setSending(false)
    }
  }

  async function handleDeleteMessage(msgId: string) {
    // Optimistic removal
    setMessages((prev) => prev.filter((m) => m.id !== msgId))
    const { error } = await supabase.from('messages').delete().eq('id', msgId)
    if (error) {
      console.error('Delete failed, reloading messages:', error)
      // Re-fetch to restore state
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      setMessages(data ?? [])
    }
  }

  return (
    <>
      {/* Backdrop for closing */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs md:bg-transparent"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-gray-200 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white/90 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-600 overflow-hidden border border-gray-100">
                {partner.avatarUrl ? (
                  <Image
                    src={partner.avatarUrl}
                    alt={partner.displayName}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  partner.displayName.charAt(0).toUpperCase()
                )}
              </div>
              {isPartnerOnline && (
                <span
                  className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white"
                  title="Online now"
                />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-sm text-gray-900 truncate">{partner.displayName}</h3>
              </div>
              <p className="text-xs truncate">
                {isPartnerTyping ? (
                  <span className="text-brand-600 font-semibold animate-pulse">typing...</span>
                ) : isPartnerOnline ? (
                  <span className="text-emerald-600 font-medium">Online</span>
                ) : (
                  <span className="text-gray-500">@{partner.username}</span>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close chat"
          >
            <X size={20} />
          </button>
        </div>

        {/* Messages List */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-gray-50/70">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
              <Loader2 className="animate-spin text-brand-600" size={24} />
              <p className="text-xs">Loading messages…</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12 space-y-2">
              <div className="text-4xl mb-1">👋</div>
              <h4 className="font-bold text-sm text-gray-800">Say hello!</h4>
              <p className="text-xs text-gray-500 max-w-xs">
                Start your conversation with @{partner.username}. Messages and media are private and identity-verified.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === currentUserId
              const isTemp = msg.id.startsWith?.('temp-')
              const hasImage = !!msg.image_url
              const hasAudio = !!msg.audio_url
              const isPlayingThis = playingAudioId === msg.id
              const showText = msg.content && msg.content !== '📷 Photo' && msg.content !== '🎙️ Voice note'

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}
                >
                  <div className={`flex items-end gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Delete button — only visible on own messages on hover */}
                    {isMe && !isTemp && (
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 flex-shrink-0"
                        title="Delete message"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}

                    <div
                      className={`max-w-[82%] rounded-2xl text-xs leading-relaxed overflow-hidden ${
                        isMe
                          ? 'bg-brand-600 text-white rounded-br-xs shadow-xs'
                          : 'bg-white text-gray-900 border border-gray-200/80 rounded-bl-xs shadow-xs'
                      } ${isTemp ? 'opacity-70' : ''}`}
                    >
                      {/* Media Image */}
                      {hasImage && (
                        <div
                          className="cursor-pointer group/img relative overflow-hidden max-w-sm"
                          onClick={() => setPreviewModalUrl(msg.image_url)}
                        >
                          <img
                            src={msg.image_url}
                            alt="Shared media"
                            className="w-full max-h-64 object-cover hover:scale-102 transition-transform duration-200"
                          />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                            <ExternalLink size={18} className="text-white drop-shadow-md" />
                          </div>
                        </div>
                      )}

                      {/* Voice Note / Audio Whisper Player */}
                      {hasAudio && (
                        <div className={`p-3 flex items-center gap-3 min-w-[210px] ${isMe ? 'text-white' : 'text-gray-900'}`}>
                          <button
                            type="button"
                            onClick={() => handleToggleAudio(msg.id, msg.audio_url)}
                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-sm flex-shrink-0 ${
                              isMe ? 'bg-white text-brand-600' : 'bg-brand-600 text-white'
                            }`}
                            title={isPlayingThis ? 'Pause' : 'Play voice note'}
                          >
                            {isPlayingThis ? (
                              <Pause size={16} />
                            ) : (
                              <Play size={16} className="ml-0.5" />
                            )}
                          </button>

                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-1 h-5">
                              {[35, 60, 45, 90, 65, 100, 75, 45, 80, 50, 70, 95, 40].map((h, idx) => {
                                const barFraction = idx / 13
                                const currentFraction = isPlayingThis && audioDuration > 0
                                  ? audioCurrentTime / audioDuration
                                  : 0
                                const isPlayed = barFraction <= currentFraction

                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (isPlayingThis) {
                                        handleScrubWebAudio((idx + 1) / 13)
                                      }
                                    }}
                                    className="h-full flex items-center justify-center p-0.5 hover:scale-110 transition-transform cursor-pointer"
                                    title="Scrub audio"
                                  >
                                    <span
                                      className={`w-1 rounded-full transition-all duration-150 block ${
                                        isMe
                                          ? isPlayed
                                            ? 'bg-white'
                                            : 'bg-white/40'
                                          : isPlayed
                                          ? 'bg-brand-600'
                                          : 'bg-brand-300'
                                      }`}
                                      style={{ height: `${h}%` }}
                                    />
                                  </button>
                                )
                              })}
                            </div>
                            <div className="flex items-center justify-between text-[10px] opacity-80">
                              <span>
                                {isPlayingThis && audioCurrentTime > 0
                                  ? `${formatAudioDuration(Math.floor(audioCurrentTime))} / `
                                  : ''}
                                {formatAudioDuration(msg.audio_duration || 0)}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {isPlayingThis && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleToggleWebAudioSpeed()
                                    }}
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-transform hover:scale-105 active:scale-95 ${
                                      isMe ? 'bg-white/20 text-white' : 'bg-brand-100 text-brand-700'
                                    }`}
                                    title="Toggle playback speed"
                                  >
                                    {audioSpeed}x
                                  </button>
                                )}
                                <span className="font-semibold uppercase tracking-wider text-[9px]">Audio Whisper</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Text Content */}
                      {showText && (
                        <div className="p-3">
                          {msg.content}
                        </div>
                      )}
                    </div>
                  </div>

                  <span className="text-[10px] text-gray-400 mt-1 px-1 flex items-center gap-1">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {isMe && !isTemp && (
                      <span className="text-brand-500 font-semibold">
                        {msg.is_read ? '✓✓' : '✓'}
                      </span>
                    )}
                  </span>
                </div>
              )
            })
          )}

          {/* Typing Bubble */}
          {isPartnerTyping && (
            <div className="flex flex-col items-start animate-in fade-in duration-200">
              <div className="bg-white border border-gray-200/80 rounded-2xl rounded-bl-xs px-4 py-3 flex items-center gap-1.5 shadow-xs">
                <span className="w-2 h-2 bg-brand-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 bg-brand-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 bg-brand-500 rounded-full animate-bounce" />
              </div>
              <span className="text-[10px] text-brand-600 font-medium mt-1 px-1">
                {partner.displayName} is typing...
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Selected Image Preview Bar */}
        {imagePreview && (
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200 relative">
                <img src={imagePreview} alt="Selected preview" className="w-full h-full object-cover" />
              </div>
              <span className="text-xs text-gray-600 font-medium truncate max-w-[200px]">
                {imageFile?.name || 'Image selected'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleRemoveImage}
              className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Input Bar or Voice Recording Bar */}
        {isRecording ? (
          <div className="p-3 border-t border-gray-100 bg-white flex items-center justify-between animate-in fade-in duration-150">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
              <span className="text-xs font-bold text-red-600">
                Recording: {formatAudioDuration(recordingSeconds)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelRecording}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-1 transition-colors"
              >
                <Trash2 size={14} />
                <span>Cancel</span>
              </button>

              <button
                type="button"
                onClick={stopAndSendRecording}
                className="btn-primary text-xs py-1.5 px-3.5 rounded-xl flex items-center gap-1.5 shadow-sm"
              >
                <Send size={13} />
                <span>Send Note</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSend} className="p-3 border-t border-gray-100 bg-white flex gap-2 items-center">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageSelect}
              accept="image/*"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl text-gray-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
              title="Attach Image"
            >
              <ImageIcon size={19} />
            </button>

            <input
              type="text"
              placeholder={imageFile ? "Add a caption..." : "Type a message..."}
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              disabled={sending}
              className="input-field text-xs py-2.5 px-3.5 flex-1 rounded-xl focus:border-brand-500"
              autoFocus
            />

            {text.trim() || imageFile ? (
              <button
                type="submit"
                disabled={sending || (!text.trim() && !imageFile)}
                className="btn-primary text-xs py-2.5 px-4 rounded-xl flex items-center justify-center transition-all disabled:opacity-50"
              >
                {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                className="p-2.5 rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors flex items-center justify-center shadow-xs"
                title="Record Voice Note / Whisper"
              >
                <Mic size={18} />
              </button>
            )}
          </form>
        )}
      </div>

      {/* Fullscreen Image Preview Lightbox */}
      {previewModalUrl && (
        <div
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setPreviewModalUrl(null)}
        >
          <button
            onClick={() => setPreviewModalUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
          >
            <X size={24} />
          </button>
          <img
            src={previewModalUrl}
            alt="Full size media"
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}
    </>
  )
}
