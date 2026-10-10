'use client'

import React, { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { X, Send, Loader2, Image as ImageIcon, ExternalLink, Trash2, Mic, Play, Pause, Square, Volume2, Maximize2, Minimize2, Phone, Video, Search, Reply as ReplyIcon, Flame, Smile, Film, Sparkles, History, PhoneIncoming, PhoneOutgoing, PhoneMissed } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/media/imageCompression'
import { DMCallModal } from '@/components/messages/DMCallModal'
import { playDMSound, startRingtone, stopRingtone } from '@/lib/sound/soundEffects'
import type { DMCallType, DMCallStatus } from '@private-voices/shared'

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
  const [isFullScreen, setIsFullScreen] = useState(true)

  // Search in chat
  const [isSearching, setIsSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Call history panel
  const [showCallHistory, setShowCallHistory] = useState(false)
  const [callLogs, setCallLogs] = useState<any[]>([])
  const [loadingCallLogs, setLoadingCallLogs] = useState(false)

  // Reply quoting
  const [replyingTo, setReplyingTo] = useState<{
    id: string
    content: string
    senderName: string
  } | null>(null)

  // Vanishing mode
  const [isVanishMode, setIsVanishMode] = useState(false)

  // Video attachment
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  // Hovered / active reaction message ID
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null)

  // Voice & Video Calling State
  const [isCallOpen, setIsCallOpen] = useState(false)
  const [callType, setCallType] = useState<DMCallType>('audio')
  const [callStatus, setCallStatus] = useState<DMCallStatus>('idle')
  const [isIncomingCall, setIsIncomingCall] = useState(false)
  const [activeCallId, setActiveCallId] = useState<string | null>(null)

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

      // Fetch conversation settings (e.g. vanish mode)
      try {
        const { data: convData } = await supabase
          .from('conversations')
          .select('vanish_mode_enabled')
          .eq('id', conversationId)
          .single()
        if (convData?.vanish_mode_enabled !== undefined) {
          setIsVanishMode(Boolean(convData.vanish_mode_enabled))
        }
      } catch (e) {
        // Ignore if column not yet added
      }

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
            playDMSound('message_receive')
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
            prev.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m))
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
      .on('broadcast', { event: 'call_signal' }, ({ payload }) => {
        if (!payload) return
        if (payload.receiver?.id === currentUserId && payload.action === 'call_init') {
          setActiveCallId(payload.callId)
          setCallType(payload.type || 'audio')
          setCallStatus('incoming_ringing')
          setIsIncomingCall(true)
          setIsCallOpen(true)
          startRingtone('incoming')
        } else if (payload.action === 'call_accept') {
          stopRingtone()
          playDMSound('call_connected')
          setCallStatus('connected')
        } else if (payload.action === 'call_decline') {
          stopRingtone()
          playDMSound('call_ended')
          setCallStatus('declined')
          setTimeout(() => {
            setIsCallOpen(false)
            setCallStatus('idle')
          }, 1800)
        } else if (payload.action === 'call_end') {
          stopRingtone()
          playDMSound('call_ended')
          setCallStatus('ended')
          setTimeout(() => {
            setIsCallOpen(false)
            setCallStatus('idle')
          }, 1500)
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

  // Call start timestamp ref for duration logging
  const callStartTimeRef = useRef<number | null>(null)

  // --- Voice & Video Calling Handlers ---
  function handleStartCall(type: DMCallType) {
    const newCallId = 'call-' + Date.now()
    setActiveCallId(newCallId)
    setCallType(type)
    setCallStatus('outgoing_ringing')
    setIsIncomingCall(false)
    setIsCallOpen(true)
    startRingtone('outgoing')
    callStartTimeRef.current = Date.now()

    // Send broadcast signal
    channelRef.current?.send({
      type: 'broadcast',
      event: 'call_signal',
      payload: {
        callId: newCallId,
        conversationId,
        type,
        action: 'call_init',
        caller: {
          id: currentUserId,
          username: 'you',
          displayName: 'You',
        },
        receiver: partner,
        timestamp: Date.now(),
      },
    })
  }

  function handleAcceptCall() {
    stopRingtone()
    playDMSound('call_connected')
    setCallStatus('connected')
    callStartTimeRef.current = Date.now()
    channelRef.current?.send({
      type: 'broadcast',
      event: 'call_signal',
      payload: {
        callId: activeCallId,
        conversationId,
        type: callType,
        action: 'call_accept',
        caller: partner,
        receiver: { id: currentUserId, username: 'you', displayName: 'You' },
        timestamp: Date.now(),
      },
    })
  }

  async function logCallRecord(finalStatus: 'connected' | 'missed' | 'declined' | 'ended' | 'cancelled') {
    try {
      const now = Date.now()
      const durationSeconds = callStartTimeRef.current
        ? Math.max(0, Math.round((now - callStartTimeRef.current) / 1000))
        : 0

      await supabase.from('dm_call_logs').insert({
        conversation_id: conversationId,
        caller_id: isIncomingCall ? partner.id : currentUserId,
        receiver_id: isIncomingCall ? currentUserId : partner.id,
        call_type: callType,
        status: finalStatus,
        duration_seconds: durationSeconds,
        started_at: callStartTimeRef.current
          ? new Date(callStartTimeRef.current).toISOString()
          : new Date().toISOString(),
        ended_at: new Date(now).toISOString(),
      })
      loadCallLogs()
    } catch (e) {
      console.warn('Could not record dm_call_log:', e)
    }
  }

  async function loadCallLogs() {
    setLoadingCallLogs(true)
    try {
      const { data, error } = await supabase
        .from('dm_call_logs')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
      if (!error && data) {
        setCallLogs(data)
      }
    } catch (err) {
      console.warn('Error loading call logs:', err)
    } finally {
      setLoadingCallLogs(false)
    }
  }

  function handleToggleCallHistory() {
    const nextVal = !showCallHistory
    setShowCallHistory(nextVal)
    if (nextVal) {
      loadCallLogs()
    }
  }

  function handleDeclineCall() {
    stopRingtone()
    playDMSound('call_ended')
    setCallStatus('declined')
    logCallRecord('declined')
    channelRef.current?.send({
      type: 'broadcast',
      event: 'call_signal',
      payload: {
        callId: activeCallId,
        conversationId,
        type: callType,
        action: 'call_decline',
        caller: partner,
        receiver: { id: currentUserId, username: 'you', displayName: 'You' },
        timestamp: Date.now(),
      },
    })
    setTimeout(() => {
      setIsCallOpen(false)
      setCallStatus('idle')
    }, 1500)
  }

  function handleEndCall() {
    stopRingtone()
    playDMSound('call_ended')
    const finalStatus = callStatus === 'connected' ? 'ended' : 'cancelled'
    setCallStatus('ended')
    logCallRecord(finalStatus)
    channelRef.current?.send({
      type: 'broadcast',
      event: 'call_signal',
      payload: {
        callId: activeCallId,
        conversationId,
        type: callType,
        action: 'call_end',
        caller: partner,
        receiver: { id: currentUserId, username: 'you', displayName: 'You' },
        timestamp: Date.now(),
      },
    })
    setTimeout(() => {
      setIsCallOpen(false)
      setCallStatus('idle')
    }, 1200)
  }

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
        playDMSound('voice_note_sent')
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

  function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('video/')) {
      alert('Please select a video file.')
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      alert('Video size exceeds 50MB limit.')
      return
    }

    setVideoFile(file)
    setVideoPreview(URL.createObjectURL(file))
  }

  function handleRemoveVideo() {
    setVideoFile(null)
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview)
    }
    setVideoPreview(null)
    if (videoInputRef.current) {
      videoInputRef.current.value = ''
    }
  }

  async function handleToggleReaction(messageId: string, emoji: string) {
    // Optimistic UI update for reactions
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m
        const currentReactions: Record<string, string[]> = m.reactions ? { ...m.reactions } : {}
        const existingUsers: string[] = currentReactions[emoji] ? [...currentReactions[emoji]] : []
        const userIndex = existingUsers.indexOf(currentUserId)

        if (userIndex > -1) {
          existingUsers.splice(userIndex, 1)
          if (existingUsers.length === 0) {
            delete currentReactions[emoji]
          } else {
            currentReactions[emoji] = existingUsers
          }
        } else {
          existingUsers.push(currentUserId)
          currentReactions[emoji] = existingUsers
        }

        return { ...m, reactions: currentReactions }
      })
    )

    try {
      const { data, error } = await supabase.rpc('toggle_dm_reaction', {
        p_message_id: messageId,
        p_emoji: emoji,
      })
      if (error) {
        console.warn('toggle_dm_reaction RPC fallback/error:', error)
      }
    } catch (err) {
      console.error('Error toggling reaction:', err)
    }
  }

  async function handleToggleVanishMode() {
    const nextVal = !isVanishMode
    setIsVanishMode(nextVal)

    try {
      await supabase.rpc('toggle_conversation_vanish_mode', {
        p_conversation_id: conversationId,
        p_enabled: nextVal,
        p_duration_seconds: 86400,
      })
    } catch (e) {
      console.warn('Vanish mode RPC fallback:', e)
      // Fallback direct table update
      await supabase
        .from('conversations')
        .update({ vanish_mode_enabled: nextVal })
        .eq('id', conversationId)
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if ((!text.trim() && !imageFile && !videoFile) || sending) return

    // Immediately stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    channelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: currentUserId, isTyping: false },
    })

    const messageContent =
      text.trim() || (imageFile ? '📷 Photo' : videoFile ? '🎥 Video' : '')
    const currentImgFile = imageFile
    const currentImgPreview = imagePreview
    const currentVidFile = videoFile
    const currentVidPreview = videoPreview
    const quotedReply = replyingTo

    setText('')
    handleRemoveImage()
    handleRemoveVideo()
    setReplyingTo(null)
    setSending(true)

    // Optimistic message
    const tempId = 'temp-' + Date.now()
    const optimisticMsg = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: messageContent,
      image_url: currentImgPreview,
      video_url: currentVidPreview,
      media_type: currentVidFile ? 'video' : currentImgFile ? 'image' : 'text',
      is_disappearing: isVanishMode,
      reply_to_message_id: quotedReply?.id || null,
      reply_to_content: quotedReply?.content || null,
      reply_to_sender: quotedReply?.senderName || null,
      reactions: {},
      is_read: false,
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, optimisticMsg])
    scrollToBottom()
    playDMSound('message_send')

    try {
      let uploadedImgUrl: string | null = null
      let uploadedVidUrl: string | null = null

      if (currentImgFile) {
        let fileToUpload = currentImgFile
        try {
          fileToUpload = await compressImage(currentImgFile, { maxWidth: 1600, maxHeight: 1600, quality: 0.82 })
        } catch (compErr) {
          console.warn('Image compression fallback to original:', compErr)
        }

        const fileExt = fileToUpload.name.split('.').pop() || 'jpg'
        const fileName = `${currentUserId}/${Date.now()}.${fileExt}`

        let uploadRes = await supabase.storage
          .from('chat-media')
          .upload(fileName, fileToUpload, { upsert: true })

        if (uploadRes.error) {
          uploadRes = await supabase.storage
            .from('stories')
            .upload(`chat/${fileName}`, fileToUpload, { upsert: true })
        }

        if (uploadRes.data) {
          const bucket = uploadRes.data.path.startsWith('chat/') ? 'stories' : 'chat-media'
          const { data: publicUrlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(uploadRes.data.path)

          uploadedImgUrl = publicUrlData.publicUrl
        }
      }

      if (currentVidFile) {
        const fileExt = currentVidFile.name.split('.').pop() || 'mp4'
        const fileName = `${currentUserId}/${Date.now()}.${fileExt}`

        let uploadRes = await supabase.storage
          .from('chat-media')
          .upload(fileName, currentVidFile, { upsert: true })

        if (uploadRes.error) {
          uploadRes = await supabase.storage
            .from('stories')
            .upload(`chat/${fileName}`, currentVidFile, { upsert: true })
        }

        if (uploadRes.data) {
          const bucket = uploadRes.data.path.startsWith('chat/') ? 'stories' : 'chat-media'
          const { data: publicUrlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(uploadRes.data.path)

          uploadedVidUrl = publicUrlData.publicUrl
        }
      }

      const { data: newMsg, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: messageContent,
          image_url: uploadedImgUrl,
          video_url: uploadedVidUrl,
          media_type: uploadedVidUrl ? 'video' : uploadedImgUrl ? 'image' : 'text',
          is_disappearing: isVanishMode,
          reply_to_message_id: quotedReply?.id || null,
          reply_to_content: quotedReply?.content || null,
          reply_to_sender: quotedReply?.senderName || null,
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
      {!isFullScreen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:bg-black/20"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed z-50 bg-white shadow-2xl flex flex-col transition-all duration-200 ${
          isFullScreen
            ? 'inset-0 w-full h-full'
            : 'inset-y-0 right-0 w-full max-w-lg border-l border-gray-200'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white/95 backdrop-blur-sm sticky top-0 z-10">
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

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Search messages toggle */}
            <button
              onClick={() => setIsSearching((prev) => !prev)}
              className={`p-2 rounded-xl transition-colors ${
                isSearching
                  ? 'text-brand-600 bg-brand-50'
                  : 'text-gray-600 hover:text-brand-600 hover:bg-gray-100'
              }`}
              aria-label="Search chat"
              title="Search messages"
            >
              <Search size={18} />
            </button>

            {/* Vanish / Disappearing mode toggle */}
            <button
              onClick={handleToggleVanishMode}
              className={`p-2 rounded-xl transition-all ${
                isVanishMode
                  ? 'text-amber-500 bg-amber-50 shadow-xs'
                  : 'text-gray-500 hover:text-amber-500 hover:bg-gray-100'
              }`}
              aria-label="Toggle Vanish Mode"
              title={isVanishMode ? 'Vanish Mode: ON (Messages auto-fade)' : 'Turn On Vanish Mode'}
            >
              <Flame size={18} className={isVanishMode ? 'animate-pulse' : ''} />
            </button>

            {/* Call History Button */}
            <button
              onClick={handleToggleCallHistory}
              className={`p-2 rounded-xl transition-colors ${
                showCallHistory
                  ? 'text-purple-600 bg-purple-50'
                  : 'text-gray-600 hover:text-purple-600 hover:bg-gray-100'
              }`}
              aria-label="View Call History"
              title="Call History"
            >
              <History size={18} />
            </button>

            {/* Voice Call Button */}
            <button
              onClick={() => handleStartCall('audio')}
              className="p-2 rounded-xl text-gray-600 hover:text-purple-600 hover:bg-purple-50 transition-colors"
              aria-label="Start Voice Call"
              title="Voice Call"
            >
              <Phone size={18} />
            </button>

            {/* Video Call Button */}
            <button
              onClick={() => handleStartCall('video')}
              className="p-2 rounded-xl text-gray-600 hover:text-purple-600 hover:bg-purple-50 transition-colors"
              aria-label="Start Video Call"
              title="Video Call"
            >
              <Video size={19} />
            </button>

            <div className="w-[1px] h-5 bg-gray-200 mx-0.5" />

            <button
              onClick={() => setIsFullScreen((prev) => !prev)}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label={isFullScreen ? 'Exit full screen' : 'Full screen'}
              title={isFullScreen ? 'Standard drawer' : 'Full screen'}
            >
              {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Close chat"
              title="Close chat"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Collapsible In-Chat Search Bar */}
        {isSearching && (
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200/80 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
            <Search size={16} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search conversation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs text-gray-900 focus:outline-hidden"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-gray-400 hover:text-gray-600 p-0.5"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* Vanish Mode Banner */}
        {isVanishMode && (
          <div className="px-4 py-1.5 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border-b border-amber-200/50 flex items-center justify-between text-xs text-amber-700 animate-in fade-in duration-200">
            <div className="flex items-center gap-1.5 font-medium text-[11px]">
              <Flame size={13} className="text-amber-500 animate-pulse" />
              <span>Vanish Mode is active — messages disappear after viewing</span>
            </div>
            <button
              onClick={handleToggleVanishMode}
              className="text-[10px] underline font-semibold text-amber-800 hover:text-amber-900"
            >
              Turn off
            </button>
          </div>
        )}

        {/* Call History Panel */}
        {showCallHistory && (
          <div className="px-4 py-3 bg-purple-50/70 border-b border-purple-100 animate-in slide-in-from-top-2 duration-150 max-h-56 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 font-bold text-xs text-purple-900">
                <History size={14} className="text-purple-600" />
                <span>Call History</span>
              </div>
              <button
                onClick={() => setShowCallHistory(false)}
                className="text-purple-400 hover:text-purple-700 p-0.5 rounded-full"
              >
                <X size={14} />
              </button>
            </div>

            {loadingCallLogs ? (
              <div className="py-4 flex items-center justify-center text-xs text-purple-500 gap-2">
                <Loader2 size={14} className="animate-spin" />
                <span>Loading call records...</span>
              </div>
            ) : callLogs.length === 0 ? (
              <div className="py-4 text-center text-xs text-purple-500/80">
                No calls yet with @{partner.username}.
              </div>
            ) : (
              <div className="space-y-1.5">
                {callLogs.map((log) => {
                  const isOutgoing = log.caller_id === currentUserId
                  const isVideo = log.call_type === 'video'
                  const isMissed = log.status === 'missed' || log.status === 'declined'

                  return (
                    <div
                      key={log.id}
                      className="flex items-center justify-between bg-white/90 p-2 rounded-xl border border-purple-100 shadow-2xs text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center ${
                            isMissed
                              ? 'bg-red-50 text-red-500'
                              : 'bg-emerald-50 text-emerald-600'
                          }`}
                        >
                          {isMissed ? (
                            <PhoneMissed size={13} />
                          ) : isOutgoing ? (
                            <PhoneOutgoing size={13} />
                          ) : (
                            <PhoneIncoming size={13} />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-[11px] leading-tight flex items-center gap-1">
                            {isVideo ? <Video size={11} className="text-purple-500" /> : <Phone size={11} className="text-purple-500" />}
                            <span>{isOutgoing ? 'Outgoing' : 'Incoming'} {isVideo ? 'Video' : 'Voice'}</span>
                          </p>
                          <p className="text-[10px] text-gray-500 font-mono">
                            {log.duration_seconds > 0
                              ? `${Math.floor(log.duration_seconds / 60)}m ${log.duration_seconds % 60}s`
                              : log.status === 'declined'
                              ? 'Declined'
                              : 'Missed'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400">
                          {new Date(log.created_at).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          })}{' '}
                          {new Date(log.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <button
                          onClick={() => handleStartCall(isVideo ? 'video' : 'audio')}
                          className="p-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 transition-colors"
                          title="Call back"
                        >
                          <Phone size={12} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

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
            messages
              .filter((m) => {
                if (!searchQuery.trim()) return true
                return (m.content || '').toLowerCase().includes(searchQuery.toLowerCase())
              })
              .map((msg) => {
              const isMe = msg.sender_id === currentUserId
              const isTemp = msg.id.startsWith?.('temp-')
              const hasImage = !!msg.image_url
              const hasVideo = !!msg.video_url
              const hasAudio = !!msg.audio_url
              const isPlayingThis = playingAudioId === msg.id
              const showText =
                msg.content &&
                msg.content !== '📷 Photo' &&
                msg.content !== '🎥 Video' &&
                msg.content !== '🎙️ Voice note'
              const reactionsObj = msg.reactions || {}
              const reactionEntries = Object.entries(reactionsObj).filter(
                ([_, users]: any) => Array.isArray(users) && users.length > 0
              )
              const hasQuotedReply = Boolean(msg.reply_to_content)

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group relative`}
                  onMouseEnter={() => setActiveReactionMsgId(msg.id)}
                  onMouseLeave={() => {
                    if (activeReactionMsgId === msg.id) {
                      setActiveReactionMsgId(null)
                    }
                  }}
                >
                  {/* Floating Action Dock: Reactions & Reply Quote (Instagram style) */}
                  {!isTemp && activeReactionMsgId === msg.id && (
                    <div
                      className={`absolute -top-7 ${
                        isMe ? 'right-2' : 'left-2'
                      } z-20 flex items-center bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-full shadow-lg border border-gray-200/90 py-0.5 px-2 gap-1 animate-in fade-in zoom-in-95 duration-150`}
                    >
                      {['❤️', '😂', '🔥', '😮', '😢', '👏'].map((emoji) => {
                        const users: string[] = reactionsObj[emoji] || []
                        const hasReacted = users.includes(currentUserId)
                        return (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleToggleReaction(msg.id, emoji)}
                            className={`text-sm hover:scale-125 transition-transform px-1 py-0.5 rounded-full ${
                              hasReacted ? 'bg-brand-100 scale-110' : ''
                            }`}
                            title={`React ${emoji}`}
                          >
                            {emoji}
                          </button>
                        )
                      })}

                      <div className="w-[1px] h-3.5 bg-gray-200 mx-0.5" />

                      {/* Reply Button */}
                      <button
                        type="button"
                        onClick={() =>
                          setReplyingTo({
                            id: msg.id,
                            content: msg.content || (hasImage ? 'Photo' : hasVideo ? 'Video' : 'Voice note'),
                            senderName: isMe ? 'You' : partner.displayName,
                          })
                        }
                        className="p-1 rounded-full text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                        title="Reply to message"
                      >
                        <ReplyIcon size={13} />
                      </button>
                    </div>
                  )}

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
                      className={`max-w-[84%] rounded-2xl text-xs leading-relaxed overflow-hidden transition-all ${
                        isMe
                          ? msg.is_disappearing
                            ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-br-xs shadow-md border border-orange-400/40'
                            : 'bg-brand-600 text-white rounded-br-xs shadow-xs'
                          : msg.is_disappearing
                          ? 'bg-amber-50/90 text-amber-950 border border-amber-300/80 rounded-bl-xs shadow-xs'
                          : 'bg-white text-gray-900 border border-gray-200/80 rounded-bl-xs shadow-xs'
                      } ${isTemp ? 'opacity-70' : ''}`}
                    >
                      {/* Quoted Message Preview Header */}
                      {hasQuotedReply && (
                        <div
                          className={`mx-2.5 mt-2 px-2.5 py-1.5 rounded-lg border-l-2 text-[11px] line-clamp-2 ${
                            isMe
                              ? 'bg-white/15 border-white/80 text-white/90'
                              : 'bg-gray-100/90 border-brand-500 text-gray-700'
                          }`}
                        >
                          <span className="font-bold block text-[10px] opacity-80">
                            {msg.reply_to_sender || 'Replied to'}
                          </span>
                          <span className="truncate block">{msg.reply_to_content}</span>
                        </div>
                      )}

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

                      {/* Video Attachment */}
                      {hasVideo && (
                        <div className="relative overflow-hidden max-w-sm bg-black rounded-lg">
                          <video
                            src={msg.video_url}
                            controls
                            playsInline
                            className="w-full max-h-72 object-contain"
                          />
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

                  {/* Reaction Badges Below Message */}
                  {reactionEntries.length > 0 && (
                    <div
                      className={`flex flex-wrap gap-1 mt-1 ${
                        isMe ? 'justify-end' : 'justify-start'
                      } px-1`}
                    >
                      {reactionEntries.map(([emoji, users]: any) => {
                        const hasReacted = users.includes(currentUserId)
                        return (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleToggleReaction(msg.id, emoji)}
                            className={`flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full border shadow-2xs transition-transform active:scale-95 ${
                              hasReacted
                                ? 'bg-brand-50 border-brand-300 text-brand-700 font-semibold'
                                : 'bg-white border-gray-200 text-gray-700'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span className="text-[10px]">{users.length}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}

                  <span className="text-[10px] text-gray-400 mt-1 px-1 flex items-center gap-1">
                    {msg.is_disappearing && (
                      <span title="Disappearing message">
                        <Flame size={11} className="text-amber-500" />
                      </span>
                    )}
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

        {/* Replying-To Banner */}
        {replyingTo && (
          <div className="px-4 py-2 border-t border-gray-100 bg-brand-50/60 flex items-center justify-between animate-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-center gap-2 overflow-hidden">
              <ReplyIcon size={14} className="text-brand-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-brand-900 truncate">
                  Replying to {replyingTo.senderName}
                </p>
                <p className="text-[11px] text-gray-600 truncate">{replyingTo.content}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-200"
            >
              <X size={15} />
            </button>
          </div>
        )}

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

        {/* Selected Video Preview Bar */}
        {videoPreview && (
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200 relative bg-black flex items-center justify-center">
                <Film size={20} className="text-white" />
              </div>
              <span className="text-xs text-gray-600 font-medium truncate max-w-[200px]">
                {videoFile?.name || 'Video selected'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleRemoveVideo}
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
            <input
              type="file"
              ref={videoInputRef}
              onChange={handleVideoSelect}
              accept="video/*"
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

            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className="p-2.5 rounded-xl text-gray-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
              title="Attach Video"
            >
              <Film size={19} />
            </button>

            <input
              type="text"
              placeholder={imageFile ? "Add a caption..." : videoFile ? "Add video caption..." : "Type a message..."}
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              disabled={sending}
              className="input-field text-xs py-2.5 px-3.5 flex-1 rounded-xl focus:border-brand-500"
              autoFocus
            />

            {text.trim() || imageFile || videoFile ? (
              <button
                type="submit"
                disabled={sending || (!text.trim() && !imageFile && !videoFile)}
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

      {/* Voice & Video Call Modal */}
      <DMCallModal
        isOpen={isCallOpen}
        callType={callType}
        callStatus={callStatus}
        partner={partner}
        isIncoming={isIncomingCall}
        callId={activeCallId}
        conversationId={conversationId}
        channel={channelRef.current}
        currentUserId={currentUserId}
        onAccept={handleAcceptCall}
        onDecline={handleDeclineCall}
        onEndCall={handleEndCall}
        onToggleMute={() => {}}
        onToggleCamera={() => {}}
        onToggleSpeaker={() => {}}
      />
    </>
  )
}
