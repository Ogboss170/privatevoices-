import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
  Animated as RNAnimated,
} from 'react-native'
import { Tabs, useRouter } from 'expo-router'
import {
  Bell,
  Plus,
  FileText,
  Ghost,
  BookOpen,
  Users,
  X,
} from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import { FloatingTabBar } from '../../components/FloatingTabBar'
import { supabase } from '../../lib/supabase'

// ─── Brand ───────────────────────────────────────────────────────────────────
const ACCENT = '#3b82f6'

// ─── Creation menu options ────────────────────────────────────────────────────
const CREATE_OPTIONS = [
  {
    id: 'post',
    label: 'New Post',
    sublabel: 'Share a voice with your feed',
    Icon: FileText,
    color: '#3b82f6',
    route: '/create',
  },
  {
    id: 'whisper',
    label: 'Anonymous Whisper',
    sublabel: 'Send an anonymous message',
    Icon: Ghost,
    color: '#8b5cf6',
    route: '/whispers/new',
  },
  {
    id: 'story',
    label: 'Story',
    sublabel: '24-hour disappearing post',
    Icon: BookOpen,
    color: '#ec4899',
    route: '/create?type=story',
  },
  {
    id: 'community',
    label: 'Community Post',
    sublabel: 'Post in a community',
    Icon: Users,
    color: '#10b981',
    route: '/create?type=community',
  },
] as const

// ─── Notification bell with badge ────────────────────────────────────────────
function NotificationBell({
  count,
  onPress,
}: {
  count: number
  onPress: () => void
}) {
  const scaleAnim = useRef(new RNAnimated.Value(1)).current
  const prevCount  = useRef(count)

  useEffect(() => {
    if (count > prevCount.current) {
      // Pulse animation when new notification arrives
      RNAnimated.sequence([
        RNAnimated.timing(scaleAnim, { toValue: 1.35, duration: 140, useNativeDriver: true }),
        RNAnimated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
      ]).start()
    }
    prevCount.current = count
  }, [count])

  return (
    <TouchableOpacity
      style={styles.headerRightBtn}
      onPress={onPress}
      activeOpacity={0.7}
      accessible
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `${count} unread notifications` : 'Notifications'}
    >
      <Bell color="#111827" size={22} strokeWidth={2} />
      {count > 0 && (
        <RNAnimated.View style={[styles.badge, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </RNAnimated.View>
      )}
    </TouchableOpacity>
  )
}

// ─── Create action sheet modal ────────────────────────────────────────────────
function CreateModal({
  visible,
  onClose,
}: {
  visible: boolean
  onClose: () => void
}) {
  const router    = useRouter()
  const insets    = useSafeAreaInsets()
  const slideAnim = useRef(new RNAnimated.Value(300)).current

  useEffect(() => {
    if (visible) {
      RNAnimated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 180,
      }).start()
    } else {
      RNAnimated.timing(slideAnim, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }).start()
    }
  }, [visible])

  const handleOption = (route: string) => {
    onClose()
    // Small delay so the modal closes before navigating
    setTimeout(() => {
      router.push(route as any)
    }, 80)
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <RNAnimated.View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom + 8, 16), transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Handle */}
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Create</Text>
            <TouchableOpacity onPress={onClose} style={styles.sheetClose}>
              <X size={18} color="#6b7280" strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Options */}
          {CREATE_OPTIONS.map((option) => {
            const IconComp = option.Icon
            return (
              <TouchableOpacity
                key={option.id}
                style={styles.sheetOption}
                onPress={() => handleOption(option.route)}
                activeOpacity={0.7}
              >
                <View style={[styles.sheetOptionIcon, { backgroundColor: option.color + '18' }]}>
                  <IconComp size={22} color={option.color} strokeWidth={2} />
                </View>
                <View style={styles.sheetOptionText}>
                  <Text style={styles.sheetOptionLabel}>{option.label}</Text>
                  <Text style={styles.sheetOptionSub}>{option.sublabel}</Text>
                </View>
              </TouchableOpacity>
            )
          })}
        </RNAnimated.View>
      </Pressable>
    </Modal>
  )
}

// ─── Tab layout ───────────────────────────────────────────────────────────────
export default function TabLayout() {
  const router             = useRouter()
  const insets             = useSafeAreaInsets()
  const [unreadCount, setUnreadCount]       = useState(0)
  const [currentUserId, setCurrentUserId]   = useState<string | null>(null)
  const [createVisible, setCreateVisible]   = useState(false)
  const createBtnScale = useRef(new RNAnimated.Value(1)).current

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
  }, [])

  // ── Unread count ─────────────────────────────────────────────────────────────
  const fetchUnreadCount = useCallback(async () => {
    if (!currentUserId) return
    try {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUserId)
        .eq('is_read', false)
      setUnreadCount(count ?? 0)
    } catch (err) {
      console.error('Error fetching unread notif count:', err)
    }
  }, [currentUserId])

  useEffect(() => {
    fetchUnreadCount()
    if (!currentUserId) return

    const channel = supabase
      .channel('tablayout:notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, fetchUnreadCount)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [currentUserId, fetchUnreadCount])

  // ── Create button press animation ───────────────────────────────────────────
  const handleCreatePress = () => {
    RNAnimated.sequence([
      RNAnimated.timing(createBtnScale, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      RNAnimated.spring(createBtnScale, { toValue: 1, useNativeDriver: true }),
    ]).start(() => setCreateVisible(true))
  }

  // ── Custom header — true screen-centre title ─────────────────────────────
  const renderHeader = () => (
    <View style={[styles.customHeader, { paddingTop: insets.top }]}>
      {/* Absolutely centered title — ignores left/right button widths */}
      <View style={styles.headerTitleAbs} pointerEvents="none">
        <Text style={styles.headerTitleText}>Private Voices</Text>
      </View>

      {/* Left: + */}
      <RNAnimated.View style={{ transform: [{ scale: createBtnScale }] }}>
        <TouchableOpacity
          style={styles.headerSideBtn}
          onPress={handleCreatePress}
          activeOpacity={0.7}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Create"
        >
          <Plus size={22} color={ACCENT} strokeWidth={2.2} />
        </TouchableOpacity>
      </RNAnimated.View>

      {/* Right: Bell */}
      <View style={styles.headerRightSlot}>
        <NotificationBell
          count={unreadCount}
          onPress={() => router.push('/notifications' as any)}
        />
      </View>
    </View>
  )

  const headerOptions = {
    header: renderHeader,
  }

  return (
    <>
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={headerOptions}
      >
        {/* 1 — Home */}
        <Tabs.Screen
          name="index"
          options={{ title: 'Home' }}
        />
        {/* 2 — Explore */}
        <Tabs.Screen
          name="explore"
          options={{ title: 'Explore' }}
        />
        {/* 3 — Community */}
        <Tabs.Screen
          name="communities"
          options={{ title: 'Community' }}
        />
        {/* 4 — Chat */}
        <Tabs.Screen
          name="inbox"
          options={{ title: 'Chat' }}
        />
        {/* 5 — Profile */}
        <Tabs.Screen
          name="profile"
          options={{ title: 'Profile' }}
        />
        {/* Create is NOT a visible tab — kept here so Expo Router resolves it */}
        <Tabs.Screen
          name="create"
          options={{ href: null, headerShown: false }}
        />
      </Tabs>

      {/* Creation action sheet */}
      <CreateModal visible={createVisible} onClose={() => setCreateVisible(false)} />
    </>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Custom header layout ───────────────────────────────────────────────────
  customHeader: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,            // standard iOS/Android nav bar height
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  // Absolute overlay — always centred on the full screen width
  headerTitleAbs: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  headerTitleText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: 0.2,
  },
  // Left + button
  headerSideBtn: {
    padding: 8,
  },
  // Right Bell — pushed to the far right with marginLeft: 'auto'
  headerRightSlot: {
    marginLeft: 'auto' as any,
  },
  // ── Right: Bell ────────────────────────────────────────────────────────────
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
  // ── Create modal ───────────────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  sheetClose: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  sheetOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOptionText: {
    flex: 1,
  },
  sheetOptionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  sheetOptionSub: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 1,
  },
})
