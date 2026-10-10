'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  UserPlus,
  Copy,
  Share2,
  Check,
  QrCode,
  Sparkles,
  Users,
  Send,
  MessageCircle,
  ExternalLink,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function InviteFriendsPage(): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const [username, setUsername] = useState<string>('')
  const [displayName, setDisplayName] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)
  const [inviteStats, setInviteStats] = useState<{ invitedCount: number }>({ invitedCount: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('id, username, display_name')
          .eq('id', data.user.id)
          .single()

        if (prof?.username) {
          setUsername(prof.username)
          setDisplayName(prof.display_name || prof.username)
        }

        // Count users who joined via referral if available
        try {
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('referred_by', data.user.id)
          if (count !== null) {
            setInviteStats({ invitedCount: count })
          }
        } catch {
          // Fallback safe
        }
      }
      setLoading(false)
    })
  }, [supabase])

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://privatevoices.app'
  const inviteLink = `${origin}/invite/${username || 'you'}`

  const inviteMessage = `Hey! I'm on Private Voices — join me to connect freely, share candid moments, and send anonymous Whispers: ${inviteLink}`

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
          text: inviteMessage,
          url: inviteLink,
        })
      } catch {
        handleCopy()
      }
    } else {
      handleCopy()
    }
  }

  // Pre-configured social share URLs
  const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    `Join me on Private Voices! 🤫🔒 Connect freely and share anonymous Whispers: ${inviteLink}`
  )}`
  const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(inviteMessage)}`
  const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(
    `Join me on Private Voices!`
  )}`

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-16 px-4 sm:px-0">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            href="/settings"
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
            title="Back to Settings"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Invite Friends</h1>
            <p className="text-xs text-gray-500">Share your invite link & QR code with your friends</p>
          </div>
        </div>

        <button
          onClick={() => setShowQrModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors shadow-sm"
        >
          <QrCode size={14} className="text-brand-600" />
          <span>Show QR Code</span>
        </button>
      </div>

      {/* Main Invite Card */}
      <div className="card p-6 sm:p-8 text-center space-y-6 border border-gray-200/80 shadow-sm rounded-2xl bg-white">
        <div className="relative inline-block mx-auto">
          <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-inner">
            <UserPlus size={32} />
          </div>
          <span className="absolute -bottom-1 -right-1 p-1 bg-emerald-500 text-white rounded-full">
            <Sparkles size={12} />
          </span>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            Bring your friends to Private Voices
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
            When friends join through your link, they will automatically follow you and get direct access to your public Voices and anonymous Whispers.
          </p>
        </div>

        {/* Invite Link Box */}
        <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-2.5 sm:p-3 flex items-center justify-between max-w-md mx-auto shadow-inner">
          <span className="text-xs font-mono text-gray-700 truncate pl-2">{inviteLink}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm transition-colors flex-shrink-0 ml-2"
          >
            {copied ? (
              <>
                <Check size={14} className="text-emerald-600" />
                <span className="text-emerald-600">Copied!</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>Copy Link</span>
              </>
            )}
          </button>
        </div>

        {/* Quick Action Share Row */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
          <button
            onClick={handleNativeShare}
            className="w-full btn-primary text-sm py-3 flex items-center justify-center gap-2 rounded-xl shadow-md shadow-brand-500/20"
          >
            <Share2 size={16} />
            <span>Share Invite Link</span>
          </button>
          <button
            onClick={() => setShowQrModal(true)}
            className="w-full sm:w-auto px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <QrCode size={16} className="text-brand-600" />
            <span className="hidden sm:inline">QR</span>
            <span className="sm:hidden">View QR</span>
          </button>
        </div>

        {/* Quick Share to Social Apps */}
        <div className="pt-2 border-t border-gray-100 max-w-md mx-auto">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Or share directly via
          </p>
          <div className="grid grid-cols-3 gap-2">
            <a
              href={whatsappShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 text-xs font-semibold transition-colors"
            >
              <MessageCircle size={14} />
              <span>WhatsApp</span>
            </a>
            <a
              href={telegramShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-sky-50 hover:bg-sky-100/80 text-sky-700 text-xs font-semibold transition-colors"
            >
              <Send size={14} />
              <span>Telegram</span>
            </a>
            <a
              href={twitterShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-semibold transition-colors"
            >
              <ExternalLink size={14} />
              <span>X / Twitter</span>
            </a>
          </div>
        </div>
      </div>

      {/* Referral Info & Perks Box */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
        <div className="p-4 rounded-xl bg-white border border-gray-200/80 space-y-1">
          <div className="flex items-center gap-2 text-brand-600 mb-1">
            <Users size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Your Friends</span>
          </div>
          <p className="text-xl font-extrabold text-gray-900">{inviteStats.invitedCount}</p>
          <p className="text-xs text-gray-500">Friends who joined Private Voices with your link.</p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-gray-200/80 space-y-1">
          <div className="flex items-center gap-2 text-amber-500 mb-1">
            <Sparkles size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Early Supporter</span>
          </div>
          <p className="text-xs font-medium text-gray-700">Invite 3 friends to unlock preview perks and community badges.</p>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-5 shadow-2xl border border-gray-100">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-gray-900">Scan to Join</h3>
              <p className="text-xs text-gray-500">Point phone camera to join @{username || 'user'}</p>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-gray-200 inline-block shadow-inner mx-auto">
              <QRCodeSVG
                value={inviteLink}
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>

            <p className="text-xs font-mono text-gray-500 truncate max-w-xs mx-auto">
              {inviteLink}
            </p>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCopy}
                className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <button
                onClick={() => setShowQrModal(false)}
                className="flex-1 btn-primary py-2.5 px-4 rounded-xl text-xs font-bold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

