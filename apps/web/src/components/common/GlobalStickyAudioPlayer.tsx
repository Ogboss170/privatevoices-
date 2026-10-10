'use client'

import React from 'react'
import Image from 'next/image'
import {
  Play,
  Pause,
  X,
  Volume2,
  WifiOff,
  FastForward,
  RotateCcw,
  Sparkles
} from 'lucide-react'
import { useAudioPlayer } from '@/context/AudioPlayerContext'

export function GlobalStickyAudioPlayer(): React.JSX.Element | null {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    isOffline,
    togglePlay,
    seekTo,
    setRate,
    closePlayer,
    queuedWhispersCount,
  } = useAudioPlayer()

  if (!currentTrack && !isOffline && queuedWhispersCount === 0) {
    return null
  }

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00'
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="fixed bottom-14 sm:bottom-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-lg px-3 pointer-events-none">
      <div className="pointer-events-auto bg-gray-950/95 backdrop-blur-xl border border-white/10 text-white rounded-2xl shadow-2xl p-3 flex flex-col gap-2 animate-in slide-in-from-bottom duration-200">
        {/* Offline sync badge if offline or queued items exist */}
        {isOffline && (
          <div className="flex items-center justify-between px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 text-[11px] font-semibold border border-amber-500/30">
            <span className="flex items-center gap-1.5">
              <WifiOff size={12} />
              <span>Offline Mode — Audio notes playing from local cache</span>
            </span>
            {queuedWhispersCount > 0 && (
              <span className="bg-amber-500 text-gray-950 px-1.5 py-0.2 rounded-full font-bold text-[10px]">
                {queuedWhispersCount} queued
              </span>
            )}
          </div>
        )}

        {currentTrack && (
          <>
            {/* Scrubber Progress Bar */}
            <div
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const clickPos = (e.clientX - rect.left) / rect.width
                seekTo(clickPos * duration)
              }}
              className="w-full h-1.5 bg-white/15 rounded-full cursor-pointer relative overflow-hidden group"
            >
              <div
                className="h-full bg-gradient-to-r from-rose-500 to-indigo-500 rounded-full relative transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Track Info & Controls */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-xs overflow-hidden">
                  {currentTrack.avatarUrl ? (
                    <Image
                      src={currentTrack.avatarUrl}
                      alt={currentTrack.title}
                      width={36}
                      height={36}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Volume2 size={16} />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-white truncate">
                    {currentTrack.title}
                  </h4>
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                    <span>{formatTime(currentTime)}</span>
                    <span>/</span>
                    <span>{formatTime(duration)}</span>
                    {currentTrack.subtitle && (
                      <>
                        <span>•</span>
                        <span className="truncate">{currentTrack.subtitle}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Controls */}
              <div className="flex items-center gap-1.5">
                {/* Speed toggle */}
                <button
                  onClick={() => {
                    const next = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1
                    setRate(next)
                  }}
                  className="px-2 py-1 rounded-lg text-[10px] font-extrabold bg-white/10 text-gray-300 hover:text-white hover:bg-white/15"
                >
                  {playbackRate}x
                </button>

                {/* Rewind 10s */}
                <button
                  onClick={() => seekTo(Math.max(0, currentTime - 10))}
                  className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10"
                  title="Rewind 10s"
                >
                  <RotateCcw size={15} />
                </button>

                {/* Play/Pause */}
                <button
                  onClick={togglePlay}
                  className="p-2 rounded-xl bg-white text-gray-950 hover:bg-gray-200 transition-colors shadow-md"
                >
                  {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
                </button>

                {/* Close */}
                <button
                  onClick={closePlayer}
                  className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10"
                  title="Close Player"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
