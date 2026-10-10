import React, { useState, useEffect, useRef } from 'react'
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  AppState,
  type AppStateStatus,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  X,
  Send,
  Check,
  CheckCheck,
  Image as ImageIcon,
  Trash2,
  Mic,
  Square,
  Play,
  Pause,
  Volume2,
  Phone,
  Video,
  PhoneOff,
  MicOff,
  VideoOff,
  VolumeX,
  SwitchCamera,
  ShieldCheck,
  Flame,
  Reply,
  History,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Search,
  Smile,
} from 'lucide-react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { Audio } from 'expo-av'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'
import { useTheme } from '../context/ThemeContext'
import type { DMCallType, DMCallStatus } from '@private-voices/shared'

interface ChatPartner {
  id: string
  username: string
  displayName?: string
  display_name?: string
  avatarUrl?: string | null
  avatar_url?: string | null
}

interface ChatModalProps {
  visible: boolean
  conversationId: string
  partner: ChatPartner | null
  currentUserId: string
  onClose: () => void
}

export function ChatModal({
  visible,
  conversationId,
  partner,
  currentUserId,
  onClose,
}: ChatModalProps) {
  const { colors: themeColors, isDark } = useTheme()
  const [messages, setMessages] = useState<any[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [fullscreenImageUrl, setFullscreenImageUrl] = useState<string | null>(null)

  // Reply quoting
  const [replyingTo, setReplyingTo] = useState<{
    id: string
    content: string
    senderName: string
  } | null>(null)

  // Long-press reaction modal / picker
  const [reactionModalMsgId, setReactionModalMsgId] = useState<string | null>(null)

  // Vanishing mode
  const [isVanishMode, setIsVanishMode] = useState(false)

  // Call history modal/sheet
  const [showCallHistory, setShowCallHistory] = useState(false)
  const [callLogs, setCallLogs] = useState<any[]>([])
  const [loadingCallLogs, setLoadingCallLogs] = useState(false)

  // In-chat search
  const [isSearching, setIsSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Voice & Video Calling State
  const [isCallOpen, setIsCallOpen] = useState(false)
  const [callType, setCallType] = useState<DMCallType>('audio')
  const [callStatus, setCallStatus] = useState<DMCallStatus>('idle')
  const [isIncomingCall, setIsIncomingCall] = useState(false)
  const [activeCallId, setActiveCallId] = useState<string | null>(null)
  const [callMuted, setCallMuted] = useState(false)
  const [callCameraOff, setCallCameraOff] = useState(false)
  const [callSpeakerOn, setCallSpeakerOn] = useState(true)
  const [callDuration, setCallDuration] = useState(0)
  const callTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Presence & Typing State
  const [isPartnerTyping, setIsPartnerTyping] = useState(false)
  const [isPartnerOnline, setIsPartnerOnline] = useState(false)

  // Voice Note / Audio Whisper State
  const [recording, setRecording] = useState<Audio.Recording | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null)
  const [soundObject, setSoundObject] = useState<Audio.Sound | null>(null)
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.5 | 2>(1)
  const [playbackPosition, setPlaybackPosition] = useState<number>(0)
  const [playbackDuration, setPlaybackDuration] = useState<number>(1)
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)

  const flatListRef = useRef<FlatList>(null)
  const channelRef = useRef<any>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const partnerId = partner?.id || ''
  const partnerName = partner?.displayName || partner?.display_name || partner?.username || 'User'
  const partnerUsername = partner?.username || 'user'
  const partnerAvatar = partner?.avatarUrl || partner?.avatar_url || null

  useEffect(() => {
    if (!visible || !conversationId) return

    async function loadMessages() {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })

        if (error) {
          console.error('Error loading messages:', error)
        } else {
          setMessages(data ?? [])
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: false })
          }, 150)
        }

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
          // Ignore if column not present yet
        }

        // Mark unread messages as read
        await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('conversation_id', conversationId)
          .neq('sender_id', currentUserId)
      } catch (err) {
        console.error('Failed to load messages:', err)
      } finally {
        setLoading(false)
      }
    }

    loadMessages()

    // Realtime channel with Broadcast & Presence
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
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true })
          }, 100)

          // Auto-mark incoming message as read
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
            prev.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m))
          )
        }
      )
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload?.userId !== currentUserId) {
          setIsPartnerTyping(!!payload?.isTyping)
          if (payload?.isTyping) {
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true })
            }, 100)
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
        } else if (payload.action === 'call_accept') {
          setCallStatus('connected')
        } else if (payload.action === 'call_decline') {
          setCallStatus('declined')
          setTimeout(() => {
            setIsCallOpen(false)
            setCallStatus('idle')
          }, 1800)
        } else if (payload.action === 'call_end') {
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
          presences.some((p: any) => p.user_id === partnerId)
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

      // Cleanup audio playback & recording if unmounting
      if (soundObject) {
        soundObject.unloadAsync().catch(() => {})
      }
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => {})
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current)
      }
    }
  }, [visible, conversationId, currentUserId, partnerId])

  // Timer for connected call duration
  useEffect(() => {
    if (callStatus === 'connected') {
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current)
      setCallDuration(0)
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current)
    }
  }, [callStatus])

  // Mobile Call Handlers
  const mobileCallStartTimeRef = useRef<number | null>(null)

  async function logMobileCallRecord(finalStatus: 'connected' | 'missed' | 'declined' | 'ended' | 'cancelled') {
    try {
      const now = Date.now()
      const durationSeconds = mobileCallStartTimeRef.current
        ? Math.max(0, Math.round((now - mobileCallStartTimeRef.current) / 1000))
        : 0

      await supabase.from('dm_call_logs').insert({
        conversation_id: conversationId,
        caller_id: isIncomingCall ? partnerId : currentUserId,
        receiver_id: isIncomingCall ? currentUserId : partnerId,
        call_type: callType,
        status: finalStatus,
        duration_seconds: durationSeconds,
        started_at: mobileCallStartTimeRef.current
          ? new Date(mobileCallStartTimeRef.current).toISOString()
          : new Date().toISOString(),
        ended_at: new Date(now).toISOString(),
      })
      loadMobileCallLogs()
    } catch (e) {
      console.warn('Could not record mobile dm_call_log:', e)
    }
  }

  async function loadMobileCallLogs() {
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
      console.warn('Error loading mobile call logs:', err)
    } finally {
      setLoadingCallLogs(false)
    }
  }

  function handleToggleCallHistory() {
    const nextVal = !showCallHistory
    setShowCallHistory(nextVal)
    if (nextVal) {
      loadMobileCallLogs()
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
      await supabase
        .from('conversations')
        .update({ vanish_mode_enabled: nextVal })
        .eq('id', conversationId)
    }
  }

  async function handleToggleReaction(messageId: string, emoji: string) {
    setReactionModalMsgId(null)

    // Optimistic UI update
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
      await supabase.rpc('toggle_dm_reaction', {
        p_message_id: messageId,
        p_emoji: emoji,
      })
    } catch (err) {
      console.error('Error toggling reaction on mobile:', err)
    }
  }

  function handleStartCall(type: DMCallType) {
    const newCallId = `call-${Date.now()}`
    setActiveCallId(newCallId)
    setCallType(type)
    setCallStatus('outgoing_ringing')
    setIsIncomingCall(false)
    setIsCallOpen(true)
    mobileCallStartTimeRef.current = Date.now()

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
        receiver: {
          id: partnerId,
          username: partnerUsername,
          displayName: partnerName,
          avatarUrl: partnerAvatar,
        },
        timestamp: Date.now(),
      },
    })
  }

  function handleAcceptCall() {
    setCallStatus('connected')
    mobileCallStartTimeRef.current = Date.now()
    channelRef.current?.send({
      type: 'broadcast',
      event: 'call_signal',
      payload: {
        callId: activeCallId,
        conversationId,
        type: callType,
        action: 'call_accept',
        caller: {
          id: partnerId,
          username: partnerUsername,
          displayName: partnerName,
        },
        receiver: { id: currentUserId, username: 'you', displayName: 'You' },
        timestamp: Date.now(),
      },
    })
  }

  function handleDeclineCall() {
    setCallStatus('declined')
    logMobileCallRecord('declined')
    channelRef.current?.send({
      type: 'broadcast',
      event: 'call_signal',
      payload: {
        callId: activeCallId,
        conversationId,
        type: callType,
        action: 'call_decline',
        caller: {
          id: partnerId,
          username: partnerUsername,
          displayName: partnerName,
        },
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
    const finalStatus = callStatus === 'connected' ? 'ended' : 'cancelled'
    setCallStatus('ended')
    logMobileCallRecord(finalStatus)
    channelRef.current?.send({
      type: 'broadcast',
      event: 'call_signal',
      payload: {
        callId: activeCallId,
        conversationId,
        type: callType,
        action: 'call_end',
        caller: {
          id: partnerId,
          username: partnerUsername,
          displayName: partnerName,
        },
        receiver: { id: currentUserId, username: 'you', displayName: 'You' },
        timestamp: Date.now(),
      },
    })
    setTimeout(() => {
      setIsCallOpen(false)
      setCallStatus('idle')
    }, 1200)
  }

  // Handle AppState lifecycle: pause audio or cancel recording when app goes to background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState.match(/inactive|background/)) {
        if (soundObject) {
          soundObject.pauseAsync().catch(() => {})
          setPlayingAudioId(null)
        }
      }
    })

    return () => {
      subscription.remove()
    }
  }, [soundObject])

  // --- Voice Note / Audio Whisper Functions ---
  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync()
      if (permission.status !== 'granted') {
        Alert.alert('Microphone Access', 'Permission to access the microphone is required for voice notes.')
        return
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      )
      setRecording(newRecording)
      setIsRecording(true)
      setRecordingDuration(0)

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1)
      }, 1000)
    } catch (err: any) {
      console.error('Failed to start recording:', err)
      Alert.alert('Recording Failed', 'Could not start audio recording.')
    }
  }

  async function cancelRecording() {
    try {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
      if (recording) {
        await recording.stopAndUnloadAsync()
      }
      setRecording(null)
      setIsRecording(false)
      setRecordingDuration(0)
    } catch (err) {
      console.error('Failed to cancel recording:', err)
    }
  }

  async function stopAndSendRecording() {
    if (!recording) return
    try {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
      setIsRecording(false)
      const duration = recordingDuration
      setRecordingDuration(0)

      await recording.stopAndUnloadAsync()
      const uri = recording.getURI()
      setRecording(null)

      if (!uri) {
        Alert.alert('Recording Error', 'No recorded audio found.')
        return
      }

      await sendAudioMessage(uri, duration)
    } catch (err: any) {
      console.error('Failed to stop and send recording:', err)
      Alert.alert('Error', 'Failed to save voice note.')
    }
  }

  async function sendAudioMessage(audioUri: string, durationSec: number) {
    setSending(true)
    const tempId = 'temp-audio-' + Date.now()
    const optimisticMsg = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: '🎙️ Voice note',
      audio_url: audioUri,
      audio_duration: durationSec,
      is_read: false,
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, optimisticMsg])
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true })
    }, 100)

    try {
      // Upload audio file to Supabase storage
      const fileExt = Platform.OS === 'ios' ? 'm4a' : 'caf'
      const fileName = `voice-notes/${conversationId}/${Date.now()}.${fileExt}`
      const response = await fetch(audioUri)
      const blob = await response.blob()
      const arrayBuffer = await new Response(blob).arrayBuffer()

      let uploadRes = await supabase.storage
        .from('chat-media')
        .upload(fileName, arrayBuffer, {
          contentType: Platform.OS === 'ios' ? 'audio/m4a' : 'audio/x-caf',
          upsert: true,
        })

      if (uploadRes.error) {
        uploadRes = await supabase.storage
          .from('stories')
          .upload(`chat/${fileName}`, arrayBuffer, {
            contentType: 'audio/m4a',
            upsert: true,
          })
      }

      let uploadedAudioUrl = audioUri
      if (uploadRes.data) {
        const bucket = uploadRes.data.path.startsWith('chat/') ? 'stories' : 'chat-media'
        const { data: publicUrlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(uploadRes.data.path)
        uploadedAudioUrl = publicUrlData.publicUrl
      }

      const { data: newMsg, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: '🎙️ Voice note',
          audio_url: uploadedAudioUrl,
          audio_duration: durationSec,
        })
        .select('*')
        .single()

      if (error) {
        console.error('Failed to send audio message:', error)
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        Alert.alert('Send Failed', error.message || 'Unable to send voice note.')
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
    } catch (err: any) {
      console.error('Error uploading voice note:', err)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      Alert.alert('Send Failed', 'Could not upload voice note.')
    } finally {
      setSending(false)
    }
  }

  async function handleToggleAudio(msgId: string, audioUrl: string) {
    try {
      if (playingAudioId === msgId) {
        // Stop current
        if (soundObject) {
          await soundObject.stopAsync()
          await soundObject.unloadAsync()
        }
        setSoundObject(null)
        setPlayingAudioId(null)
        setPlaybackPosition(0)
        return
      }

      if (soundObject) {
        await soundObject.stopAsync()
        await soundObject.unloadAsync()
      }

      // Configure background playback & interruption mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      })

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true, rate: playbackSpeed, shouldCorrectPitch: true }
      )

      setSoundObject(sound)
      setPlayingAudioId(msgId)

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          if (status.durationMillis) {
            setPlaybackDuration(status.durationMillis)
            setPlaybackPosition(status.positionMillis)
          }
          if (status.didJustFinish) {
            setPlayingAudioId(null)
            setSoundObject(null)
            setPlaybackPosition(0)
          }
        }
      })
    } catch (err) {
      console.error('Error playing audio:', err)
      Alert.alert('Playback Error', 'Could not play audio message.')
      setPlayingAudioId(null)
      setSoundObject(null)
      setPlaybackPosition(0)
    }
  }

  async function handleTogglePlaybackSpeed() {
    const nextSpeed: 1 | 1.5 | 2 = playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1
    setPlaybackSpeed(nextSpeed)
    if (soundObject) {
      await soundObject.setRateAsync(nextSpeed, true).catch(() => {})
    }
  }

  async function handleScrubWaveform(fraction: number) {
    if (!soundObject || !playbackDuration) return
    const targetMs = Math.round(fraction * playbackDuration)
    setPlaybackPosition(targetMs)
    await soundObject.setPositionAsync(targetMs).catch(() => {})
  }

  function formatAudioDuration(sec: number) {
    const mins = Math.floor(sec / 60)
    const secs = sec % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
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

  async function handlePickImage() {
    Alert.alert('Send Photo', 'Choose an option to attach a photo', [
      {
        text: 'Camera',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync()
          if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Camera permission is required.')
            return
          }
          const result = await ImagePicker.launchCameraAsync({
            quality: 0.8,
            allowsEditing: true,
          })
          if (!result.canceled && result.assets[0]?.uri) {
            setSelectedImage(result.assets[0].uri)
          }
        },
      },
      {
        text: 'Photo Library',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
          if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Photo library permission is required.')
            return
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            allowsEditing: true,
          })
          if (!result.canceled && result.assets[0]?.uri) {
            setSelectedImage(result.assets[0].uri)
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  async function handleSend() {
    if ((!text.trim() && !selectedImage) || sending || !conversationId) return

    // Immediately cancel typing status
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    channelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: currentUserId, isTyping: false },
    })

    const messageContent = text.trim() || '📷 Photo'
    const imageUriToSend = selectedImage
    const quotedReply = replyingTo

    setText('')
    setSelectedImage(null)
    setReplyingTo(null)
    setSending(true)

    // Optimistic message
    const tempId = `temp-${Date.now()}`
    const optimisticMsg = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: messageContent,
      image_url: imageUriToSend,
      media_type: imageUriToSend ? 'image' : 'text',
      is_disappearing: isVanishMode,
      reply_to_message_id: quotedReply?.id || null,
      reply_to_content: quotedReply?.content || null,
      reply_to_sender: quotedReply?.senderName || null,
      reactions: {},
      is_read: false,
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, optimisticMsg])
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true })
    }, 50)

    try {
      let uploadedUrl: string | null = null

      if (imageUriToSend) {
        try {
          const fileExt = imageUriToSend.split('.').pop()?.split('?')[0] || 'jpg'
          const fileName = `${currentUserId}/${Date.now()}.${fileExt}`

          const response = await fetch(imageUriToSend)
          const blob = await response.blob()
          const arrayBuffer = await new Response(blob).arrayBuffer()

          let uploadRes = await supabase.storage
            .from('chat-media')
            .upload(fileName, arrayBuffer, {
              contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
              upsert: true,
            })

          if (uploadRes.error) {
            uploadRes = await supabase.storage
              .from('stories')
              .upload(`chat/${fileName}`, arrayBuffer, {
                contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
                upsert: true,
              })
          }

          if (uploadRes.data) {
            const bucket = uploadRes.data.path.startsWith('chat/') ? 'stories' : 'chat-media'
            const { data: publicUrlData } = supabase.storage
              .from(bucket)
              .getPublicUrl(uploadRes.data.path)

            uploadedUrl = publicUrlData.publicUrl
          }
        } catch (uploadErr) {
          console.error('Error uploading chat image:', uploadErr)
        }
      }

      const { data: newMsg, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: messageContent,
          image_url: uploadedUrl,
          media_type: uploadedUrl ? 'image' : 'text',
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
        Alert.alert('Send Failed', error.message || 'Unable to send message.')
      } else if (newMsg) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? newMsg : m)))

        // Update conversation last_message & timestamp
        await supabase
          .from('conversations')
          .update({
            last_message: messageContent,
            last_message_at: new Date().toISOString(),
          })
          .eq('id', conversationId)
      }
    } catch (err: any) {
      console.error('Error sending message:', err)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      Alert.alert('Send Failed', err.message || 'Network error sending message.')
    } finally {
      setSending(false)
    }
  }

  function handleDeleteMessage(msgId: string) {
    Alert.alert(
      'Delete Message',
      'Delete this message for everyone?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Optimistic removal
            setMessages((prev) => prev.filter((m) => m.id !== msgId))
            const { error } = await supabase.from('messages').delete().eq('id', msgId)
            if (error) {
              // Restore on failure by re-fetching
              const { data } = await supabase
                .from('messages')
                .select('*')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true })
              setMessages(data ?? [])
              Alert.alert('Error', 'Failed to delete message. Please try again.')
            }
          },
        },
      ],
      { cancelable: true }
    )
  }

  function formatTime(isoString: string) {
    try {
      const date = new Date(isoString)
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={[styles.keyboardContainer, { backgroundColor: themeColors.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        >
          {/* Header */}
          <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.surfaceBorder }]}>
            <View style={styles.headerLeft}>
              <View style={styles.avatarWrapper}>
                <View style={[styles.avatarCircle, { backgroundColor: isDark ? '#27272a' : colors.brandLight }]}>
                  {partnerAvatar ? (
                    <Image source={{ uri: partnerAvatar }} style={styles.avatarImg} />
                  ) : (
                    <Text style={styles.avatarLetter}>
                      {partnerName.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
                {isPartnerOnline && <View style={styles.onlineBadge} />}
              </View>

              <View style={styles.headerInfo}>
                <Text style={[styles.headerName, { color: themeColors.text }]} numberOfLines={1}>
                  {partnerName}
                </Text>
                <Text style={[styles.headerUsername, { color: themeColors.textSecondary }]} numberOfLines={1}>
                  {isPartnerTyping ? (
                    <Text style={styles.typingStatusText}>typing...</Text>
                  ) : isPartnerOnline ? (
                    <Text style={styles.onlineStatusText}>Online</Text>
                  ) : (
                    `@${partnerUsername}`
                  )}
                </Text>
              </View>
            </View>

            <View style={styles.headerRightActions}>
              {/* Search toggle */}
              <TouchableOpacity
                onPress={() => setIsSearching((prev) => !prev)}
                style={[
                  styles.headerCallBtn,
                  { backgroundColor: isSearching ? colors.brandLight : isDark ? '#27272a' : '#f4f4f5' },
                ]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Search size={18} color={isSearching ? colors.brand : themeColors.text} />
              </TouchableOpacity>

              {/* Vanish Mode Toggle */}
              <TouchableOpacity
                onPress={handleToggleVanishMode}
                style={[
                  styles.headerCallBtn,
                  { backgroundColor: isVanishMode ? '#fff7ed' : isDark ? '#27272a' : '#f4f4f5' },
                ]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Flame size={19} color={isVanishMode ? '#f97316' : themeColors.textSecondary} />
              </TouchableOpacity>

              {/* Call History Button */}
              <TouchableOpacity
                onPress={handleToggleCallHistory}
                style={[
                  styles.headerCallBtn,
                  { backgroundColor: showCallHistory ? '#f3e8ff' : isDark ? '#27272a' : '#f4f4f5' },
                ]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <History size={18} color={showCallHistory ? '#9333ea' : themeColors.text} />
              </TouchableOpacity>

              {/* Phone Voice Call Button */}
              <TouchableOpacity
                onPress={() => handleStartCall('audio')}
                style={[styles.headerCallBtn, { backgroundColor: isDark ? '#27272a' : '#f4f4f5' }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Phone size={19} color={themeColors.text} />
              </TouchableOpacity>

              {/* Video Call Button */}
              <TouchableOpacity
                onPress={() => handleStartCall('video')}
                style={[styles.headerCallBtn, { backgroundColor: isDark ? '#27272a' : '#f4f4f5' }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Video size={20} color={themeColors.text} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onClose}
                style={[styles.closeBtn, { backgroundColor: themeColors.surfaceBorder }]}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <X size={22} color={themeColors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Bar */}
          {isSearching && (
            <View style={[styles.mobileSearchBar, { backgroundColor: themeColors.surfaceBorder }]}>
              <Search size={16} color={themeColors.textSecondary} />
              <TextInput
                style={[styles.mobileSearchInput, { color: themeColors.text }]}
                placeholder="Search messages..."
                placeholderTextColor={themeColors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={16} color={themeColors.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {/* Vanish Mode Active Banner */}
          {isVanishMode && (
            <View style={styles.mobileVanishBanner}>
              <Flame size={14} color="#f97316" />
              <Text style={styles.mobileVanishText}>
                Vanish Mode: Messages disappear after viewing
              </Text>
            </View>
          )}

          {/* Call History Dropdown Panel */}
          {showCallHistory && (
            <View style={[styles.mobileCallHistoryPanel, { backgroundColor: isDark ? '#18181b' : '#faf5ff' }]}>
              <View style={styles.callHistoryHeaderRow}>
                <Text style={styles.callHistoryTitle}>Recent Calls</Text>
                <TouchableOpacity onPress={() => setShowCallHistory(false)}>
                  <X size={16} color={themeColors.textSecondary} />
                </TouchableOpacity>
              </View>

              {loadingCallLogs ? (
                <View style={{ padding: 12, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#9333ea" />
                </View>
              ) : callLogs.length === 0 ? (
                <Text style={styles.callHistoryEmptyText}>No previous calls recorded.</Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {callLogs.slice(0, 5).map((log) => {
                    const isOutgoing = log.caller_id === currentUserId
                    const isVideo = log.call_type === 'video'
                    const isMissed = log.status === 'missed' || log.status === 'declined'

                    return (
                      <View
                        key={log.id}
                        style={[
                          styles.mobileCallLogItem,
                          { backgroundColor: isDark ? '#27272a' : '#ffffff' },
                        ]}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View
                            style={[
                              styles.callLogIconBadge,
                              { backgroundColor: isMissed ? '#fef2f2' : '#f0fdf4' },
                            ]}
                          >
                            {isMissed ? (
                              <PhoneMissed size={14} color="#ef4444" />
                            ) : isOutgoing ? (
                              <PhoneOutgoing size={14} color="#16a34a" />
                            ) : (
                              <PhoneIncoming size={14} color="#16a34a" />
                            )}
                          </View>
                          <View>
                            <Text style={[styles.callLogTitleText, { color: themeColors.text }]}>
                              {isOutgoing ? 'Outgoing' : 'Incoming'} {isVideo ? 'Video' : 'Voice'}
                            </Text>
                            <Text style={styles.callLogDurationText}>
                              {log.duration_seconds > 0
                                ? `${Math.floor(log.duration_seconds / 60)}m ${log.duration_seconds % 60}s`
                                : log.status === 'declined'
                                ? 'Declined'
                                : 'Missed'}
                            </Text>
                          </View>
                        </View>

                        <TouchableOpacity
                          style={styles.callBackBtn}
                          onPress={() => {
                            setShowCallHistory(false)
                            handleStartCall(isVideo ? 'video' : 'audio')
                          }}
                        >
                          <Phone size={13} color="#ffffff" />
                        </TouchableOpacity>
                      </View>
                    )
                  })}
                </View>
              )}
            </View>
          )}

          {/* Messages */}
          <View style={styles.messagesContainer}>
            {loading ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color={colors.brand} />
                <Text style={styles.loadingText}>Loading conversation...</Text>
              </View>
            ) : messages.length === 0 ? (
              <View style={styles.centerBox}>
                <Text style={styles.emptyEmoji}>👋</Text>
                <Text style={styles.emptyTitle}>Say hello to {partnerName}!</Text>
                <Text style={styles.emptyDesc}>
                  Start your conversation. Direct messages and photos are private and identity-verified.
                </Text>
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={messages.filter((m) => {
                  if (!searchQuery.trim()) return true
                  return (m.content || '').toLowerCase().includes(searchQuery.toLowerCase())
                })}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                renderItem={({ item }) => {
                  const isMe = item.sender_id === currentUserId
                  const isTemp = String(item.id).startsWith('temp-')
                  const hasImage = !!item.image_url
                  const hasAudio = !!item.audio_url
                  const isPlayingThisAudio = playingAudioId === item.id
                  const showText = item.content && item.content !== '📷 Photo' && item.content !== '🎙️ Voice note'
                  const reactionsObj = item.reactions || {}
                  const reactionEntries = Object.entries(reactionsObj).filter(
                    ([_, users]: any) => Array.isArray(users) && users.length > 0
                  )
                  const hasQuotedReply = Boolean(item.reply_to_content)

                  return (
                    <View
                      style={[
                        styles.messageRow,
                        isMe ? styles.messageRowMe : styles.messageRowThem,
                      ]}
                    >
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onLongPress={() => {
                          if (!isTemp) {
                            setReactionModalMsgId(item.id)
                          }
                        }}
                        delayLongPress={250}
                      >
                        <View
                          style={[
                            styles.bubble,
                            isMe
                              ? item.is_disappearing
                                ? styles.bubbleMeDisappearing
                                : styles.bubbleMe
                              : item.is_disappearing
                              ? styles.bubbleThemDisappearing
                              : [styles.bubbleThem, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }],
                            isTemp && styles.bubblePending,
                            hasImage && styles.bubbleWithImage,
                            hasAudio && styles.bubbleWithAudio,
                          ]}
                        >
                          {/* Quoted Reply Preview */}
                          {hasQuotedReply && (
                            <View
                              style={[
                                styles.mobileQuotePreview,
                                isMe ? styles.mobileQuotePreviewMe : styles.mobileQuotePreviewThem,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.mobileQuoteSender,
                                  { color: isMe ? '#ffffff' : colors.brand },
                                ]}
                                numberOfLines={1}
                              >
                                {item.reply_to_sender || 'Replied to'}
                              </Text>
                              <Text
                                style={[
                                  styles.mobileQuoteText,
                                  { color: isMe ? '#f4f4f5' : themeColors.textSecondary },
                                ]}
                                numberOfLines={2}
                              >
                                {item.reply_to_content}
                              </Text>
                            </View>
                          )}

                          {/* Media image */}
                          {hasImage && (
                            <TouchableOpacity
                              onPress={() => setFullscreenImageUrl(item.image_url)}
                              activeOpacity={0.9}
                            >
                              <Image
                                source={{ uri: item.image_url }}
                                style={styles.chatImage}
                                contentFit="cover"
                              />
                            </TouchableOpacity>
                          )}

                          {/* Voice Note / Audio Whisper Player */}
                          {hasAudio && (
                            <View style={[styles.audioBubbleContainer, isMe ? styles.audioBubbleMe : styles.audioBubbleThem]}>
                              <TouchableOpacity
                                style={[styles.audioPlayBtn, isMe ? styles.audioPlayBtnMe : styles.audioPlayBtnThem]}
                                onPress={() => handleToggleAudio(item.id, item.audio_url)}
                                activeOpacity={0.8}
                              >
                                {isPlayingThisAudio ? (
                                  <Pause size={18} color={isMe ? colors.brand : '#ffffff'} />
                                ) : (
                                  <Play size={18} color={isMe ? colors.brand : '#ffffff'} style={{ marginLeft: 2 }} />
                                )}
                              </TouchableOpacity>

                              <View style={styles.audioWaveformSection}>
                                <View style={styles.waveformBars}>
                                  {[40, 70, 45, 90, 60, 100, 75, 50, 85, 40, 65, 95, 55, 30].map((h, idx) => {
                                    const barFraction = idx / 14
                                    const currentFraction = isPlayingThisAudio && playbackDuration > 0
                                      ? playbackPosition / playbackDuration
                                      : 0
                                    const isPast = barFraction <= currentFraction

                                    return (
                                      <TouchableOpacity
                                        key={idx}
                                        activeOpacity={0.7}
                                        onPress={() => {
                                          if (isPlayingThisAudio) {
                                            handleScrubWaveform((idx + 1) / 14)
                                          }
                                        }}
                                        style={styles.waveformBarTouch}
                                      >
                                        <View
                                          style={[
                                            styles.waveformBar,
                                            { height: `${h}%` },
                                            isPast && styles.waveformBarPlayed,
                                            isMe ? styles.waveformBarMe : styles.waveformBarThem,
                                          ]}
                                        />
                                      </TouchableOpacity>
                                    )
                                  })}
                                </View>
                                <View style={styles.audioMetaRow}>
                                  <Text style={[styles.audioDurationText, isMe ? styles.audioDurationMe : styles.audioDurationThem]}>
                                    {isPlayingThisAudio && playbackPosition > 0
                                      ? `${formatAudioDuration(Math.floor(playbackPosition / 1000))} / `
                                      : ''}
                                    {formatAudioDuration(item.audio_duration || 0)}
                                  </Text>
                                  <View style={styles.audioControlsRight}>
                                    {isPlayingThisAudio && (
                                      <TouchableOpacity
                                        onPress={handleTogglePlaybackSpeed}
                                        style={[styles.speedBadge, isMe ? styles.speedBadgeMe : styles.speedBadgeThem]}
                                        activeOpacity={0.8}
                                      >
                                        <Text style={[styles.speedBadgeText, isMe ? styles.speedBadgeTextMe : styles.speedBadgeTextThem]}>
                                          {playbackSpeed}x
                                        </Text>
                                      </TouchableOpacity>
                                    )}
                                    <Text style={[styles.audioTagText, isMe ? styles.audioTagMe : styles.audioTagThem]}>
                                      Audio Whisper
                                    </Text>
                                  </View>
                                </View>
                              </View>
                            </View>
                          )}

                          {/* Text Caption */}
                          {showText && (
                            <Text
                              style={[
                                styles.messageText,
                                isMe ? styles.messageTextMe : [styles.messageTextThem, { color: themeColors.text }],
                                hasImage && styles.captionText,
                              ]}
                            >
                              {item.content}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>

                      {/* Reaction Badges */}
                      {reactionEntries.length > 0 && (
                        <View
                          style={[
                            styles.mobileReactionBadgesRow,
                            isMe ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' },
                          ]}
                        >
                          {reactionEntries.map(([emoji, users]: any) => {
                            const hasReacted = users.includes(currentUserId)
                            return (
                              <TouchableOpacity
                                key={emoji}
                                onPress={() => handleToggleReaction(item.id, emoji)}
                                style={[
                                  styles.mobileReactionBadge,
                                  { backgroundColor: hasReacted ? '#ede9fe' : isDark ? '#27272a' : '#f4f4f5' },
                                ]}
                              >
                                <Text style={styles.mobileReactionEmoji}>{emoji}</Text>
                                <Text style={[styles.mobileReactionCount, { color: hasReacted ? '#7c3aed' : themeColors.text }]}>
                                  {users.length}
                                </Text>
                              </TouchableOpacity>
                            )
                          })}
                        </View>
                      )}

                      <View
                        style={[
                          styles.metaRow,
                          isMe ? styles.metaRowMe : styles.metaRowThem,
                        ]}
                      >
                        {item.is_disappearing ? (
                          <Flame size={12} color="#f97316" style={{ marginRight: 3 }} />
                        ) : null}
                        <Text style={styles.timeText}>{formatTime(item.created_at)}</Text>
                        {isMe && !isTemp && (
                          <View style={styles.receiptContainer}>
                            {item.is_read ? (
                              <CheckCheck size={13} color={colors.brand} />
                            ) : (
                              <Check size={13} color={colors.gray400} />
                            )}
                          </View>
                        )}
                      </View>
                    </View>
                  )
                }}
                ListFooterComponent={
                  isPartnerTyping ? (
                    <View style={styles.typingRow}>
                      <View style={styles.typingBubble}>
                        <View style={styles.typingDot} />
                        <View style={[styles.typingDot, { opacity: 0.7 }]} />
                        <View style={[styles.typingDot, { opacity: 0.4 }]} />
                      </View>
                      <Text style={styles.typingLabel}>{partnerName} is typing...</Text>
                    </View>
                  ) : null
                }
              />
            )}
          </View>

          {/* Replying-To Box */}
          {replyingTo && (
            <View style={[styles.mobileReplyingBar, { backgroundColor: isDark ? '#27272a' : '#f3e8ff' }]}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.mobileReplyingSender}>
                  Replying to {replyingTo.senderName}
                </Text>
                <Text style={[styles.mobileReplyingContent, { color: themeColors.textSecondary }]} numberOfLines={1}>
                  {replyingTo.content}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setReplyingTo(null)}>
                <X size={16} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Image Selected Preview Bar */}
          {selectedImage && (
            <View style={styles.previewBar}>
              <View style={styles.previewThumbContainer}>
                <Image source={{ uri: selectedImage }} style={styles.previewThumb} />
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() => setSelectedImage(null)}
                >
                  <X size={14} color="#ffffff" />
                </TouchableOpacity>
              </View>
              <Text style={styles.previewText}>Photo attached</Text>
            </View>
          )}

          {/* Input Bar or Active Voice Recording Bar */}
          {isRecording ? (
            <View style={[styles.recordingBar, { backgroundColor: themeColors.surface, borderTopColor: themeColors.surfaceBorder }]}>
              <View style={styles.recordingIndicatorRow}>
                <View style={styles.recordingPulseDot} />
                <Text style={styles.recordingTimerText}>Recording: {formatAudioDuration(recordingDuration)}</Text>
              </View>

              <View style={styles.recordingActions}>
                <TouchableOpacity
                  style={styles.recordingCancelBtn}
                  onPress={cancelRecording}
                  activeOpacity={0.7}
                >
                  <Trash2 size={18} color="#ef4444" />
                  <Text style={styles.recordingCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.recordingSendBtn}
                  onPress={stopAndSendRecording}
                  activeOpacity={0.8}
                >
                  <Send size={16} color="#ffffff" />
                  <Text style={styles.recordingSendText}>Send</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={[styles.inputBar, { backgroundColor: themeColors.surface, borderTopColor: themeColors.surfaceBorder }]}>
              <TouchableOpacity
                style={[styles.attachBtn, { backgroundColor: isDark ? '#27272a' : colors.brandLight }]}
                onPress={handlePickImage}
                activeOpacity={0.7}
              >
                <ImageIcon size={20} color={colors.brand} />
              </TouchableOpacity>

              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: themeColors.surfaceBorder,
                    color: themeColors.text,
                    borderColor: themeColors.surfaceBorder,
                  },
                ]}
                placeholder={selectedImage ? "Add a caption..." : `Message @${partnerUsername}...`}
                placeholderTextColor={themeColors.textSecondary}
                value={text}
                onChangeText={handleTextChange}
                multiline
                maxLength={1000}
              />

              {text.trim() || selectedImage ? (
                <TouchableOpacity
                  style={[
                    styles.sendBtn,
                    (!text.trim() && !selectedImage || sending) && styles.sendBtnDisabled,
                  ]}
                  onPress={handleSend}
                  disabled={(!text.trim() && !selectedImage) || sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Send size={18} color="#ffffff" />
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.micBtn}
                  onPress={startRecording}
                  activeOpacity={0.8}
                >
                  <Mic size={20} color="#ffffff" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </KeyboardAvoidingView>

        {/* Long-Press Emoji Reaction & Actions Modal */}
        {reactionModalMsgId && (
          <Modal
            visible={!!reactionModalMsgId}
            transparent
            animationType="fade"
            onRequestClose={() => setReactionModalMsgId(null)}
          >
            <TouchableOpacity
              style={styles.mobileReactionOverlay}
              activeOpacity={1}
              onPress={() => setReactionModalMsgId(null)}
            >
              <View style={[styles.mobileReactionCard, { backgroundColor: isDark ? '#27272a' : '#ffffff' }]}>
                {/* Emoji Reaction Bar */}
                <View style={styles.mobileEmojiBar}>
                  {['❤️', '😂', '🔥', '😮', '😢', '👏'].map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={styles.mobileEmojiBtn}
                      onPress={() => handleToggleReaction(reactionModalMsgId, emoji)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.mobileEmojiText}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Action Options: Reply & Delete */}
                <View style={styles.mobileActionOptions}>
                  <TouchableOpacity
                    style={styles.mobileActionRow}
                    onPress={() => {
                      const target = messages.find((m) => m.id === reactionModalMsgId)
                      if (target) {
                        setReplyingTo({
                          id: target.id,
                          content: target.content || (target.image_url ? 'Photo' : 'Voice note'),
                          senderName: target.sender_id === currentUserId ? 'You' : partnerName,
                        })
                      }
                      setReactionModalMsgId(null)
                    }}
                  >
                    <Reply size={18} color={themeColors.text} />
                    <Text style={[styles.mobileActionText, { color: themeColors.text }]}>Reply</Text>
                  </TouchableOpacity>

                  {messages.find((m) => m.id === reactionModalMsgId)?.sender_id === currentUserId && (
                    <TouchableOpacity
                      style={styles.mobileActionRow}
                      onPress={() => {
                        const targetId = reactionModalMsgId
                        setReactionModalMsgId(null)
                        handleDeleteMessage(targetId)
                      }}
                    >
                      <Trash2 size={18} color="#ef4444" />
                      <Text style={[styles.mobileActionText, { color: '#ef4444' }]}>Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          </Modal>
        )}

        {/* Fullscreen Photo Lightbox Modal */}
        {fullscreenImageUrl && (
          <Modal visible={!!fullscreenImageUrl} transparent animationType="fade">
            <View style={styles.lightboxOverlay}>
              <TouchableOpacity
                style={styles.lightboxCloseBtn}
                onPress={() => setFullscreenImageUrl(null)}
              >
                <X size={26} color="#ffffff" />
              </TouchableOpacity>
              <Image
                source={{ uri: fullscreenImageUrl }}
                style={styles.lightboxImage}
                contentFit="contain"
              />
            </View>
          </Modal>
        )}
        {/* Voice & Video Calling Screen Overlay */}
        {isCallOpen && (
          <Modal
            visible={isCallOpen}
            animationType="fade"
            presentationStyle="fullScreen"
            statusBarTranslucent={true}
          >
            <View style={styles.callScreenContainer}>
              {/* Header Info */}
              <View style={styles.callHeader}>
                <View style={styles.callPartnerRow}>
                  <View style={styles.callAvatar}>
                    {partnerAvatar ? (
                      <Image source={{ uri: partnerAvatar }} style={styles.callAvatarImg} />
                    ) : (
                      <Text style={styles.callAvatarLetter}>{partnerName.charAt(0).toUpperCase()}</Text>
                    )}
                  </View>
                  <View>
                    <Text style={styles.callPartnerName}>{partnerName}</Text>
                    <View style={styles.callEncryptedRow}>
                      <ShieldCheck size={12} color="#10b981" />
                      <Text style={styles.callEncryptedText}>Encrypted &bull; @{partnerUsername}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.callStatusBadge}>
                  <Text style={styles.callStatusText}>
                    {callStatus === 'connected'
                      ? `${Math.floor(callDuration / 60).toString().padStart(2, '0')}:${(callDuration % 60).toString().padStart(2, '0')}`
                      : callStatus === 'incoming_ringing'
                      ? `Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call`
                      : callStatus === 'outgoing_ringing'
                      ? 'Ringing...'
                      : callStatus === 'declined'
                      ? 'Call Declined'
                      : callStatus === 'ended'
                      ? 'Call Ended'
                      : 'Connecting...'}
                  </Text>
                </View>
              </View>

              {/* Center Canvas */}
              <View style={styles.callCenterCanvas}>
                {callType === 'video' ? (
                  <View style={styles.callVideoView}>
                    <View style={styles.callVideoRemotePlaceholder}>
                      <View style={styles.callBigAvatar}>
                        {partnerAvatar ? (
                          <Image source={{ uri: partnerAvatar }} style={styles.callBigAvatarImg} />
                        ) : (
                          <Text style={styles.callBigAvatarLetter}>{partnerName.charAt(0).toUpperCase()}</Text>
                        )}
                      </View>
                      <Text style={styles.callRemoteLabel}>{partnerName}</Text>
                      <Text style={styles.callRemoteSub}>
                        {callStatus === 'connected' ? 'Video Connected' : 'Calling video...'}
                      </Text>
                    </View>

                    {/* Floating Self-View (Picture-in-Picture) */}
                    <View style={styles.callSelfPipView}>
                      <View style={styles.callSelfInner}>
                        {callCameraOff ? (
                          <View style={styles.callSelfCamOff}>
                            <VideoOff size={18} color="#94a3b8" />
                            <Text style={styles.callSelfCamOffText}>Off</Text>
                          </View>
                        ) : (
                          <View style={styles.callSelfCamActive}>
                            <Text style={styles.callSelfPipLabel}>You</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={styles.callAudioView}>
                    <View style={styles.callBigAvatar}>
                      {partnerAvatar ? (
                        <Image source={{ uri: partnerAvatar }} style={styles.callBigAvatarImg} />
                      ) : (
                        <Text style={styles.callBigAvatarLetter}>{partnerName.charAt(0).toUpperCase()}</Text>
                      )}
                    </View>
                    <Text style={styles.callBigName}>{partnerName}</Text>
                    <Text style={styles.callSubStatus}>
                      {callStatus === 'connected' ? 'Voice Call Connected' : 'Calling private line...'}
                    </Text>

                    {callStatus === 'connected' && (
                      <View style={styles.callWaveformRow}>
                        {[30, 50, 75, 40, 85, 60, 95, 70, 45, 80, 55, 30].map((h, i) => (
                          <View
                            key={i}
                            style={[styles.callWaveBar, { height: (h / 100) * 36 }]}
                          />
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Bottom Controls Dock */}
              <View style={styles.callBottomDock}>
                {callStatus === 'incoming_ringing' ? (
                  <View style={styles.callIncomingActions}>
                    <TouchableOpacity
                      style={styles.callDeclineBtn}
                      onPress={handleDeclineCall}
                      activeOpacity={0.8}
                    >
                      <PhoneOff size={28} color="#ffffff" />
                      <Text style={styles.callActionLabel}>Decline</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.callAcceptBtn}
                      onPress={handleAcceptCall}
                      activeOpacity={0.8}
                    >
                      {callType === 'video' ? (
                        <Video size={28} color="#ffffff" />
                      ) : (
                        <Phone size={28} color="#ffffff" />
                      )}
                      <Text style={styles.callActionLabel}>Accept</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.callControlsRow}>
                    {/* Mute Mic */}
                    <TouchableOpacity
                      style={[styles.callControlCircle, callMuted && styles.callControlActive]}
                      onPress={() => setCallMuted((prev) => !prev)}
                    >
                      {callMuted ? <MicOff size={22} color="#ffffff" /> : <Mic size={22} color="#ffffff" />}
                    </TouchableOpacity>

                    {/* Camera On/Off (Video) */}
                    {callType === 'video' && (
                      <TouchableOpacity
                        style={[styles.callControlCircle, callCameraOff && styles.callControlActive]}
                        onPress={() => setCallCameraOff((prev) => !prev)}
                      >
                        {callCameraOff ? <VideoOff size={22} color="#ffffff" /> : <Video size={22} color="#ffffff" />}
                      </TouchableOpacity>
                    )}

                    {/* Speaker */}
                    <TouchableOpacity
                      style={[styles.callControlCircle, !callSpeakerOn && styles.callControlActive]}
                      onPress={() => setCallSpeakerOn((prev) => !prev)}
                    >
                      {callSpeakerOn ? <Volume2 size={22} color="#ffffff" /> : <VolumeX size={22} color="#ffffff" />}
                    </TouchableOpacity>

                    {/* End Call */}
                    <TouchableOpacity
                      style={styles.callEndBtn}
                      onPress={handleEndCall}
                      activeOpacity={0.8}
                    >
                      <PhoneOff size={24} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </Modal>
        )}
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 12,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 40,
    height: 40,
  },
  avatarLetter: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.brand,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.gray900,
  },
  headerUsername: {
    fontSize: 12,
    color: colors.gray500,
  },
  onlineStatusText: {
    color: '#059669',
    fontWeight: '600',
    fontSize: 12,
  },
  typingStatusText: {
    color: colors.brand,
    fontWeight: '600',
    fontSize: 12,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerCallBtn: {
    padding: 7,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.gray100,
  },
  messagesContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: colors.gray500,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray800,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },
  messageRow: {
    maxWidth: '82%',
    marginBottom: 4,
  },
  messageRowMe: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  messageRowThem: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleWithImage: {
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 8,
    overflow: 'hidden',
  },
  bubbleMe: {
    backgroundColor: colors.brand,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.gray200,
    borderBottomLeftRadius: 4,
  },
  bubblePending: {
    opacity: 0.75,
  },
  chatImage: {
    width: 220,
    height: 180,
    borderRadius: 14,
  },
  captionText: {
    marginTop: 6,
    marginHorizontal: 8,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextMe: {
    color: '#ffffff',
  },
  messageTextThem: {
    color: colors.gray900,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    paddingHorizontal: 4,
    gap: 4,
  },
  metaRowMe: {
    justifyContent: 'flex-end',
  },
  metaRowThem: {
    justifyContent: 'flex-start',
  },
  timeText: {
    fontSize: 10,
    color: colors.gray400,
  },
  receiptContainer: {
    marginLeft: 2,
  },
  typingRow: {
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 8,
    gap: 4,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderBottomLeftRadius: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand,
  },
  typingLabel: {
    fontSize: 11,
    color: colors.brand,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  previewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    gap: 12,
  },
  previewThumbContainer: {
    position: 'relative',
    width: 48,
    height: 48,
  },
  previewThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: {
    fontSize: 12,
    color: colors.gray600,
    fontWeight: '500',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    gap: 8,
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: colors.gray50,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.gray900,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.gray300,
  },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  bubbleWithAudio: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    minWidth: 200,
  },
  audioBubbleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  audioBubbleMe: {},
  audioBubbleThem: {},
  audioPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioPlayBtnMe: {
    backgroundColor: '#ffffff',
  },
  audioPlayBtnThem: {
    backgroundColor: colors.brand,
  },
  audioWaveformSection: {
    flex: 1,
    gap: 4,
  },
  waveformBars: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 22,
    gap: 3,
  },
  waveformBar: {
    width: 3.5,
    borderRadius: 2,
    opacity: 0.35,
  },
  waveformBarPlaying: {
    opacity: 1,
  },
  waveformBarMe: {
    backgroundColor: '#ffffff',
  },
  waveformBarThem: {
    backgroundColor: colors.brand,
  },
  audioMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  audioDurationText: {
    fontSize: 10,
    fontWeight: '600',
  },
  audioDurationMe: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  audioDurationThem: {
    color: colors.gray500,
  },
  audioTagText: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  audioTagMe: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  audioTagThem: {
    color: colors.brand,
  },
  waveformBarTouch: {
    paddingVertical: 4,
    paddingHorizontal: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveformBarPlayed: {
    opacity: 1,
    transform: [{ scaleY: 1.15 }],
  },
  audioControlsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  speedBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  speedBadgeMe: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  speedBadgeThem: {
    backgroundColor: colors.brandLight,
  },
  speedBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  speedBadgeTextMe: {
    color: '#ffffff',
  },
  speedBadgeTextThem: {
    color: colors.brand,
  },
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  recordingIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingPulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
  },
  recordingTimerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ef4444',
  },
  recordingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recordingCancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#fef2f2',
  },
  recordingCancelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ef4444',
  },
  recordingSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.brand,
  },
  recordingSendText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  lightboxImage: {
    width: '100%',
    height: '80%',
  },
  // Call Screen Styles
  callScreenContainer: {
    flex: 1,
    backgroundColor: '#030712',
    justifyContent: 'space-between',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  callHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  callPartnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  callAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  callAvatarImg: {
    width: '100%',
    height: '100%',
  },
  callAvatarLetter: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  callPartnerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  callEncryptedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  callEncryptedText: {
    fontSize: 11,
    color: '#9ca3af',
  },
  callStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  callStatusText: {
    fontSize: 12,
    color: '#ffffff',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
  },
  callCenterCanvas: {
    flex: 1,
    marginVertical: 24,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  callVideoView: {
    width: '100%',
    height: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callVideoRemotePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  callRemoteLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 12,
  },
  callRemoteSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  callSelfPipView: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 100,
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    elevation: 8,
  },
  callSelfInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callSelfCamOff: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  callSelfCamOffText: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  callSelfCamActive: {
    flex: 1,
    width: '100%',
    backgroundColor: '#334155',
    justifyContent: 'flex-end',
    padding: 6,
  },
  callSelfPipLabel: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '600',
  },
  callAudioView: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  callBigAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#818cf8',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  callBigAvatarImg: {
    width: '100%',
    height: '100%',
  },
  callBigAvatarLetter: {
    fontSize: 40,
    fontWeight: '800',
    color: '#ffffff',
  },
  callBigName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 16,
  },
  callSubStatus: {
    fontSize: 13,
    color: '#a5b4fc',
    marginTop: 4,
    fontWeight: '500',
  },
  callWaveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 20,
    height: 40,
  },
  callWaveBar: {
    width: 4,
    backgroundColor: '#818cf8',
    borderRadius: 2,
  },
  callBottomDock: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  callIncomingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 48,
  },
  callDeclineBtn: {
    alignItems: 'center',
    gap: 6,
  },
  callAcceptBtn: {
    alignItems: 'center',
    gap: 6,
  },
  callActionLabel: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  callControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  callControlCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callControlActive: {
    backgroundColor: '#ef4444',
  },
  callEndBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  // Mobile Superpowers styles
  mobileSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 10,
    gap: 8,
  },
  mobileSearchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  mobileVanishBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff7ed',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#fed7aa',
  },
  mobileVanishText: {
    fontSize: 11,
    color: '#c2410c',
    fontWeight: '600',
  },
  mobileCallHistoryPanel: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9d5ff',
  },
  callHistoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  callHistoryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7c3aed',
  },
  callHistoryEmptyText: {
    fontSize: 12,
    color: '#a855f7',
    textAlign: 'center',
    paddingVertical: 8,
  },
  mobileCallLogItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e9d5ff',
  },
  callLogIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callLogTitleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  callLogDurationText: {
    fontSize: 10,
    color: '#6b7280',
  },
  callBackBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#9333ea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleMeDisappearing: {
    backgroundColor: '#ea580c',
    borderWidth: 1,
    borderColor: '#fb923c',
  },
  bubbleThemDisappearing: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  mobileQuotePreview: {
    padding: 6,
    borderRadius: 6,
    marginBottom: 4,
  },
  mobileQuotePreviewMe: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderLeftWidth: 3,
    borderLeftColor: '#ffffff',
  },
  mobileQuotePreviewThem: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderLeftWidth: 3,
    borderLeftColor: colors.brand,
  },
  mobileQuoteSender: {
    fontSize: 10,
    fontWeight: '700',
  },
  mobileQuoteText: {
    fontSize: 10,
    marginTop: 1,
  },
  mobileReactionBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  mobileReactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 3,
  },
  mobileReactionEmoji: {
    fontSize: 11,
  },
  mobileReactionCount: {
    fontSize: 10,
    fontWeight: '600',
  },
  mobileReplyingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#e9d5ff',
  },
  mobileReplyingSender: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7c3aed',
  },
  mobileReplyingContent: {
    fontSize: 11,
  },
  mobileReactionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mobileReactionCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  mobileEmojiBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  mobileEmojiBtn: {
    padding: 6,
  },
  mobileEmojiText: {
    fontSize: 28,
  },
  mobileActionOptions: {
    paddingTop: 12,
    gap: 12,
  },
  mobileActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  mobileActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
})
