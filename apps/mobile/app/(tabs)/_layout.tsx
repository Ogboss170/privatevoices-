import React, { useState, useEffect, useCallback } from 'react'
import { View, TouchableOpacity, StyleSheet } from 'react-native'
import { Tabs, useRouter } from 'expo-router'
import { Bell } from 'lucide-react-native'
import { FloatingTabBar } from '../../components/FloatingTabBar'
import { supabase } from '../../lib/supabase'

export default function TabLayout() {
  const router = useRouter()
  const [unreadNotifCount, setUnreadNotifCount] = useState(0)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentUserId(data.user.id)
      }
    })
  }, [])

  const fetchUnreadCount = useCallback(async () => {
    if (!currentUserId) return
    try {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUserId)
        .eq('is_read', false)

      setUnreadNotifCount(count ?? 0)
    } catch (err) {
      console.error('Error fetching unread notifs count:', err)
    }
  }, [currentUserId])

  useEffect(() => {
    fetchUnreadCount()

    if (!currentUserId) return

    const channel = supabase
      .channel('tablayout:notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => {
          fetchUnreadCount()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, fetchUnreadCount])

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', fontSize: 20, color: '#111827' },
        headerRight: () => (
          <TouchableOpacity
            style={styles.notificationHeaderBtn}
            onPress={() => router.push('/notifications' as any)}
            activeOpacity={0.7}
          >
            <Bell color="#111827" size={22} />
            {unreadNotifCount > 0 && <View style={styles.headerBadge} />}
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: 'Private Voices',
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Chat',
        }}
      />
      <Tabs.Screen
        name="communities"
        options={{
          title: 'Communities',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  notificationHeaderBtn: {
    marginRight: 16,
    position: 'relative',
    padding: 4,
  },
  headerBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
})
