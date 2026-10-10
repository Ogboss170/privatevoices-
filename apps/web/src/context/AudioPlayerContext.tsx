'use client'

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react'

export interface GlobalAudioTrack {
  id: string
  title: string
  subtitle?: string | null
  audioUrl: string
  avatarUrl?: string | null
  duration?: number | null
}

interface OfflineQueuedWhisper {
  id: string
  recipientId: string
  content: string
  audioBlobBase64?: string
  createdAt: number
}

interface AudioContextType {
  currentTrack: GlobalAudioTrack | null
  isPlaying: boolean
  currentTime: number
  duration: number
  playbackRate: number
  isOffline: boolean
  playTrack: (track: GlobalAudioTrack) => void
  pauseTrack: () => void
  togglePlay: () => void
  seekTo: (time: number) => void
  setRate: (rate: number) => void
  closePlayer: () => void
  queueOfflineWhisper: (whisper: Omit<OfflineQueuedWhisper, 'id' | 'createdAt'>) => Promise<void>
  queuedWhispersCount: number
}

const AudioPlayerContext = createContext<AudioContextType | undefined>(undefined)

const OFFLINE_QUEUE_KEY = 'pv_offline_whispers_queue'

export function AudioPlayerProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [currentTrack, setCurrentTrack] = useState<GlobalAudioTrack | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false)
  const [queuedWhispersCount, setQueuedWhispersCount] = useState(0)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Network online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false)
      syncQueuedWhispers()
    }
    const handleOffline = () => setIsOffline(true)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => {
          console.log('Private Voices ServiceWorker registered')
        })
        .catch((err) => {
          console.warn('ServiceWorker registration error:', err)
        })

      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'TRIGGER_OFFLINE_SYNC') {
          syncQueuedWhispers()
        }
      })
    }

    // Initialize queued whisper count
    try {
      const stored = localStorage.getItem(OFFLINE_QUEUE_KEY)
      if (stored) {
        const queue: OfflineQueuedWhisper[] = JSON.parse(stored)
        setQueuedWhispersCount(queue.length)
      }
    } catch (e) {}

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Audio lifecycle
  useEffect(() => {
    if (!currentTrack) {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
      setIsPlaying(false)
      setCurrentTime(0)
      setDuration(0)
      return
    }

    const audio = audioRef.current || new Audio()
    audioRef.current = audio
    audio.src = currentTrack.audioUrl
    audio.playbackRate = playbackRate
    audio.play().then(() => {
      setIsPlaying(true)
    }).catch((err) => {
      console.warn('Audio play error:', err)
      setIsPlaying(false)
    })

    audio.onloadedmetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration)
      }
    }

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime)
    }

    audio.onended = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }

    return () => {
      audio.pause()
    }
  }, [currentTrack])

  const playTrack = useCallback((track: GlobalAudioTrack) => {
    setCurrentTrack(track)
  }, [])

  const pauseTrack = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }, [])

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !currentTrack) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(console.warn)
    }
  }, [isPlaying, currentTrack])

  const seekTo = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }, [])

  const setRate = useCallback((rate: number) => {
    setPlaybackRate(rate)
    if (audioRef.current) {
      audioRef.current.playbackRate = rate
    }
  }, [])

  const closePlayer = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    setCurrentTrack(null)
    setIsPlaying(false)
  }, [])

  // Offline queueing
  const queueOfflineWhisper = useCallback(async (whisper: Omit<OfflineQueuedWhisper, 'id' | 'createdAt'>) => {
    try {
      const item: OfflineQueuedWhisper = {
        ...whisper,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      }
      const existing = localStorage.getItem(OFFLINE_QUEUE_KEY)
      const queue: OfflineQueuedWhisper[] = existing ? JSON.parse(existing) : []
      queue.push(item)
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
      setQueuedWhispersCount(queue.length)

      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const registration = await navigator.serviceWorker.ready
        await (registration as any).sync.register('sync-offline-whispers')
      }
    } catch (e) {
      console.error('Error queueing offline whisper:', e)
    }
  }, [])

  const syncQueuedWhispers = useCallback(async () => {
    try {
      const existing = localStorage.getItem(OFFLINE_QUEUE_KEY)
      if (!existing) return
      const queue: OfflineQueuedWhisper[] = JSON.parse(existing)
      if (queue.length === 0) return

      // Dynamic import to prevent circular dependency
      const { createSupabaseBrowserClient } = await import('@/lib/supabase/client')
      const supabase = createSupabaseBrowserClient()

      const remaining: OfflineQueuedWhisper[] = []

      for (const item of queue) {
        try {
          const { error } = await supabase.from('whispers').insert({
            recipient_id: item.recipientId,
            content: item.content,
          })
          if (error) throw error
        } catch (postErr) {
          console.warn('Retry later for whisper:', postErr)
          remaining.push(item)
        }
      }

      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining))
      setQueuedWhispersCount(remaining.length)
    } catch (e) {
      console.error('Failed syncing offline whispers:', e)
    }
  }, [])

  return (
    <AudioPlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        playbackRate,
        isOffline,
        playTrack,
        pauseTrack,
        togglePlay,
        seekTo,
        setRate,
        closePlayer,
        queueOfflineWhisper,
        queuedWhispersCount,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  )
}

export function useAudioPlayer(): AudioContextType {
  const context = useContext(AudioPlayerContext)
  if (!context) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider')
  }
  return context
}
