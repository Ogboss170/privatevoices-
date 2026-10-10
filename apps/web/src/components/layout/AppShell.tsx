'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, PlusSquare, Inbox, Users, User, Bell, Radio, Feather } from 'lucide-react'
import RightSidebar from '@/components/layout/RightSidebar'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useWebTheme } from '@/context/WebThemeContext'

export default function AppShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const pathname = usePathname()
  const { t } = useWebTheme()
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [unreadMessages, setUnreadMessages] = useState(0)

  const desktopNavItems = [
    { href: '/feed',          label: t.home,          Icon: Home },
    { href: '/explore',       label: t.explore,       Icon: Search },
    { href: '/spaces',        label: 'Spaces',        Icon: Radio },
    { href: '/create',        label: t.create,        Icon: PlusSquare },
    { href: '/inbox',         label: t.inbox,         Icon: Inbox },
    { href: '/communities',   label: t.community,     Icon: Users },
    { href: '/notifications', label: t.notifications, Icon: Bell },
    { href: '/profile',       label: t.profile,       Icon: User },
  ]

  const mobileBottomNavItems = [
    { href: '/feed',        label: t.home,      Icon: Home },
    { href: '/spaces',      label: 'Spaces',    Icon: Radio },
    { href: '/explore',     label: t.explore,   Icon: Search },
    { href: '/inbox',       label: t.inbox,     Icon: Inbox },
    { href: '/profile',     label: t.profile,   Icon: User },
  ]

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
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex justify-center text-gray-900 dark:text-gray-100 transition-colors">
      <div className="flex w-full max-w-7xl">
        {/* ── Sidebar (desktop: X aesthetic) ── */}
        <aside className="hidden md:flex flex-col w-64 xl:w-72 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-r border-gray-100 dark:border-slate-800 px-4 py-4 sticky top-0 h-screen z-10 flex-shrink-0">
          {/* Logo: X Icon Brandmark */}
          <div className="px-3 mb-4">
            <Link href="/feed" className="flex items-center gap-3 group w-fit">
              <div className="w-10 h-10 rounded-full bg-gray-900 dark:bg-white flex items-center justify-center text-white dark:text-gray-900 font-black text-lg tracking-tighter shadow-sm group-hover:scale-105 transition-transform">
                𝕏
              </div>
              <span className="font-extrabold text-lg text-gray-900 dark:text-white tracking-tight">
                Private Voices
              </span>
            </Link>
          </div>

          {/* Nav links */}
          <nav className="flex-1 space-y-1">
            {desktopNavItems.map(({ href, label, Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + '/')
              const badgeCount =
                href === '/notifications' ? unreadNotifications : href === '/inbox' ? unreadMessages : 0

              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center justify-between px-4 py-3 rounded-full text-[15px] font-semibold transition-all group ${
                    isActive
                      ? 'bg-gray-100 dark:bg-slate-800 text-gray-950 dark:text-white font-bold'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-slate-800/60 hover:text-gray-950 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <Icon size={22} strokeWidth={isActive ? 2.6 : 2} className="transition-transform group-hover:scale-110" />
                    <span>{label}</span>
                  </div>

                  {badgeCount > 0 && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-bold transition-transform ${
                        isActive
                          ? 'bg-brand-600 text-white'
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

          {/* Quick Create Post (X Post Button) */}
          <div className="pt-3 border-t border-gray-100 dark:border-slate-800">
            <Link
              href="/create"
              className="w-full py-3.5 bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-950 font-bold rounded-full shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Feather size={18} strokeWidth={2.4} />
              <span>Post</span>
            </Link>
          </div>
        </aside>

        {/* ── Main Feed Content ── */}
        <div className="flex-1 min-w-0 min-h-screen border-r border-gray-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40">
          <main className="max-w-2xl w-full mx-auto px-4 py-4 md:py-6 pb-20 md:pb-6">
            {children}
          </main>
        </div>

        {/* ── Right Sidebar (desktop widgets) ── */}
        <RightSidebar />
      </div>

        {/* ── Bottom tab bar (mobile view: X minimalist icon dock) ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-gray-100 dark:border-slate-800 flex items-center justify-around px-2 py-2.5 z-20 transition-colors">
        {mobileBottomNavItems.map(({ href, Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          const badgeCount =
            href === '/notifications' ? unreadNotifications : href === '/inbox' ? unreadMessages : 0

          return (
            <Link
              key={href}
              href={href}
              className={`p-2 rounded-full transition-transform active:scale-90 relative ${
                isActive ? 'text-gray-950 dark:text-white' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <div className="relative">
                <Icon size={24} strokeWidth={isActive ? 2.6 : 2} />
                {badgeCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-brand-600 rounded-full ring-2 ring-white dark:ring-slate-900" />
                )}
              </div>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
