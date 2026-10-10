'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import {
  Mic,
  MicOff,
  Hand,
  Volume2,
  Users,
  LogOut,
  ChevronDown,
  ChevronUp,
  Radio,
  Shield,
  Sparkles,
  UserCheck,
  Award,
  MoreVertical,
  X,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { LiveSpace, SpaceParticipant, SpaceRole } from '@private-voices/shared'
import {
  VoiceFilterType,
  VOICE_FILTERS,
  applyVoiceFilterToStream,
} from '@/lib/audio/voiceModifiers'

interface LiveSpaceModalProps {
  spaceId: string
  currentUserId: string
  isOpen: boolean
  onClose: () => void
}

export function LiveSpaceModal({
  spaceId,
  currentUserId,
  isOpen,
  onClose,
}: LiveSpaceModalProps): React.JSX.Element | null {
  const supabase = createSupabaseBrowserClient()

  const [space, setSpace] = useState<LiveSpace | null>(null)
  const [participants, setParticipants] = useState<SpaceParticipant[]>([])
  const [myParticipant, setMyParticipant] = useState<SpaceParticipant | null>(null)
  const [isMuted, setIsMuted] = useState(true)
  const [handRaised, setHandRaised] = useState(false)
  const [selectedVoiceFilter, setSelectedVoiceFilter] = useState<VoiceFilterType>('none')
  const [showVoiceFilterPicker, setShowVoiceFilterPicker] = useState(false)
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set())
  const [isMinimized, setIsMinimized] = useState(false)
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null)
  const [loading, setLoading] = useState(true)

  const voiceModifierCleanupRef = useRef<(() => void) | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const channelRef = useRef<any>(null)

  // Fetch space details and current participants
  const fetchSpaceData = useCallback(async () => {
    try {
      const { data: spaceData } = await supabase
        .from('spaces')
        .select(`
          *,
          host:profiles!spaces_host_id_fkey(id, username, display_name, avatar_url)
        `)
        .eq('id', spaceId)
        .single()

      if (spaceData) {
        setSpace({
          id: spaceData.id,
          title: spaceData.title,
          topic: spaceData.topic,
          hostId: spaceData.host_id,
          host: spaceData.host ? {
            id: spaceData.host.id,
            username: spaceData.host.username,
            displayName: spaceData.host.display_name,
            avatarUrl: spaceData.host.avatar_url,
          } : undefined,
          status: spaceData.status,
          speakerCount: spaceData.speaker_count,
          listenerCount: spaceData.listener_count,
          createdAt: spaceData.created_at,
          endedAt: spaceData.ended_at,
        })
      }

      const { data: participantData } = await supabase
        .from('space_participants')
        .select(`
          *,
          profile:profiles!space_participants_user_id_fkey(id, username, display_name, avatar_url)
        `)
        .eq('space_id', spaceId)
        .order('joined_at', { ascending: true })

      if (participantData) {
        const mapped: SpaceParticipant[] = participantData.map((p: any) => ({
          id: p.id,
          spaceId: p.space_id,
          userId: p.user_id,
          username: p.profile?.username || 'user',
          displayName: p.profile?.display_name || 'Anonymous',
          avatarUrl: p.profile?.avatar_url || null,
          role: p.role as SpaceRole,
          handRaised: p.hand_raised,
          isMuted: p.is_muted,
          joinedAt: p.joined_at,
        }))

        setParticipants(mapped)
        const me = mapped.find((p) => p.userId === currentUserId)
        setMyParticipant(me || null)
        if (me) {
          setIsMuted(me.isMuted)
          setHandRaised(me.handRaised)
        }
      }
    } catch (err) {
      console.error('Error fetching space details:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase, spaceId, currentUserId])

  // Join space on open
  useEffect(() => {
    if (!isOpen || !spaceId || !currentUserId) return

    async function joinSpace() {
      // Check if user is host
      const { data: spaceData } = await supabase
        .from('spaces')
        .select('host_id')
        .eq('id', spaceId)
        .single()

      const isHost = spaceData?.host_id === currentUserId
      const initialRole: SpaceRole = isHost ? 'host' : 'listener'

      await supabase.from('space_participants').upsert(
        {
          space_id: spaceId,
          user_id: currentUserId,
          role: initialRole,
          hand_raised: false,
          is_muted: isHost ? false : true,
        },
        { onConflict: 'space_id,user_id' }
      )

      fetchSpaceData()
    }

    joinSpace()
  }, [isOpen, spaceId, currentUserId, supabase, fetchSpaceData])

  // Subscribe to realtime channel for presence and voice signaling
  useEffect(() => {
    if (!isOpen || !spaceId) return

    const channel = supabase.channel(`space:${spaceId}`, {
      config: { presence: { key: currentUserId } },
    })

    channelRef.current = channel

    // Listen for broadcast speaking events
    channel
      .on('broadcast', { event: 'voice_activity' }, ({ payload }) => {
        if (payload?.userId) {
          setSpeakingUsers((prev) => {
            const next = new Set(prev)
            if (payload.isSpeaking) {
              next.add(payload.userId)
            } else {
              next.delete(payload.userId)
            }
            return next
          })
        }
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'space_participants', filter: `space_id=eq.${spaceId}` },
        () => {
          fetchSpaceData()
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'spaces', filter: `id=eq.${spaceId}` },
        (payload) => {
          if (payload.new?.status === 'ended') {
            alert('This space has ended.')
            onClose()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isOpen, spaceId, currentUserId, supabase, fetchSpaceData, onClose])

  // Voice Activity Detection (VAD) for real-time speaking indicators
  useEffect(() => {
    const isSpeaker = myParticipant?.role === 'host' || myParticipant?.role === 'speaker'

    if (!isSpeaker || isMuted) {
      if (audioStream) {
        audioStream.getTracks().forEach((track) => track.stop())
        setAudioStream(null)
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'voice_activity',
          payload: { userId: currentUserId, isSpeaking: false },
        })
      }
      return
    }

    let localStream: MediaStream | null = null

    async function startAudioMonitoring() {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        
        // Apply Anonymous Voice Modifier filter
        const processed = applyVoiceFilterToStream(localStream, selectedVoiceFilter)
        voiceModifierCleanupRef.current = () => {
          processed.cleanup()
          localStream?.getTracks().forEach((track) => track.stop())
        }
        setAudioStream(processed.stream)

        const audioCtx = processed.audioContext
        audioContextRef.current = audioCtx
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 256
        analyserRef.current = analyser

        const source = audioCtx.createMediaStreamSource(processed.stream)
        source.connect(analyser)

        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        let lastSpeakingState = false

        const checkVolume = () => {
          analyser.getByteFrequencyData(dataArray)
          let sum = 0
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i]
          }
          const average = sum / dataArray.length
          const isSpeaking = average > 18 // Speech volume threshold

          if (isSpeaking !== lastSpeakingState) {
            lastSpeakingState = isSpeaking
            setSpeakingUsers((prev) => {
              const next = new Set(prev)
              if (isSpeaking) next.add(currentUserId)
              else next.delete(currentUserId)
              return next
            })

            if (channelRef.current) {
              channelRef.current.send({
                type: 'broadcast',
                event: 'voice_activity',
                payload: { userId: currentUserId, isSpeaking },
              })
            }
          }

          animationFrameRef.current = requestAnimationFrame(checkVolume)
        }

        checkVolume()
      } catch (err) {
        console.warn('Microphone permission not granted or audio monitoring failed:', err)
      }
    }

    startAudioMonitoring()

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      if (localStream) localStream.getTracks().forEach((t) => t.stop())
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {})
    }
  }, [myParticipant?.role, isMuted, currentUserId])

  // Leave space handler
  const handleLeaveSpace = async () => {
    try {
      if (audioStream) {
        audioStream.getTracks().forEach((t) => t.stop())
      }
      await supabase
        .from('space_participants')
        .delete()
        .eq('space_id', spaceId)
        .eq('user_id', currentUserId)

      // If user was host and leaves, end the space
      if (myParticipant?.role === 'host') {
        await supabase
          .from('spaces')
          .update({ status: 'ended', ended_at: new Date().toISOString() })
          .eq('id', spaceId)
      }
    } catch (err) {
      console.error('Error leaving space:', err)
    } finally {
      onClose()
    }
  }

  // Toggle Hand Raise
  const handleToggleHandRaise = async () => {
    if (!myParticipant) return
    const newState = !handRaised
    setHandRaised(newState)
    await supabase
      .from('space_participants')
      .update({ hand_raised: newState })
      .eq('space_id', spaceId)
      .eq('user_id', currentUserId)
  }

  // Toggle Mute
  const handleToggleMute = async () => {
    if (!myParticipant) return
    const newState = !isMuted
    setIsMuted(newState)
    await supabase
      .from('space_participants')
      .update({ is_muted: newState })
      .eq('space_id', spaceId)
      .eq('user_id', currentUserId)
  }

  // Host Controls: Promote listener to speaker
  const handlePromoteToSpeaker = async (targetUserId: string) => {
    if (myParticipant?.role !== 'host') return
    await supabase
      .from('space_participants')
      .update({ role: 'speaker', hand_raised: false, is_muted: false })
      .eq('space_id', spaceId)
      .eq('user_id', targetUserId)
  }

  // Host Controls: Move speaker to listener
  const handleDemoteToListener = async (targetUserId: string) => {
    if (myParticipant?.role !== 'host') return
    await supabase
      .from('space_participants')
      .update({ role: 'listener', is_muted: true, hand_raised: false })
      .eq('space_id', spaceId)
      .eq('user_id', targetUserId)
  }

  if (!isOpen) return null

  const isHost = myParticipant?.role === 'host'
  const isSpeaker = isHost || myParticipant?.role === 'speaker'
  const speakers = participants.filter((p) => p.role === 'host' || p.role === 'speaker')
  const listeners = participants.filter((p) => p.role === 'listener')

  // Minimized Bar (Allows continuing to listen while browsing)
  if (isMinimized) {
    return (
      <div className="fixed bottom-16 sm:bottom-6 right-4 z-50 bg-gray-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-3 animate-in fade-in slide-in-from-bottom duration-200">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold truncate max-w-[140px] sm:max-w-[200px]">
            {space?.title || 'Live Voice Lounge'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 border-l border-white/20 pl-2">
          {isSpeaker && (
            <button
              onClick={handleToggleMute}
              className={`p-1.5 rounded-full ${
                isMuted ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
            </button>
          )}

          <button
            onClick={() => setIsMinimized(false)}
            className="p-1.5 text-gray-300 hover:text-white rounded-full hover:bg-white/10"
            title="Expand Space"
          >
            <ChevronUp size={16} />
          </button>

          <button
            onClick={handleLeaveSpace}
            className="p-1.5 text-red-400 hover:text-red-300 rounded-full hover:bg-white/10"
            title="Leave Lounge"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-gray-950 text-white rounded-t-3xl sm:rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-white/10 overflow-hidden animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-gray-900 via-gray-950 to-gray-900">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Radio size={20} className="animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  LIVE
                </span>
                <span className="text-xs text-gray-400 flex items-center gap-1 font-medium">
                  <Users size={12} />
                  {participants.length} in room
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white truncate mt-0.5">
                {space?.title || 'Live Voice Space'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(true)}
              className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
              title="Minimize Lounge"
            >
              <ChevronDown size={20} />
            </button>
            <button
              onClick={handleLeaveSpace}
              className="p-2 text-gray-400 hover:text-rose-400 rounded-xl hover:bg-white/10 transition-colors"
              title="Leave Room"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Space Topic Banner */}
        {space?.topic && (
          <div className="px-5 py-2.5 bg-white/5 border-b border-white/5 text-xs text-gray-300 flex items-center gap-2">
            <Sparkles size={14} className="text-amber-400 flex-shrink-0" />
            <span className="truncate">{space.topic}</span>
          </div>
        )}

        {/* Participants Stage */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Speakers Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
              <span>Speakers & Hosts ({speakers.length})</span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
              {speakers.map((speaker) => {
                const isSpeaking = speakingUsers.has(speaker.userId)
                const isUserHost = speaker.role === 'host'

                return (
                  <div
                    key={speaker.id}
                    className="flex flex-col items-center text-center group relative"
                  >
                    <div className="relative">
                      {/* Speaking Pulse Ring */}
                      <div
                        className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center p-0.5 transition-all ${
                          isSpeaking
                            ? 'ring-4 ring-emerald-500 ring-offset-2 ring-offset-gray-950 scale-105'
                            : 'ring-2 ring-white/10'
                        }`}
                      >
                        <div className="w-full h-full rounded-full bg-gradient-to-tr from-purple-700 to-indigo-600 flex items-center justify-center font-bold text-lg text-white overflow-hidden shadow-md">
                          {speaker.avatarUrl ? (
                            <Image
                              src={speaker.avatarUrl}
                              alt={speaker.displayName}
                              width={80}
                              height={80}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            speaker.displayName.charAt(0).toUpperCase()
                          )}
                        </div>
                      </div>

                      {/* Role Badge */}
                      <span className="absolute -top-1 -right-1 bg-gradient-to-r from-amber-500 to-orange-500 text-gray-950 p-1 rounded-full text-[10px] font-black shadow-sm">
                        {isUserHost ? <Shield size={12} /> : <Award size={12} />}
                      </span>

                      {/* Mic Status */}
                      <span
                        className={`absolute -bottom-1 -right-1 p-1 rounded-full text-white shadow-sm border border-gray-950 ${
                          speaker.isMuted ? 'bg-red-500' : 'bg-emerald-500'
                        }`}
                      >
                        {speaker.isMuted ? <MicOff size={11} /> : <Mic size={11} />}
                      </span>
                    </div>

                    <span className="text-xs font-bold text-white mt-2 truncate w-full max-w-[90px]">
                      {speaker.displayName}
                    </span>
                    <span className="text-[10px] text-gray-400 truncate w-full max-w-[90px]">
                      {isUserHost ? 'Host' : 'Speaker'}
                    </span>

                    {/* Host action menu on speakers */}
                    {isHost && speaker.userId !== currentUserId && (
                      <button
                        onClick={() => handleDemoteToListener(speaker.userId)}
                        className="mt-1 text-[10px] text-gray-400 hover:text-rose-400 underline"
                      >
                        Move to listeners
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Listeners Section */}
          <div className="space-y-3 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
              <span>Listeners ({listeners.length})</span>
            </div>

            {listeners.length === 0 ? (
              <p className="text-xs text-gray-500 italic py-2">
                No listeners in the room yet. Share the space link to invite friends!
              </p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                {listeners.map((listener) => (
                  <div
                    key={listener.id}
                    className="flex flex-col items-center text-center relative group"
                  >
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center font-bold text-sm text-gray-300 overflow-hidden border border-white/10">
                        {listener.avatarUrl ? (
                          <Image
                            src={listener.avatarUrl}
                            alt={listener.displayName}
                            width={48}
                            height={48}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          listener.displayName.charAt(0).toUpperCase()
                        )}
                      </div>

                      {listener.handRaised && (
                        <span className="absolute -top-1 -right-1 bg-amber-500 text-gray-950 p-1 rounded-full shadow-sm animate-bounce">
                          <Hand size={11} />
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] font-medium text-gray-300 mt-1 truncate w-full max-w-[70px]">
                      {listener.displayName}
                    </span>

                    {/* Host action to bring raised hands up to speak */}
                    {isHost && (
                      <button
                        onClick={() => handlePromoteToSpeaker(listener.userId)}
                        className="mt-1 text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
                      >
                        {listener.handRaised ? 'Accept Hand' : 'Make Speaker'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Control Bar */}
        <div className="p-4 border-t border-white/10 bg-gray-900/90 backdrop-blur-md flex items-center justify-between gap-3">
          <button
            onClick={handleLeaveSpace}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-bold transition-colors"
          >
            <LogOut size={16} />
            <span>Leave Quietly</span>
          </button>

          <div className="flex items-center gap-2">
            {!isSpeaker && (
              <button
                onClick={handleToggleHandRaise}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  handRaised
                    ? 'bg-amber-500 text-gray-950 shadow-md shadow-amber-500/20 scale-105'
                    : 'bg-white/10 text-white hover:bg-white/15'
                }`}
              >
                <Hand size={16} />
                <span>{handRaised ? 'Hand Raised' : 'Raise Hand'}</span>
              </button>
            )}

            {isSpeaker && (
              <>
                {/* Voice Modifier Filter Selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowVoiceFilterPicker((prev) => !prev)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      selectedVoiceFilter !== 'none'
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-500/25 ring-2 ring-purple-400'
                        : 'bg-white/10 text-gray-300 hover:text-white hover:bg-white/15'
                    }`}
                    title="Change Anonymous Voice Filter"
                  >
                    <span>{VOICE_FILTERS.find((f) => f.id === selectedVoiceFilter)?.emoji || '🎙️'}</span>
                    <span className="hidden sm:inline">
                      {VOICE_FILTERS.find((f) => f.id === selectedVoiceFilter)?.name || 'Voice Filter'}
                    </span>
                  </button>

                  {showVoiceFilterPicker && (
                    <div className="absolute bottom-12 right-0 z-30 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl p-2 w-56 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 py-1 block">
                        Voice Modifiers
                      </span>
                      {VOICE_FILTERS.map((filter) => (
                        <button
                          key={filter.id}
                          onClick={() => {
                            setSelectedVoiceFilter(filter.id)
                            setShowVoiceFilterPicker(false)
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                            selectedVoiceFilter === filter.id
                              ? 'bg-purple-600/30 text-purple-300 font-bold border border-purple-500/30'
                              : 'text-gray-300 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span>{filter.emoji}</span>
                            <span>{filter.name}</span>
                          </span>
                          {selectedVoiceFilter === filter.id && (
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleToggleMute}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                    isMuted
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700 ring-2 ring-emerald-400/50'
                  }`}
                >
                  {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                  <span>{isMuted ? 'Muted' : 'Speaking'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
