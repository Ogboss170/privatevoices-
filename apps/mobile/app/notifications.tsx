import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
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
} from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'
import type { AppNotification, NotificationType } from '@private-voices/shared'

export default function NotificationsScreen() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const fetchNotifications = useCallback(async () => {
    const { data: userRes } = await supabase.auth.getUser()
    if (!userRes.user) return

    const uId = userRes.user.id
    setCurrentUserId(uId)

    const { data, error } = await supabase
      .from('notifications')
      .select('*, actor:profiles!notifications_actor_id_fkey(id, username, display_name, avatar_url)')
      .eq('recipient_id', uId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error && data) {
      const formatted: AppNotification[] = data.map((n: any) => ({
        id: n.id,
        recipientId: n.recipient_id,
        actorId: n.type === 'whisper' ? null : n.actor_id,
        actor: n.type === 'whisper' || !n.actor ? null : {
          id: n.actor.id,
          username: n.actor.username,
          displayName: n.actor.display_name,
          avatarUrl: n.actor.avatar_url,
        },
        type: n.type,
        title: n.title,
        message: n.message,
        entityType: n.entity_type,
        entityId: n.entity_id,
        isRead: n.is_read,
        groupCount: n.group_count || 1,
        createdAt: n.created_at,
      }))
      setNotifications(formatted)
    }
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    fetchNotifications()

    // Realtime channel listener
    const channel = supabase
      .channel('mobile:notifications')
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
  }, [fetchNotifications, currentUserId])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchNotifications()
  }

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

    switch (notif.entityType) {
      case 'post':
      case 'comment':
        router.push('/(tabs)')
        break
      case 'profile':
        router.push('/(tabs)/profile')
        break
      case 'whisper':
      case 'chat':
        router.push('/(tabs)/inbox')
        break
      case 'community':
        router.push('/(tabs)/communities')
        break
      case 'security':
        router.push('/settings')
        break
      default:
        router.push('/(tabs)')
        break
    }
  }

  async function handleDeleteNotification(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    await supabase.from('notifications').delete().eq('id', id)
  }

  function getNotificationIcon(type: NotificationType) {
    switch (type) {
      case 'follow':
      case 'follow_accept':
        return <UserPlus size={16} color="#3b82f6" />
      case 'post_like':
        return <Heart size={16} color="#f43f5e" fill="#f43f5e" />
      case 'post_comment':
      case 'comment_reply':
        return <MessageCircle size={16} color="#10b981" />
      case 'whisper':
      case 'whisper_reply':
        return <MessageSquareQuote size={16} color="#a855f7" />
      case 'mention':
      case 'story_mention':
        return <AtSign size={16} color="#f59e0b" />
      case 'community':
        return <Users size={16} color="#6366f1" />
      case 'system':
        return <ShieldAlert size={16} color="#d97706" />
      default:
        return <Bell size={16} color={colors.brand} />
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
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={colors.gray800} />
        </TouchableOpacity>

        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </View>

        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.markReadBtn}>
            <CheckCheck size={18} color={colors.brand} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      {/* ── List Content ── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : notifications.length === 0 ? (
        /* Empty State */
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Sparkles size={32} color={colors.brand} />
          </View>
          <Text style={styles.emptyTitle}>You're all caught up.</Text>
          <Text style={styles.emptyBody}>
            New activity, interactions, and updates will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.brand} />
          }
          renderItem={({ item }) => {
            const isAnonymous = item.type === 'whisper' || !item.actor
            return (
              <TouchableOpacity
                style={[styles.notifCard, !item.isRead && styles.unreadCard]}
                onPress={() => handleNotificationClick(item)}
                activeOpacity={0.7}
              >
                <View style={styles.cardLeft}>
                  {isAnonymous ? (
                    <View style={styles.anonymousAvatar}>
                      <Text style={{ fontSize: 18 }}>🤫</Text>
                    </View>
                  ) : (
                    <View style={styles.userAvatar}>
                      <Text style={styles.avatarLetter}>
                        {item.actor?.displayName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.typeIconBadge}>{getNotificationIcon(item.type)}</View>
                </View>

                <View style={styles.cardCenter}>
                  <Text style={[styles.messageText, !item.isRead && styles.unreadMessageText]}>
                    {item.message}
                  </Text>
                  <Text style={styles.timeText}>{formatRelativeTime(item.createdAt)}</Text>
                </View>

                <View style={styles.cardRight}>
                  {!item.isRead && <View style={styles.unreadDot} />}
                  <TouchableOpacity onPress={() => handleDeleteNotification(item.id)}>
                    <Trash2 size={16} color={colors.gray400} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  backBtn: { padding: 4 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.gray900 },
  unreadBadge: {
    backgroundColor: colors.brand,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  unreadBadgeText: { fontSize: 11, fontWeight: 'bold', color: '#ffffff' },
  markReadBtn: { padding: 4 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.gray900, marginBottom: 6 },
  emptyBody: { fontSize: 13, color: colors.gray500, textAlign: 'center' },
  listContent: { padding: 16, paddingBottom: 100, gap: 8 },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.gray200,
    gap: 12,
  },
  unreadCard: {
    backgroundColor: '#eef2ff',
    borderColor: '#c7d2fe',
  },
  cardLeft: { position: 'relative' },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontSize: 16, fontWeight: '700', color: colors.brand },
  anonymousAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  cardCenter: { flex: 1, gap: 2 },
  messageText: { fontSize: 13, color: colors.gray700 },
  unreadMessageText: { color: colors.gray900, fontWeight: '600' },
  timeText: { fontSize: 11, color: colors.gray400 },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
})
