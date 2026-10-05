'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, PlusSquare, Inbox, Users, User, Bell } from 'lucide-react'
import RightSidebar from '@/components/layout/RightSidebar'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

const DESKTOP_NAV_ITEMS = [
  { href: '/feed',        label: 'Home',        Icon: Home },
  { href: '/explore',     label: 'Explore',     Icon: Search },
  { href: '/create',      label: 'Create',      Icon: PlusSquare },
  { href: '/inbox',       label: 'Inbox',       Icon: Inbox },
  { href: '/communities', label: 'Communities', Icon: Users },
  { href: '/notifications', label: 'Notifications', Icon: Bell },
  { href: '/profile',     label: 'Profile',     Icon: User },
]

const MOBILE_BOTTOM_NAV_ITEMS = [
  { href: '/feed',        label: 'Home',      Icon: Home },
  { href: '/explore',     label: 'Explore',   Icon: Search },
  { href: '/communities', label: 'Community', Icon: Users },
  { href: '/inbox',       label: 'Chat',      Icon: Inbox },
  { href: '/profile',     label: 'Profile',   Icon: User },
]

export default function AppShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const pathname = usePathname()
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [unreadMessages, setUnreadMessages] = useState(0)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()

    async function fetchCounts() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // 1. Unread notifications
        const { count: notifCount } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false)

        setUnreadNotifications(notifCount || 0)

        // 2. Unread whispers
        const { count: whisperCount } = await supabase
          .from('whispers')
          .select('*', { count: 'exact', head: true })
          .eq('recipient_id', user.id)
          .eq('is_read', false)

        // 3. Unread direct messages
        const { data: userConvs } = await supabase
          .from('conversations')
          .select('id')
          .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)

        let dmCount = 0
        if (userConvs && userConvs.length > 0) {
          const convIds = userConvs.map((c: any) => c.id)
          const { count: unreadDmCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .in('conversation_id', convIds)
            .eq('is_read', false)
            .neq('sender_id', user.id)

          dmCount = unreadDmCount || 0
        }

        setUnreadMessages((whisperCount || 0) + dmCount)
      } catch (err) {
        console.error('Error fetching shell counts:', err)
      }
    }

    fetchCounts()

    const channel = supabase
      .channel('appshell:live_counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        fetchCounts()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        fetchCounts()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whispers' }, () => {
        fetchCounts()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [pathname])

  const isCreatePage = pathname === '/create' || pathname.startsWith('/create/')
  if (isCreatePage) {
    return <div className="min-h-screen bg-white text-gray-900">{children}</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="flex w-full max-w-7xl">
        {/* ── Sidebar (desktop) ── */}
        <aside className="hidden md:flex flex-col w-64 xl:w-72 bg-white/80 backdrop-blur-md border-r border-gray-200/80 px-4 py-6 sticky top-0 h-screen z-10 flex-shrink-0">
          {/* Logo */}
          <div className="px-3 mb-8">
            <Link href="/feed" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-105 transition-transform">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C6.48 2 2 6.48 2 12C2 14.05 2.61 15.96 3.65 17.56L2 22L6.44 20.35C8.04 21.39 9.95 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z" fill="white"/>
                </svg>
              </div>
              <span className="font-extrabold text-lg text-gray-900 tracking-tight">Private Voices</span>
            </Link>
          </div>

          {/* Nav links */}
          <nav className="flex-1 space-y-1.5">
            {DESKTOP_NAV_ITEMS.map(({ href, label, Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + '/')
              const badgeCount =
                href === '/notifications' ? unreadNotifications : href === '/inbox' ? unreadMessages : 0

              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                    <span>{label}</span>
                  </div>

                  {badgeCount > 0 && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-bold transition-transform ${
                        isActive
                          ? 'bg-white text-brand-600'
                          : 'bg-brand-600 text-white shadow-xs'
                      }`}
                    >
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Quick Create Button */}
          <div className="pt-4 border-t border-gray-100">
            <Link
              href="/create"
              className="w-full py-3 bg-gradient-to-r from-brand-600 to-purple-600 text-white font-bold rounded-xl shadow-md hover:shadow-lg hover:brightness-105 transition-all flex items-center justify-center gap-2 text-sm"
            >
              <PlusSquare size={18} />
              <span>Create Voice</span>
            </Link>
          </div>
        </aside>

        {/* ── Main Feed Content ── */}
        <div className="flex-1 min-w-0 min-h-screen border-r border-gray-200/60 bg-white/40">
          <main className="max-w-2xl w-full mx-auto px-4 py-6 pt-14 md:pt-6 pb-16 md:pb-6">
            {children}
          </main>
        </div>

        {/* ── Right Sidebar (desktop widgets) ── */}
        <RightSidebar />
      </div>

        {/* ── Mobile Top Header (visible only on mobile web) ── */}
        <header className="md:hidden fixed top-0 inset-x-0 bg-white/95 backdrop-blur-md border-b border-gray-200 z-20 shadow-sm">
          <div className="flex items-center justify-between h-11 px-3">
            {/* Left: + Create */}
            <Link
              href="/create"
              className="p-2 rounded-xl text-brand-600 hover:bg-brand-50 transition-colors"
              aria-label="Create"
            >
              <PlusSquare size={22} strokeWidth={2.2} />
            </Link>

            {/* Center: PRIVATE VOICES — absolutely centred */}
            <span
              className="absolute inset-x-0 text-center text-xs font-extrabold text-gray-900 tracking-[0.18em] pointer-events-none select-none uppercase"
              style={{ letterSpacing: '1.6px' }}
            >
              Private Voices
            </span>

            {/* Right: Bell with unread badge */}
            <Link
              href="/notifications"
              className="relative p-2 rounded-xl text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label={unreadNotifications > 0 ? `${unreadNotifications} unread notifications` : 'Notifications'}
            >
              <Bell size={22} strokeWidth={2} />
              {unreadNotifications > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full px-1 ring-2 ring-white">
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              )}
            </Link>
          </div>
        </header>

        {/* ── Bottom tab bar (mobile view on web) ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-gray-200 flex items-center justify-around px-2 py-2 z-20 shadow-lg">
        {MOBILE_BOTTOM_NAV_ITEMS.map(({ href, label, Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          const badgeCount =
            href === '/notifications' ? unreadNotifications : href === '/inbox' ? unreadMessages : 0

          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors relative ${
                isActive ? 'text-brand-600 font-bold' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                {badgeCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white" />
                )}
              </div>
              <span className="text-[10px]">{label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
