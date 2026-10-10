'use client'

import React, { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  SwitchCamera,
  Maximize2,
  Minimize2,
  User,
  Shield,
  Sparkles,
} from 'lucide-react'
import type { DMCallType, DMCallStatus, DMCallParticipant } from '@private-voices/shared'

interface DMCallModalProps {
  isOpen: boolean
  callType: DMCallType
  callStatus: DMCallStatus
  partner: DMCallParticipant
  isIncoming: boolean
  callId?: string | null
  conversationId?: string
  channel?: any
  currentUserId?: string
  onAccept: () => void
  onDecline: () => void
  onEndCall: () => void
  onToggleMute?: (muted: boolean) => void
  onToggleCamera?: (cameraOff: boolean) => void
  onToggleSpeaker?: (speakerOn: boolean) => void
  onSwitchCamera?: () => void
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
}

export function DMCallModal({
  isOpen,
  callType,
  callStatus,
  partner,
  isIncoming,
  callId,
  conversationId,
  channel,
  currentUserId,
  onAccept,
  onDecline,
  onEndCall,
  onToggleMute,
  onToggleCamera,
  onToggleSpeaker,
  onSwitchCamera,
}: DMCallModalProps): React.JSX.Element | null {
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(callType === 'audio')
  const [isSpeakerOn, setIsSpeakerOn] = useState(true)
  const [isMinimized, setIsMinimized] = useState(false)
  const [duration, setDuration] = useState(0)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false)

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)

  // Manage duration timer when connected
  useEffect(() => {
    if (callStatus === 'connected') {
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      setDuration(0)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [callStatus])

  // Setup WebRTC media stream and peer connection
  useEffect(() => {
    if (!isOpen || callStatus === 'ended' || callStatus === 'declined' || callStatus === 'missed') {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
        peerConnectionRef.current = null
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop())
        localStreamRef.current = null
      }
      setLocalStream(null)
      setRemoteStream(null)
      return
    }

    let isSubscribed = true

    async function initCall() {
      try {
        const constraints: MediaStreamConstraints = {
          audio: true,
          video:
            callType === 'video'
              ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
              : false,
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (!isSubscribed) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        localStreamRef.current = stream
        setLocalStream(stream)

        if (localVideoRef.current && callType === 'video') {
          localVideoRef.current.srcObject = stream
        }

        // Initialize RTCPeerConnection
        const pc = new RTCPeerConnection(ICE_SERVERS)
        peerConnectionRef.current = pc

        // Add local tracks to peer connection
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream)
        })

        // Listen for remote tracks
        pc.ontrack = (event) => {
          const [remoteMediaStream] = event.streams
          if (remoteMediaStream) {
            setRemoteStream(remoteMediaStream)
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteMediaStream
            }
            if (remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = remoteMediaStream
            }

            // Check if there are active video tracks
            const videoTracks = remoteMediaStream.getVideoTracks()
            setHasRemoteVideo(videoTracks.length > 0 && videoTracks[0].enabled)
            remoteMediaStream.onremovetrack = () => {
              setHasRemoteVideo(remoteMediaStream.getVideoTracks().length > 0)
            }
          }
        }

        // Send ICE candidate to peer
        pc.onicecandidate = (event) => {
          if (event.candidate && channel && callId) {
            channel.send({
              type: 'broadcast',
              event: 'call_signal',
              payload: {
                callId,
                conversationId,
                type: callType,
                action: 'ice_candidate',
                candidate: event.candidate,
                caller: isIncoming ? partner : { id: currentUserId },
                receiver: isIncoming ? { id: currentUserId } : partner,
                timestamp: Date.now(),
              },
            })
          }
        }

        // If caller and outgoing, wait for call_accept to send SDP offer, or create it immediately when callStatus is 'connected'
        if (!isIncoming && callStatus === 'connected') {
          createAndSendOffer(pc)
        }
      } catch (err) {
        console.warn('getUserMedia error (device permission or not supported):', err)
      }
    }

    async function createAndSendOffer(pc: RTCPeerConnection) {
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        if (channel && callId) {
          channel.send({
            type: 'broadcast',
            event: 'call_signal',
            payload: {
              callId,
              conversationId,
              type: callType,
              action: 'sdp_offer',
              sdp: offer,
              caller: { id: currentUserId },
              receiver: partner,
              timestamp: Date.now(),
            },
          })
        }
      } catch (e) {
        console.error('Error creating SDP offer:', e)
      }
    }

    initCall()

    return () => {
      isSubscribed = false
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
        peerConnectionRef.current = null
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop())
        localStreamRef.current = null
      }
    }
  }, [isOpen, callType, callStatus, isIncoming, callId, conversationId])

  // React to incoming call accepted trigger for caller to initiate offer
  useEffect(() => {
    if (!isIncoming && callStatus === 'connected' && peerConnectionRef.current) {
      const pc = peerConnectionRef.current
      if (pc.signalingState === 'stable') {
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer).then(() => offer))
          .then((offer) => {
            channel?.send({
              type: 'broadcast',
              event: 'call_signal',
              payload: {
                callId,
                conversationId,
                type: callType,
                action: 'sdp_offer',
                sdp: offer,
                caller: { id: currentUserId },
                receiver: partner,
                timestamp: Date.now(),
              },
            })
          })
          .catch((err) => console.error('Failed to create SDP offer upon connect:', err))
      }
    }
  }, [callStatus, isIncoming, callId, conversationId, channel, currentUserId, partner])

  // Handle incoming Realtime signaling for SDP offer, SDP answer, and ICE candidates
  useEffect(() => {
    if (!channel || !isOpen) return

    const handleSignal = async ({ payload }: { payload: any }) => {
      if (!payload || payload.callId !== callId) return
      const pc = peerConnectionRef.current
      if (!pc) return

      try {
        if (payload.action === 'sdp_offer' && payload.sdp && isIncoming) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          channel.send({
            type: 'broadcast',
            event: 'call_signal',
            payload: {
              callId,
              conversationId,
              type: callType,
              action: 'sdp_answer',
              sdp: answer,
              caller: partner,
              receiver: { id: currentUserId },
              timestamp: Date.now(),
            },
          })
        } else if (payload.action === 'sdp_answer' && payload.sdp && !isIncoming) {
          if (pc.signalingState !== 'stable') {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
          }
        } else if (payload.action === 'ice_candidate' && payload.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
          } catch (iceErr) {
            console.warn('Could not add ICE candidate:', iceErr)
          }
        }
      } catch (sigErr) {
        console.error('Signaling processing error:', sigErr)
      }
    }

    const sub = channel.on('broadcast', { event: 'call_signal' }, handleSignal)
    return () => {
      // channel is handled upstream
    }
  }, [channel, isOpen, callId, isIncoming, conversationId, callType, currentUserId, partner])

  // Handle local audio track mute
  const handleToggleMute = () => {
    const nextMuted = !isMuted
    setIsMuted(nextMuted)
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted
      })
    }
    onToggleMute?.(nextMuted)
  }

  // Handle local video track toggle
  const handleToggleCamera = () => {
    const nextCamOff = !isCameraOff
    setIsCameraOff(nextCamOff)
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !nextCamOff
      })
    }
    onToggleCamera?.(nextCamOff)
  }

  // Handle speaker toggle
  const handleToggleSpeaker = () => {
    const nextSpeaker = !isSpeakerOn
    setIsSpeakerOn(nextSpeaker)
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !nextSpeaker
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !nextSpeaker
    }
    onToggleSpeaker?.(nextSpeaker)
  }

  if (!isOpen) return null

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60)
    const secs = sec % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getStatusLabel = () => {
    switch (callStatus) {
      case 'incoming_ringing':
        return `Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call...`
      case 'outgoing_ringing':
        return `Calling @${partner.username}...`
      case 'connecting':
        return 'Connecting...'
      case 'connected':
        return formatTimer(duration)
      case 'declined':
        return 'Call Declined'
      case 'missed':
        return 'Call Missed'
      case 'ended':
        return 'Call Ended'
      case 'busy':
        return 'User Busy'
      default:
        return 'Connecting...'
    }
  }

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-60 w-72 sm:w-80 bg-slate-950/95 border border-white/20 rounded-2xl shadow-2xl p-3 flex flex-col gap-2 backdrop-blur-xl animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold text-xs">
              {partner.avatarUrl ? (
                <Image src={partner.avatarUrl} alt={partner.displayName} width={32} height={32} className="rounded-full" />
              ) : (
                partner.displayName.charAt(0)
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-white leading-tight">{partner.displayName}</p>
              <p className="text-[10px] text-emerald-400 font-mono">{getStatusLabel()}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(false)}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
              title="Expand Call"
            >
              <Maximize2 size={14} />
            </button>
            <button
              onClick={onEndCall}
              className="p-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white"
              title="End Call"
            >
              <PhoneOff size={14} />
            </button>
          </div>
        </div>

        {/* Mini Preview */}
        {callType === 'video' && callStatus === 'connected' && (
          <div className="relative h-32 rounded-xl overflow-hidden bg-black">
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
          </div>
        )}

        <audio ref={remoteAudioRef} autoPlay playsInline />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in duration-200">
      {/* Background Ambience Gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl animate-pulse" />
      </div>

      {/* Main Container */}
      <div className="relative w-full h-full flex flex-col justify-between p-6 sm:p-8 max-w-4xl mx-auto">
        {/* Top Header: Partner Info & End-to-End Status */}
        <div className="flex items-center justify-between text-white z-20">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-slate-800 border-2 border-white/20 overflow-hidden flex items-center justify-center text-white font-bold">
              {partner.avatarUrl ? (
                <Image
                  src={partner.avatarUrl}
                  alt={partner.displayName}
                  width={44}
                  height={44}
                  className="w-full h-full object-cover"
                />
              ) : (
                partner.displayName.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight leading-none text-white">
                {partner.displayName}
              </h3>
              <div className="flex items-center gap-1.5 mt-1 text-slate-300 text-xs">
                <span>@{partner.username}</span>
                <span>&bull;</span>
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <Shield size={11} /> End-to-End Encrypted
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-mono font-medium text-white shadow-sm">
              {getStatusLabel()}
            </div>
            {callStatus === 'connected' && (
              <button
                onClick={() => setIsMinimized(true)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                title="Minimize Call to Chat"
              >
                <Minimize2 size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Center Canvas */}
        <div className="flex-1 relative my-6 flex items-center justify-center rounded-3xl overflow-hidden bg-slate-900/60 border border-white/10 shadow-2xl">
          {callType === 'video' ? (
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              {/* Remote Video Stream (Main View) */}
              {callStatus === 'connected' ? (
                <div className="w-full h-full flex items-center justify-center relative">
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className={`w-full h-full object-cover transition-opacity duration-300 ${hasRemoteVideo ? 'opacity-100' : 'opacity-0'}`}
                  />
                  {/* Fallback avatar overlay if remote camera is off or loading */}
                  {!hasRemoteVideo && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80">
                      <div className="w-24 h-24 rounded-full bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-white text-3xl font-bold mb-3 shadow-lg">
                        {partner.displayName.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-semibold text-slate-300">{partner.displayName}</span>
                      <span className="text-xs text-slate-500 mt-1">Camera paused</span>
                    </div>
                  )}
                </div>
              ) : (
                /* Pre-connect Calling / Ringing State */
                <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <div className="relative">
                    <div className="w-28 h-28 rounded-full bg-purple-600/20 border-2 border-purple-500 flex items-center justify-center text-white text-4xl font-bold shadow-2xl animate-pulse">
                      {partner.avatarUrl ? (
                        <Image
                          src={partner.avatarUrl}
                          alt={partner.displayName}
                          width={112}
                          height={112}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        partner.displayName.charAt(0).toUpperCase()
                      )}
                    </div>
                    {/* Ringing Ripple */}
                    <div className="absolute inset-0 rounded-full border border-purple-400 animate-ping opacity-35" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{partner.displayName}</h2>
                    <p className="text-sm text-purple-300 font-medium mt-1">
                      {getStatusLabel()}
                    </p>
                  </div>
                </div>
              )}

              {/* Floating Self View (Picture-in-Picture) */}
              <div className="absolute bottom-4 right-4 w-32 sm:w-44 h-48 sm:h-60 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-slate-900 z-30 transition-transform hover:scale-105">
                {isCameraOff ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-slate-400 p-2 text-center">
                    <VideoOff size={24} className="mb-1 text-slate-500" />
                    <span className="text-[10px] font-medium">Camera Off</span>
                  </div>
                ) : (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                )}
                <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-[10px] text-white font-medium">
                  You
                </div>
              </div>
            </div>
          ) : (
            /* Voice Call UI (Instagram-style centered avatar & waveforms) */
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-5">
              <div className="relative">
                <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 p-1 shadow-2xl">
                  <div className="w-full h-full rounded-full overflow-hidden bg-slate-900 flex items-center justify-center text-white text-4xl font-bold">
                    {partner.avatarUrl ? (
                      <Image
                        src={partner.avatarUrl}
                        alt={partner.displayName}
                        width={128}
                        height={128}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      partner.displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                </div>

                {/* Animated pulsating halo when ringing or connected */}
                {(callStatus === 'incoming_ringing' || callStatus === 'outgoing_ringing' || callStatus === 'connected') && (
                  <>
                    <div className="absolute -inset-3 rounded-full border-2 border-purple-500/50 animate-ping opacity-25 pointer-events-none" />
                    <div className="absolute -inset-6 rounded-full border border-indigo-400/30 animate-pulse pointer-events-none" />
                  </>
                )}
              </div>

              <div>
                <h2 className="text-2xl font-extrabold text-white tracking-tight">{partner.displayName}</h2>
                <p className="text-sm text-purple-300 font-medium mt-1">
                  {getStatusLabel()}
                </p>
              </div>

              {/* Connected Audio Waveform Animation */}
              {callStatus === 'connected' && (
                <div className="flex items-center gap-1.5 h-8">
                  {[40, 70, 95, 60, 85, 45, 100, 75, 55, 90, 65, 40].map((h, i) => (
                    <div
                      key={i}
                      className="w-1 bg-gradient-to-t from-purple-500 to-indigo-400 rounded-full animate-pulse"
                      style={{
                        height: `${h}%`,
                        animationDelay: `${(i * 0.1).toFixed(1)}s`,
                        animationDuration: '1.2s',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Call Controls Dock */}
        <div className="flex items-center justify-center gap-4 sm:gap-6 z-20">
          {/* Incoming Ringing Action Buttons */}
          {callStatus === 'incoming_ringing' ? (
            <div className="flex items-center gap-8">
              {/* Decline Button */}
              <button
                onClick={onDecline}
                className="flex flex-col items-center gap-2 group cursor-pointer"
                title="Decline"
              >
                <div className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-xl shadow-red-600/30 transition-transform group-hover:scale-110 active:scale-95">
                  <PhoneOff size={28} />
                </div>
                <span className="text-xs font-semibold text-red-300">Decline</span>
              </button>

              {/* Accept Button */}
              <button
                onClick={onAccept}
                className="flex flex-col items-center gap-2 group cursor-pointer"
                title="Accept"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-600/30 transition-transform group-hover:scale-110 active:scale-95 animate-bounce">
                  {callType === 'video' ? <Video size={28} /> : <Phone size={28} />}
                </div>
                <span className="text-xs font-semibold text-emerald-300">Accept</span>
              </button>
            </div>
          ) : (
            /* Connected / Outgoing Controls Dock */
            <div className="flex items-center gap-3 sm:gap-5 bg-white/10 backdrop-blur-xl px-6 py-4 rounded-full border border-white/15 shadow-2xl">
              {/* Mute Mic */}
              <button
                onClick={handleToggleMute}
                className={`p-3.5 rounded-full transition-all cursor-pointer ${
                  isMuted
                    ? 'bg-red-500/80 text-white hover:bg-red-500'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
              >
                {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
              </button>

              {/* Camera Toggle (Video Only) */}
              {callType === 'video' && (
                <button
                  onClick={handleToggleCamera}
                  className={`p-3.5 rounded-full transition-all cursor-pointer ${
                    isCameraOff
                      ? 'bg-red-500/80 text-white hover:bg-red-500'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                  title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
                >
                  {isCameraOff ? <VideoOff size={22} /> : <Video size={22} />}
                </button>
              )}

              {/* Speaker Toggle */}
              <button
                onClick={handleToggleSpeaker}
                className={`p-3.5 rounded-full transition-all cursor-pointer ${
                  !isSpeakerOn
                    ? 'bg-amber-500/80 text-white hover:bg-amber-500'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                title={isSpeakerOn ? 'Speaker On' : 'Speaker Off'}
              >
                {isSpeakerOn ? <Volume2 size={22} /> : <VolumeX size={22} />}
              </button>

              {/* Switch Camera (if applicable) */}
              {callType === 'video' && onSwitchCamera && (
                <button
                  onClick={onSwitchCamera}
                  className="p-3.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all cursor-pointer"
                  title="Switch Camera"
                >
                  <SwitchCamera size={22} />
                </button>
              )}

              {/* End Call Button */}
              <button
                onClick={onEndCall}
                className="p-3.5 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-xl shadow-red-600/30 transition-transform hover:scale-105 active:scale-95 cursor-pointer ml-2"
                title="End Call"
              >
                <PhoneOff size={22} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Hidden Remote Audio Element for Audio Track Playback */}
      <audio ref={remoteAudioRef} autoPlay playsInline />
    </div>
  )
}
