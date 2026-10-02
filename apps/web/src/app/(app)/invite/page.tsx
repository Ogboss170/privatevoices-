'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, UserPlus, Copy, Share2, Check } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function InviteFriendsPage(): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const [username, setUsername] = useState<string>('username')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', data.user.id)
          .single()

        if (prof?.username) {
          setUsername(prof.username)
        }
      }
      setLoading(false)
    })
  }, [supabase])

  const inviteLink = `https://privatevoices.app/invite/${username}`

  function handleCopy() {
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleNativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on Private Voices',
          text: `Join me on Private Voices! Connect with friends, share anonymous Whispers, and join topic communities: ${inviteLink}`,
          url: inviteLink,
        })
      } catch (err) {
        handleCopy()
      }
    } else {
      handleCopy()
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-16">
      {/* Header Bar */}
      <div className="flex items-center space-x-3">
        <Link
          href="/settings"
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
          title="Back to Settings"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Invite Friends</h1>
      </div>

      {/* Main Invite Card */}
      <div className="card p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center mx-auto text-2xl shadow-inner">
          <UserPlus size={32} />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-gray-900">Bring your friends to Private Voices</h2>
          <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
            Share your unique invite link so your friends can join your network, exchange anonymous Whispers, and explore communities.
          </p>
        </div>

        {/* Invite Link Box */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center justify-between max-w-md mx-auto">
          <span className="text-xs font-mono text-gray-700 truncate pl-2">{inviteLink}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm transition-colors flex-shrink-0"
          >
            {copied ? (
              <>
                <Check size={14} className="text-emerald-600" />
                <span className="text-emerald-600">Copied</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 max-w-md mx-auto">
          <button
            onClick={handleNativeShare}
            className="w-full btn-primary text-sm py-3 flex items-center justify-center gap-2"
          >
            <Share2 size={16} />
            <span>Invite Friends</span>
          </button>
        </div>
      </div>
    </div>
  )
}
