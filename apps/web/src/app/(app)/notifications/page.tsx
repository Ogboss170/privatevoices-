'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CheckCheck,
  UserPlus,
  Heart,
  MessageCircle,
  MessageSquareQuote,
  AtSign,
  ShieldAlert,
  Sparkles,
  Users,
  Bell,
  Trash2,
  Lock,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { AppNotification, NotificationType } from '@private-voices/shared'

export default function NotificationsPage(): React.JSX.Element {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    const { data: userRes } = await supabase.auth.getUser()
    if (!userRes.user) {
      router.push('/login')
      return
    }

    const uId = userRes.user.id
    setCurrentUserId(uId)

    try {
      let { data, error } = await supabase
        .from('notifications')
        .select('*, actor:profiles!notifications_actor_id_fkey(id, username, display_name, avatar_url)')
        .eq('recipient_id', uId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error || !data) {
        console.warn('Notifications FK query failed, falling back to direct select:', error)
        const fallbackRes = await supabase
          .from('notifications')
          .select('*')
          .eq('recipient_id', uId)
          .order('created_at', { ascending: false })
          .limit(50)
        data = fallbackRes.data
      }

      if (data && data.length > 0) {
        // Collect actor IDs for any missing actor profiles
        const missingActorIds = data
          .filter((n: any) => n.actor_id && !n.actor)
          .map((n: any) => n.actor_id)

        let profileMap = new Map()
        if (missingActorIds.length > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url')
            .in('id', missingActorIds)
          profileMap = new Map((profs ?? []).map((p) => [p.id, p]))
        }

        const formatted: AppNotification[] = data.map((n: any) => {
          const actorData = n.actor || profileMap.get(n.actor_id)
          return {
            id: n.id,
            recipientId: n.recipient_id,
            actorId: n.type === 'whisper' ? null : n.actor_id,
            actor: n.type === 'whisper' || !actorData ? null : {
              id: actorData.id,
              username: actorData.username || 'user',
              displayName: actorData.display_name || actorData.displayName || 'User',
              avatarUrl: actorData.avatar_url || actorData.avatarUrl || null,
            },
            type: n.type,
            title: n.title,
            message: n.message,
            entityType: n.entity_type,
            entityId: n.entity_id,
            isRead: n.is_read,
            groupCount: n.group_count || 1,
            createdAt: n.created_at,
          }
        })
        setNotifications(formatted)
      } else {
        setNotifications([])
      }
    } catch (err) {
      console.error('Fatal notifications error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [supabase, router])

  useEffect(() => {
    fetchNotifications()

    // Realtime subscription for incoming notifications
    const channel = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          if (payload.new && payload.new.recipient_id === currentUserId) {
            fetchNotifications()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchNotifications, currentUserId, supabase])

  async function handleMarkAllAsRead() {
    if (!currentUserId) return
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', currentUserId)
      .eq('is_read', false)
  }

  async function handleNotificationClick(notif: AppNotification) {
    if (!notif.isRead && currentUserId) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      )
      await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id)
    }

    // Navigation target mapping
    switch (notif.entityType) {
      case 'post':
      case 'comment':
        router.push('/feed')
        break
      case 'profile':
        if (notif.actor?.username) router.push(`/@${notif.actor.username}`)
        else router.push('/profile')
        break
      case 'whisper':
        router.push('/inbox')
        break
      case 'chat':
        router.push('/inbox')
        break
      case 'community':
        router.push('/communities')
        break
      case 'security':
        router.push('/settings')
        break
      default:
        router.push('/feed')
        break
    }
  }

  async function handleDeleteNotification(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    await supabase.from('notifications').delete().eq('id', id)
  }

  function getNotificationIcon(type: NotificationType) {
    switch (type) {
      case 'follow':
      case 'follow_accept':
        return <UserPlus size={18} className="text-blue-500" />
      case 'post_like':
        return <Heart size={18} className="text-rose-500 fill-rose-500" />
      case 'post_comment':
      case 'comment_reply':
        return <MessageCircle size={18} className="text-emerald-500" />
      case 'whisper':
      case 'whisper_reply':
        return <MessageSquareQuote size={18} className="text-purple-500" />
      case 'mention':
      case 'story_mention':
        return <AtSign size={18} className="text-amber-500" />
      case 'community':
        return <Users size={18} className="text-indigo-500" />
      case 'system':
        return <ShieldAlert size={18} className="text-amber-600" />
      default:
        return <Bell size={18} className="text-brand-600" />
    }
  }

  function formatRelativeTime(dateStr: string) {
    const diff = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000)
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-16">
      {/* ── Header Bar ── */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div className="flex items-center space-x-3">
          <Link
            href="/feed"
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
            title="Back to Home"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
            {unreadCount > 0 && (
              <span className="bg-brand-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="flex items-center space-x-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-xl transition-colors"
          >
            <CheckCheck size={16} />
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      {/* ── Content List ── */}
      {loading ? (
        <div className="card p-12 text-center text-gray-400">
          <p className="text-sm">Loading notifications...</p>
        </div>
      ) : notifications.length === 0 ? (
        /* Empty State */
        <div className="card p-12 text-center space-y-3">
          <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center mx-auto text-2xl">
            <Sparkles size={32} />
          </div>
          <h2 className="text-lg font-bold text-gray-900">You're all caught up.</h2>
          <p className="text-xs text-gray-500 max-w-xs mx-auto">
            New activity, interactions, and updates will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const isAnonymous = notif.type === 'whisper' || !notif.actor
            return (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`card p-4 flex items-start justify-between gap-3 cursor-pointer transition-colors ${
                  notif.isRead
                    ? 'bg-white hover:bg-gray-50'
                    : 'bg-brand-50/40 border-brand-200/80 hover:bg-brand-50/70'
                }`}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Icon or Avatar */}
                  <div className="relative flex-shrink-0">
                    {isAnonymous ? (
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center font-bold text-purple-600">
                        🤫
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-700">
                        {notif.actor?.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-gray-100">
                      {getNotificationIcon(notif.type)}
                    </div>
                  </div>

                  {/* Text Content */}
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <p
                      className={`text-xs ${
                        notif.isRead ? 'text-gray-700 font-normal' : 'text-gray-900 font-semibold'
                      }`}
                    >
                      {notif.message}
                    </p>
                    <span className="text-[11px] text-gray-400 block">
                      {formatRelativeTime(notif.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Right Status / Delete */}
                <div className="flex items-center gap-2 flex-shrink-0 self-center">
                  {!notif.isRead && (
                    <span className="w-2.5 h-2.5 bg-brand-600 rounded-full" />
                  )}
                  <button
                    onClick={(e) => handleDeleteNotification(notif.id, e)}
                    className="p-1 text-gray-300 hover:text-red-500 rounded-md transition-colors"
                    title="Delete notification"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
