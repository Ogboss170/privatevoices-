'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Play, Pause, Volume2, VolumeX, CheckCircle2 } from 'lucide-react'
import { getPlayableAudioUrl, cacheAudioForOffline, isAudioCached } from '@/lib/audio/offlineAudioCache'

interface VoiceWaveformPlayerProps {
  audioUrl: string
  duration?: number | null
  theme?: 'light' | 'dark' | 'brand'
  barCount?: number
  compact?: boolean
  className?: string
}

// 24 normalized bar heights for visual waveform
const DEFAULT_WAVEFORM_BARS = [
  25, 45, 70, 50, 85, 100, 65, 40, 75, 90, 55, 35,
  60, 95, 80, 50, 70, 85, 60, 40, 65, 80, 45, 30
]

export default function VoiceWaveformPlayer({
  audioUrl,
  duration: initialDuration,
  theme = 'brand',
  barCount = 20,
  compact = false,
  className = '',
}: VoiceWaveformPlayerProps): React.JSX.Element {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [totalDuration, setTotalDuration] = useState(initialDuration || 0)
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.5 | 2>(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isCachedOffline, setIsCachedOffline] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const waveformContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let activeAudio: HTMLAudioElement | null = null
    let objectUrlToRevoke: string | null = null

    async function initAudio() {
      // 1. Check if already stored in local cache
      const cached = await isAudioCached(audioUrl)
      setIsCachedOffline(cached)

      // 2. Resolve offline Blob URL or original URL
      const playableUrl = await getPlayableAudioUrl(audioUrl)
      if (playableUrl.startsWith('blob:')) {
        objectUrlToRevoke = playableUrl
      }

      const audio = new window.Audio(playableUrl)
      audioRef.current = audio
      activeAudio = audio
      audio.preload = 'metadata'

      audio.onloadedmetadata = () => {
        if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
          setTotalDuration(audio.duration)
        }
      }

      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime)
      }

      audio.onended = () => {
        setIsPlaying(false)
        setCurrentTime(0)
      }

      // 3. Pre-cache in background if online and not yet cached
      if (!cached && typeof navigator !== 'undefined' && navigator.onLine) {
        cacheAudioForOffline(audioUrl).then((success) => {
          if (success) setIsCachedOffline(true)
        })
      }
    }

    initAudio()

    return () => {
      if (activeAudio) {
        activeAudio.pause()
        activeAudio.src = ''
      }
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke)
      }
    }
  }, [audioUrl])

  function handleTogglePlay(e?: React.MouseEvent) {
    if (e) e.stopPropagation()
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.playbackRate = playbackSpeed
      audioRef.current.muted = isMuted
      audioRef.current.play().catch((err) => console.warn('Audio playback error:', err))
      setIsPlaying(true)
    }
  }

  function handleScrub(fraction: number, e?: React.MouseEvent) {
    if (e) e.stopPropagation()
    if (!audioRef.current || !totalDuration) return
    const targetTime = fraction * totalDuration
    audioRef.current.currentTime = targetTime
    setCurrentTime(targetTime)
  }

  function handleWaveformClick(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation()
    if (!waveformContainerRef.current || !totalDuration) return
    const rect = waveformContainerRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const fraction = Math.max(0, Math.min(1, clickX / rect.width))
    handleScrub(fraction)
  }

  function handleToggleSpeed(e: React.MouseEvent) {
    e.stopPropagation()
    const nextSpeed = playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1
    setPlaybackSpeed(nextSpeed)
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed
    }
  }

  function handleToggleMute(e: React.MouseEvent) {
    e.stopPropagation()
    const nextMuted = !isMuted
    setIsMuted(nextMuted)
    if (audioRef.current) {
      audioRef.current.muted = nextMuted
    }
  }

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  const progressFraction = totalDuration > 0 ? currentTime / totalDuration : 0
  const activeBars = DEFAULT_WAVEFORM_BARS.slice(0, barCount)

  // Styling based on theme
  const isDark = theme === 'dark'
  const isBrand = theme === 'brand'

  const containerBg = isDark
    ? 'bg-black/40 border border-white/10 text-white backdrop-blur-md'
    : isBrand
    ? 'bg-gradient-to-r from-brand-50 to-purple-50/60 border border-brand-200/60 text-brand-950'
    : 'bg-white border border-gray-200 text-gray-900 shadow-2xs'

  const playButtonBg = isDark
    ? 'bg-white text-gray-950 hover:bg-white/90'
    : isBrand
    ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm'
    : 'bg-brand-600 text-white hover:bg-brand-700'

  const activeBarColor = isDark
    ? 'bg-white'
    : isBrand
    ? 'bg-brand-600'
    : 'bg-brand-600'

  const inactiveBarColor = isDark
    ? 'bg-white/30'
    : isBrand
    ? 'bg-brand-200'
    : 'bg-gray-200'

  return (
    <div
      className={`rounded-2xl flex items-center gap-3 transition-all ${
        compact ? 'p-2' : 'p-3'
      } ${containerBg} ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={handleTogglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95 flex-shrink-0 cursor-pointer ${playButtonBg}`}
        aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
      >
        {isPlaying ? (
          <Pause size={16} />
        ) : (
          <Play size={16} className="ml-0.5" />
        )}
      </button>

      {/* Scrubbable Waveform */}
      <div className="flex-1 flex flex-col justify-center gap-1.5 min-w-0">
        <div
          ref={waveformContainerRef}
          onClick={handleWaveformClick}
          className="h-7 flex items-center gap-0.5 sm:gap-1 cursor-pointer group/wave py-1"
          title="Click or drag to scrub"
        >
          {activeBars.map((heightPercent, idx) => {
            const barFraction = idx / activeBars.length
            const isPlayed = barFraction <= progressFraction

            return (
              <span
                key={idx}
                className={`flex-1 rounded-full transition-all duration-150 group-hover/wave:opacity-90 block ${
                  isPlayed ? activeBarColor : inactiveBarColor
                }`}
                style={{
                  height: `${Math.max(15, heightPercent)}%`,
                  minWidth: '2px',
                  maxWidth: '5px',
                }}
              />
            )
          })}
        </div>

        {/* Time display, Offline indicator & Speed badge */}
        <div className="flex items-center justify-between text-[10px] opacity-80 font-medium">
          <div className="flex items-center gap-1.5">
            <span>
              {formatTime(currentTime)} / {formatTime(totalDuration)}
            </span>
            {isCachedOffline && (
              <span
                className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded-full border border-emerald-500/20"
                title="Cached locally for instant offline playback"
              >
                <CheckCircle2 size={9} />
                <span>Offline ready</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleMute}
              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
            </button>

            <button
              type="button"
              onClick={handleToggleSpeed}
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-transform active:scale-95 ${
                isDark ? 'bg-white/15 text-white' : 'bg-brand-100 text-brand-700'
              }`}
              title="Change speed"
            >
              {playbackSpeed}x
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
