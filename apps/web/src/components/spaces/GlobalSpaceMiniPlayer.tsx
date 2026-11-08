'use client'

import React from 'react'
import {
  Radio,
  Mic,
  MicOff,
  Hand,
  ChevronUp,
  LogOut,
  Users,
  Sparkles,
} from 'lucide-react'
import { useActiveSpace } from '@/context/ActiveSpaceContext'

export function GlobalSpaceMiniPlayer(): React.JSX.Element | null {
  const {
    activeSession,
    isMinimized,
    expandSpace,
    leaveSpace,
    toggleMute,
    toggleHandRaise,
  } = useActiveSpace()

  if (!activeSession || !isMinimized) {
    return null
  }

  const isSpeaker = activeSession.role === 'host' || activeSession.role === 'speaker'

  return (
    <div className="fixed bottom-16 sm:bottom-6 right-4 z-50 pointer-events-none">
      <div className="pointer-events-auto bg-gray-950/95 backdrop-blur-xl border border-purple-500/30 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom duration-200">
        {/* Pulsing Live Audio Icon */}
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 to-purple-600 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
          <Radio size={16} className="animate-pulse" />
        </div>

        {/* Space Info */}
        <div
          onClick={expandSpace}
          className="cursor-pointer max-w-[130px] sm:max-w-[190px] min-w-0 pr-1 group"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-black uppercase tracking-wider text-rose-400 bg-rose-500/20 px-1.5 py-0.2 rounded-full border border-rose-500/30">
              LIVE
            </span>
            <span className="text-[10px] text-gray-400 truncate">
              {activeSession.hostName}
            </span>
          </div>
          <h4 className="text-xs font-bold text-white truncate group-hover:text-purple-300 transition-colors">
            {activeSession.title}
          </h4>
        </div>

        {/* Quick Controls */}
        <div className="flex items-center gap-1.5 border-l border-white/15 pl-2">
          {/* Mute/Unmute for speakers */}
          {isSpeaker && (
            <button
              onClick={toggleMute}
              className={`p-1.5 rounded-xl transition-all ${
                activeSession.isMuted
                  ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
              }`}
              title={activeSession.isMuted ? 'Unmute' : 'Mute'}
            >
              {activeSession.isMuted ? <MicOff size={14} /> : <Mic size={14} />}
            </button>
          )}

          {/* Raise Hand for listeners */}
          {!isSpeaker && (
            <button
              onClick={toggleHandRaise}
              className={`p-1.5 rounded-xl transition-all ${
                activeSession.handRaised
                  ? 'bg-amber-500 text-gray-950 font-bold'
                  : 'bg-white/10 text-gray-300 hover:text-white hover:bg-white/15'
              }`}
              title={activeSession.handRaised ? 'Lower Hand' : 'Raise Hand'}
            >
              <Hand size={14} />
            </button>
          )}

          {/* Expand to Full Stage */}
          <button
            onClick={expandSpace}
            className="p-1.5 text-gray-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
            title="Expand Voice Stage"
          >
            <ChevronUp size={16} />
          </button>

          {/* Leave Room Quietly */}
          <button
            onClick={leaveSpace}
            className="p-1.5 text-rose-400 hover:text-rose-300 rounded-xl hover:bg-rose-500/20 transition-colors"
            title="Leave Quietly"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
