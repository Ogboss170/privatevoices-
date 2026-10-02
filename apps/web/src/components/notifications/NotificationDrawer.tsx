'use client'

import React, { useState, useEffect } from 'react'
import { Bell, X, Heart, MessageSquare, UserPlus, Hash, Shield, Check } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

interface NotificationDrawerProps {
  currentUserId: string
  onClose: () => void
}

export default function NotificationDrawer({
  currentUserId,
  onClose,
}: NotificationDrawerProps): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadNotifications() {
      setLoading(true)
      const { data } = await supabase
        .from('notifications')
        .select('*, actor:profiles!notifications_actor_id_fkey(id, username, display_name, avatar_url)')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false })

      setNotifications(data ?? [])
      setLoading(false)

      // Mark all as read
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', currentUserId)
    }

    loadNotifications()
  }, [supabase, currentUserId])

  const getIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart size={16} className="text-red-500 fill-red-500" />
      case 'comment':
        return <MessageSquare size={16} className="text-blue-500" />
      case 'follow':
        return <UserPlus size={16} className="text-emerald-500" />
      case 'whisper':
        return <span className="text-sm">🤫</span>
      case 'message':
        return <MessageSquare size={16} className="text-purple-500" />
      case 'community_activity':
        return <Hash size={16} className="text-amber-500" />
      default:
        return <Shield size={16} className="text-brand-600" />
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white shadow-2xl border-l border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-brand-600" />
          <h2 className="text-sm font-bold text-gray-900">Notifications</h2>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 p-3 overflow-y-auto space-y-2 bg-gray-50">
        {loading ? (
          <p className="text-xs text-gray-400 text-center py-6">Loading notifications…</p>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <Bell size={32} className="mx-auto text-gray-300" />
            <p className="text-xs text-gray-500">No notifications yet.</p>
          </div>
        ) : (
          notifications.map((item) => (
            <div
              key={item.id}
              className={`p-3 rounded-xl border text-xs flex gap-3 transition-colors ${
                !item.is_read ? 'bg-brand-50/50 border-brand-200' : 'bg-white border-gray-200'
              }`}
            >
              <div className="mt-0.5 flex-shrink-0">{getIcon(item.type)}</div>
              <div className="space-y-0.5 flex-1 min-w-0">
                <h4 className="font-bold text-gray-900 leading-snug">{item.title}</h4>
                <p className="text-gray-600 leading-normal">{item.body}</p>
                <span className="text-[10px] text-gray-400 block pt-1">
                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
