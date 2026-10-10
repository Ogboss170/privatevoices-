import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { UserPlus, Sparkles, Shield, ArrowRight, CheckCircle2 } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'

interface InvitePageProps {
  params: Promise<{ username: string }>
}

export default async function PublicInvitePage({ params }: InvitePageProps) {
  const { username } = await params
  const supabase = await createSupabaseServerClient()

  const { data: inviter } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio')
    .ilike('username', username)
    .maybeSingle()

  if (!inviter) {
    notFound()
  }

  const displayName = inviter.display_name || `@${inviter.username}`

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col justify-between">
      {/* Top Bar */}
      <header className="px-6 py-5 border-b border-slate-100 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center text-white font-black text-sm shadow-sm">
              PV
            </div>
            <span className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
              Private Voices
            </span>
          </div>

          <Link
            href="/login"
            className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-brand-600 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Main Invite Hero */}
      <main className="flex-1 max-w-lg mx-auto w-full px-6 py-12 flex flex-col items-center justify-center text-center">
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-brand-500 via-indigo-500 to-amber-400 shadow-xl">
            <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-slate-800 flex items-center justify-center text-3xl font-extrabold text-brand-600">
              {inviter.avatar_url ? (
                <Image
                  src={inviter.avatar_url}
                  alt={displayName}
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                />
              ) : (
                displayName.charAt(0).toUpperCase()
              )}
            </div>
          </div>
          <div className="absolute -bottom-1 -right-1 p-1.5 bg-emerald-500 text-white rounded-full shadow-md">
            <UserPlus size={16} />
          </div>
        </div>

        <div className="space-y-2 mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 text-xs font-semibold mb-2">
            <Sparkles size={13} />
            <span>Personal Invitation</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {displayName} invited you to join Private Voices
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
            {inviter.bio || 'Connect freely, share candid thoughts, and exchange anonymous Whispers.'}
          </p>
        </div>

        {/* Feature Badges Card */}
        <div className="w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 mb-8 text-left space-y-3.5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5">
              <Shield size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Full Privacy & Encryption</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Control who sees what with granular post visibility and anonymous Whispers.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5">
              <CheckCircle2 size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Instant Connection with {displayName}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">You will automatically follow {displayName} when you create your account.</p>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <div className="w-full space-y-3">
          <Link
            href={`/register?ref=${inviter.username}`}
            className="w-full py-3.5 px-6 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 transition-transform active:scale-[0.99]"
          >
            <span>Accept Invitation & Join</span>
            <ArrowRight size={16} />
          </Link>
          <p className="text-xs text-slate-400">
            Free forever. No invasive ad trackers.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-400 border-t border-slate-100 dark:border-slate-800/80">
        &copy; {new Date().getFullYear()} Private Voices. All rights reserved.
      </footer>
    </div>
  )
}
