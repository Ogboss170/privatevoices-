'use client'

import React, { useEffect, useState } from 'react'
import { useActiveSpace } from '@/context/ActiveSpaceContext'
import { LiveSpaceModal } from '@/components/spaces/LiveSpaceModal'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export function GlobalLiveSpaceModal(): React.JSX.Element | null {
  const { activeSession, isModalOpen, closeModal } = useActiveSpace()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentUserId(data.user.id)
      }
    })
  }, [supabase])

  if (!activeSession || !isModalOpen || !currentUserId) {
    return null
  }

  return (
    <LiveSpaceModal
      spaceId={activeSession.spaceId}
      currentUserId={currentUserId}
      isOpen={isModalOpen}
      onClose={closeModal}
    />
  )
}
