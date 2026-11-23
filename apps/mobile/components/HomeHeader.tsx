import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated as RNAnimated,
  Modal,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Plus, Bell, Users, Sparkles, Menu } from 'lucide-react-native'
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
  const { colors: themeColors, isDark } = useTheme()

  const [unreadCount, setUnreadCount] = useState(0)
  const [createVisible, setCreateVisible] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const createBtnScale = useRef(new RNAnimated.Value(1)).current
  const bellScale = useRef(new RNAnimated.Value(1)).current
  const menuAnim = useRef(new RNAnimated.Value(0)).current
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

  const openMenu = () => {
    setMenuOpen(true)
    RNAnimated.spring(menuAnim, {
      toValue: 1,
      tension: 65,
      friction: 9,
      useNativeDriver: true,
    }).start()
  }

  const closeMenu = (callback?: () => void) => {
    RNAnimated.timing(menuAnim, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(() => {
      setMenuOpen(false)
      if (callback) callback()
    })
  }

  const handleSelectOption = (route: string) => {
    closeMenu(() => {
      router.push(route as any)
    })
  }

  const menuScale = menuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1],
  })

  const menuOpacity = menuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  })

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

          {/* Right: Unified Menu Button */}
          <View style={styles.headerRightSlot}>
            <TouchableOpacity
              style={styles.menuTriggerBtn}
              onPress={openMenu}
              activeOpacity={0.7}
              accessible
              accessibilityRole="button"
              accessibilityLabel={unreadCount > 0 ? `Menu, ${unreadCount} unread notifications` : 'Menu'}
            >
              <Menu color={themeColors.textPrimary} size={22} strokeWidth={2.2} />
              {unreadCount > 0 && (
                <RNAnimated.View style={[styles.badge, { transform: [{ scale: bellScale }] }]}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </RNAnimated.View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Unified Header Menu Modal Dropdown */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="none"
        onRequestClose={() => closeMenu()}
      >
        <TouchableWithoutFeedback onPress={() => closeMenu()}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <RNAnimated.View
                style={[
                  styles.dropdownMenu,
                  {
                    top: insets.top + 48,
                    backgroundColor: themeColors.surface,
                    borderColor: themeColors.surfaceBorder,
                    opacity: menuOpacity,
                    transform: [{ scale: menuScale }],
                    ...Platform.select({
                      ios: {
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: isDark ? 0.45 : 0.15,
                        shadowRadius: 18,
                      },
                      android: {
                        elevation: 10,
                      },
                    }),
                  },
                ]}
              >
                {/* 1. Notifications (bell icon) */}
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: themeColors.surfaceBorder }]}
                  onPress={() => handleSelectOption('/notifications')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(124, 58, 237, 0.2)' : '#ede9fe' }]}>
                    <Bell size={18} color={ACCENT} strokeWidth={2.2} />
                  </View>
                  <Text style={[styles.menuItemText, { color: themeColors.textPrimary }]}>Notifications</Text>
                  {unreadCount > 0 && (
                    <View style={styles.itemBadge}>
                      <Text style={styles.itemBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* 2. Spaces (users icon) */}
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: themeColors.surfaceBorder }]}
                  onPress={() => handleSelectOption('/spaces')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(168, 85, 247, 0.2)' : '#f3e8ff' }]}>
                    <Users size={18} color="#9333ea" strokeWidth={2.2} />
                  </View>
                  <Text style={[styles.menuItemText, { color: themeColors.textPrimary }]}>Spaces</Text>
                </TouchableOpacity>

                {/* 3. Fytro (sparkles icon) */}
                <TouchableOpacity
                  style={[styles.menuItem, styles.menuItemLast]}
                  onPress={() => handleSelectOption('/fytro')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.menuIconCircle, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff' }]}>
                    <Sparkles size={18} color="#4f46e5" strokeWidth={2.2} />
                  </View>
                  <Text style={[styles.menuItemText, { color: themeColors.textPrimary }]}>Fytro</Text>
                  <View style={styles.fytroTag}>
                    <Text style={styles.fytroTagText}>AI</Text>
                  </View>
                </TouchableOpacity>
              </RNAnimated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

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
  menuTriggerBtn: {
    padding: 8,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  dropdownMenu: {
    position: 'absolute',
    right: 12,
    width: 220,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  itemBadge: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  itemBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  fytroTag: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  fytroTagText: {
    color: '#4338ca',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
})
