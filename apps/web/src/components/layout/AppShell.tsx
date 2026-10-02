'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, PlusSquare, Inbox, Users, User, Bell } from 'lucide-react'
import RightSidebar from '@/components/layout/RightSidebar'

const NAV_ITEMS = [
  { href: '/feed',        label: 'Home',        Icon: Home },
  { href: '/explore',     label: 'Explore',     Icon: Search },
  { href: '/create',      label: 'Create',      Icon: PlusSquare },
  { href: '/inbox',       label: 'Inbox',       Icon: Inbox },
  { href: '/communities', label: 'Communities', Icon: Users },
  { href: '/notifications', label: 'Notifications', Icon: Bell },
  { href: '/profile',     label: 'Profile',     Icon: User },
]

export default function AppShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const pathname = usePathname()

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
            {NAV_ITEMS.map(({ href, label, Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  <span>{label}</span>
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
          <main className="max-w-2xl w-full mx-auto px-4 py-6">
            {children}
          </main>
        </div>

        {/* ── Right Sidebar (desktop widgets) ── */}
        <RightSidebar />
      </div>

      {/* ── Bottom tab bar (mobile) ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-gray-200 flex items-center justify-around px-2 py-2 z-20 shadow-lg">
        {NAV_ITEMS.slice(0, 5).map(({ href, label, Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                isActive ? 'text-brand-600 font-bold' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px]">{label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
