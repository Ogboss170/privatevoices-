'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { LiveSpace, SpaceParticipant } from '@private-voices/shared'

interface ActiveSpaceSession {
  spaceId: string
  title: string
  topic?: string | null
  hostName: string
  speakerCount: number
  listenerCount: number
  role: 'host' | 'speaker' | 'listener'
  isMuted: boolean
  handRaised: boolean
  isMasked: boolean
  maskedPersona?: string | null
  voiceFilter?: string
}

interface ActiveSpaceContextType {
  activeSession: ActiveSpaceSession | null
  isModalOpen: boolean
  isMinimized: boolean
  joinSpace: (spaceId: string) => Promise<void>
  leaveSpace: () => Promise<void>
  openModal: () => void
  closeModal: () => void
  minimizeSpace: () => void
  expandSpace: () => void
  toggleMute: () => Promise<void>
  toggleHandRaise: () => Promise<void>
  toggleMasked: (isMasked: boolean, persona?: string) => Promise<void>
}

const ActiveSpaceContext = createContext<ActiveSpaceContextType | undefined>(undefined)

export function ActiveSpaceProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()

  const [activeSession, setActiveSession] = useState<ActiveSpaceSession | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
  }, [supabase])

  // Join a Space
  const joinSpace = useCallback(
    async (spaceId: string) => {
      try {
        const { data: spaceData } = await supabase
          .from('spaces')
          .select(`
            id,
            title,
            topic,
            host_id,
            speaker_count,
            listener_count,
            host:profiles!spaces_host_id_fkey(id, username, display_name)
          `)
          .eq('id', spaceId)
          .single()

        if (!spaceData) return

        const { data: userData } = await supabase.auth.getUser()
        const uid = userData?.user?.id
        const isHost = spaceData.host_id === uid

        // Upsert participant
        const { data: partData } = await supabase
          .from('space_participants')
          .select('*')
          .eq('space_id', spaceId)
          .eq('user_id', uid)
          .maybeSingle()

        const hostName = (spaceData.host as any)?.display_name || (spaceData.host as any)?.username || 'Host'

        setActiveSession({
          spaceId: spaceData.id,
          title: spaceData.title,
          topic: spaceData.topic,
          hostName,
          speakerCount: spaceData.speaker_count || 1,
          listenerCount: spaceData.listener_count || 0,
          role: partData?.role || (isHost ? 'host' : 'listener'),
          isMuted: partData?.is_muted ?? (isHost ? false : true),
          handRaised: partData?.hand_raised ?? false,
          isMasked: partData?.is_masked ?? false,
          maskedPersona: partData?.masked_persona ?? 'Thoughtful Owl',
          voiceFilter: partData?.voice_filter ?? 'none',
        })

        setIsModalOpen(true)
        setIsMinimized(false)
      } catch (err) {
        console.error('Error joining space session:', err)
      }
    },
    [supabase]
  )

  // Leave active space
  const leaveSpace = useCallback(async () => {
    if (!activeSession || !currentUserId) {
      setActiveSession(null)
      setIsModalOpen(false)
      setIsMinimized(false)
      return
    }

    try {
      await supabase
        .from('space_participants')
        .delete()
        .eq('space_id', activeSession.spaceId)
        .eq('user_id', currentUserId)

      if (activeSession.role === 'host') {
        await supabase
          .from('spaces')
          .update({ status: 'ended', ended_at: new Date().toISOString() })
          .eq('id', activeSession.spaceId)
      }
    } catch (err) {
      console.error('Error leaving space session:', err)
    } finally {
      setActiveSession(null)
      setIsModalOpen(false)
      setIsMinimized(false)
    }
  }, [activeSession, currentUserId, supabase])

  const openModal = useCallback(() => {
    setIsModalOpen(true)
    setIsMinimized(false)
  }, [])

  const closeModal = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  const minimizeSpace = useCallback(() => {
    setIsModalOpen(false)
    setIsMinimized(true)
  }, [])

  const expandSpace = useCallback(() => {
    setIsModalOpen(true)
    setIsMinimized(false)
  }, [])

  // Toggle Mute
  const toggleMute = useCallback(async () => {
    if (!activeSession || !currentUserId) return
    const nextMuted = !activeSession.isMuted
    setActiveSession((prev) => (prev ? { ...prev, isMuted: nextMuted } : null))

    await supabase
      .from('space_participants')
      .update({ is_muted: nextMuted })
      .eq('space_id', activeSession.spaceId)
      .eq('user_id', currentUserId)
  }, [activeSession, currentUserId, supabase])

  // Toggle Hand Raise
  const toggleHandRaise = useCallback(async () => {
    if (!activeSession || !currentUserId) return
    const nextHand = !activeSession.handRaised
    setActiveSession((prev) => (prev ? { ...prev, handRaised: nextHand } : null))

    await supabase
      .from('space_participants')
      .update({ hand_raised: nextHand })
      .eq('space_id', activeSession.spaceId)
      .eq('user_id', currentUserId)
  }, [activeSession, currentUserId, supabase])

  // Toggle Masked Voice
  const toggleMasked = useCallback(
    async (isMasked: boolean, persona?: string) => {
      if (!activeSession || !currentUserId) return
      const personaToSave = persona || activeSession.maskedPersona || 'Thoughtful Owl'

      setActiveSession((prev) =>
        prev
          ? {
              ...prev,
              isMasked,
              maskedPersona: personaToSave,
            }
          : null
      )

      await supabase
        .from('space_participants')
        .update({
          is_masked: isMasked,
          masked_persona: isMasked ? personaToSave : null,
        })
        .eq('space_id', activeSession.spaceId)
        .eq('user_id', currentUserId)
    },
    [activeSession, currentUserId, supabase]
  )

  return (
    <ActiveSpaceContext.Provider
      value={{
        activeSession,
        isModalOpen,
        isMinimized,
        joinSpace,
        leaveSpace,
        openModal,
        closeModal,
        minimizeSpace,
        expandSpace,
        toggleMute,
        toggleHandRaise,
        toggleMasked,
      }}
    >
      {children}
    </ActiveSpaceContext.Provider>
  )
}

export function useActiveSpace() {
  const context = useContext(ActiveSpaceContext)
  if (!context) {
    throw new Error('useActiveSpace must be used within an ActiveSpaceProvider')
  }
  return context
}
