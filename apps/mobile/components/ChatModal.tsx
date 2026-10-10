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
import { X, Send, Check, CheckCheck, Image as ImageIcon, Trash2, Mic, Square, Play, Pause, Volume2 } from 'lucide-react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { Audio } from 'expo-av'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'
import { useTheme } from '../context/ThemeContext'

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
            prev.map((m) => (m.id === payload.new.id ? { ...m, is_read: payload.new.is_read } : m))
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
  }, [visible, conversationId, currentUserId, partnerId])

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

    setText('')
    setSelectedImage(null)
    setSending(true)

    // Optimistic message
    const tempId = `temp-${Date.now()}`
    const optimisticMsg = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: messageContent,
      image_url: imageUriToSend,
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
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
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

            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: themeColors.surfaceBorder }]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={22} color={themeColors.text} />
            </TouchableOpacity>
          </View>

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
                data={messages}
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

                  return (
                    <View
                      style={[
                        styles.messageRow,
                        isMe ? styles.messageRowMe : styles.messageRowThem,
                      ]}
                    >
                      <TouchableOpacity
                        activeOpacity={isMe && !isTemp ? 0.85 : 1}
                        onLongPress={isMe && !isTemp ? () => handleDeleteMessage(item.id) : undefined}
                        delayLongPress={400}
                      >
                        <View
                          style={[
                            styles.bubble,
                            isMe ? styles.bubbleMe : [styles.bubbleThem, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }],
                            isTemp && styles.bubblePending,
                            hasImage && styles.bubbleWithImage,
                            hasAudio && styles.bubbleWithAudio,
                          ]}
                        >
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

                      <View
                        style={[
                          styles.metaRow,
                          isMe ? styles.metaRowMe : styles.metaRowThem,
                        ]}
                      >
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
})
