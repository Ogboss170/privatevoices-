'use client'

import React from 'react'
import CreatePostComposer from '@/components/feed/CreatePostComposer'
import { useRouter } from 'next/navigation'

export default function CreatePage(): React.JSX.Element {
  const router = useRouter()

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Create Post</h1>
      </div>

      <CreatePostComposer
        onPostCreated={() => {
          router.push('/feed')
        }}
      />
    </div>
  )
}
