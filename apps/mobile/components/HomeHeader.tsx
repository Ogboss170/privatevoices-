import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated as RNAnimated,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Plus, Bell } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { useTheme } from '../context/ThemeContext'
import { CreateModal } from './CreateModal'

const ACCENT = '#7c3aed'

interface HomeHeaderProps {
  currentUserId?: string
}

export function HomeHeader({ currentUserId }: HomeHeaderProps) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { colors: themeColors } = useTheme()

  const [unreadCount, setUnreadCount] = useState(0)
  const [createVisible, setCreateVisible] = useState(false)
  const createBtnScale = useRef(new RNAnimated.Value(1)).current
  const bellScale = useRef(new RNAnimated.Value(1)).current
  const prevCount = useRef(0)

  // Fetch unread notifications
  const fetchUnreadCount = useCallback(async () => {
    if (!currentUserId) return
    try {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', currentUserId)
        .eq('is_read', false)
      setUnreadCount(count ?? 0)
    } catch (err) {
      console.error('Error fetching unread notif count in HomeHeader:', err)
    }
  }, [currentUserId])

  useEffect(() => {
    fetchUnreadCount()
    if (!currentUserId) return

    const channel = supabase
      .channel('homeheader:notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, fetchUnreadCount)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, fetchUnreadCount])

  // Badge animation on count change
  useEffect(() => {
    if (unreadCount > prevCount.current) {
      RNAnimated.sequence([
        RNAnimated.timing(bellScale, { toValue: 1.35, duration: 140, useNativeDriver: true }),
        RNAnimated.spring(bellScale, { toValue: 1, useNativeDriver: true }),
      ]).start()
    }
    prevCount.current = unreadCount
  }, [unreadCount, bellScale])

  const handleCreatePress = () => {
    RNAnimated.sequence([
      RNAnimated.timing(createBtnScale, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      RNAnimated.spring(createBtnScale, { toValue: 1, useNativeDriver: true }),
    ]).start(() => setCreateVisible(true))
  }

  return (
    <>
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top,
            backgroundColor: themeColors.surface,
            borderBottomColor: themeColors.surfaceBorder,
          },
        ]}
      >
        <View style={styles.headerBar}>
          {/* Centered title (absolute) */}
          <View style={styles.headerTitleAbs} pointerEvents="none">
            <Text style={[styles.headerTitleText, { color: themeColors.textPrimary }]}>
              PRIVATE VOICES
            </Text>
          </View>

          {/* Left: ＋ Create */}
          <RNAnimated.View style={{ transform: [{ scale: createBtnScale }] }}>
            <TouchableOpacity
              style={styles.headerSideBtn}
              onPress={handleCreatePress}
              activeOpacity={0.7}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Create"
            >
              <Plus size={22} color={ACCENT} strokeWidth={2.4} />
            </TouchableOpacity>
          </RNAnimated.View>

          {/* Right: 🔔 Notifications */}
          <View style={styles.headerRightSlot}>
            <TouchableOpacity
              style={styles.headerRightBtn}
              onPress={() => router.push('/notifications' as any)}
              activeOpacity={0.7}
              accessible
              accessibilityRole="button"
              accessibilityLabel={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
            >
              <Bell color={themeColors.textPrimary} size={22} strokeWidth={2} />
              {unreadCount > 0 && (
                <RNAnimated.View style={[styles.badge, { transform: [{ scale: bellScale }] }]}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </RNAnimated.View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Creation Modal sheet */}
      <CreateModal visible={createVisible} onClose={() => setCreateVisible(false)} />
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    width: '100%',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 8,
    position: 'relative',
  },
  headerTitleAbs: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  headerSideBtn: {
    padding: 8,
  },
  headerRightSlot: {
    marginLeft: 'auto',
  },
  headerRightBtn: {
    padding: 4,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
})
