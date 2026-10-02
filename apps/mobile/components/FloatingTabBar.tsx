import React, { useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Home, Compass, Plus, MessageSquare, User } from 'lucide-react-native'
import { BlurView } from 'expo-blur'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolateColor,
} from 'react-native-reanimated'

// ─── Brand colours ──────────────────────────────────────────────────────────
const ACCENT = '#3b82f6'
const ACCENT_BG = 'rgba(59, 130, 246, 0.18)'
const ACCENT_BORDER = 'rgba(59, 130, 246, 0.4)'
const INACTIVE_COLOR = 'rgba(255, 255, 255, 0.65)'

// ─── Animation config ────────────────────────────────────────────────────────
const ANIM_DURATION = 200
const easing = Easing.out(Easing.cubic)

// ─── Ordered visible tabs (create is always the centre + button) ─────────────
const LEFT_TABS = ['index', 'explore']
const RIGHT_TABS = ['inbox', 'profile']

function getLabel(routeName: string) {
  switch (routeName) {
    case 'index': return 'Home'
    case 'explore': return 'Explore'
    case 'inbox': return 'Chat'
    case 'profile': return 'Profile'
    default: return routeName
  }
}

// ─── Animated tab item ───────────────────────────────────────────────────────
function AnimatedTabItem({
  routeName,
  isFocused,
  hasBadge,
  onPress,
}: {
  routeName: string
  isFocused: boolean
  hasBadge?: boolean
  onPress: () => void
}) {
  const progress = useSharedValue(isFocused ? 1 : 0)

  useEffect(() => {
    progress.value = withTiming(isFocused ? 1 : 0, { duration: ANIM_DURATION, easing })
  }, [isFocused])

  // Animated pill background & border opacity
  const pillStyle = useAnimatedStyle(() => ({
    backgroundColor: isFocused ? ACCENT_BG : 'transparent',
    borderColor: isFocused ? ACCENT_BORDER : 'transparent',
    borderWidth: isFocused ? 1 : 0,
  }))

  // Icon scale pops slightly when focused
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(isFocused ? 1.08 : 1, { duration: ANIM_DURATION, easing }) }],
  }))

  // Label colour interpolation
  const labelStyle = useAnimatedStyle(() => ({
    color: isFocused ? ACCENT : INACTIVE_COLOR,
    fontWeight: isFocused ? '600' : '500',
  }))

  const iconColor = isFocused ? ACCENT : INACTIVE_COLOR
  const iconSize = 20
  const strokeWidth = isFocused ? 2.3 : 1.8

  const Icon = (() => {
    switch (routeName) {
      case 'index':   return <Home color={iconColor} size={iconSize} strokeWidth={strokeWidth} />
      case 'explore': return <Compass color={iconColor} size={iconSize} strokeWidth={strokeWidth} />
      case 'inbox':   return <MessageSquare color={iconColor} size={iconSize} strokeWidth={strokeWidth} />
      case 'profile': return <User color={iconColor} size={iconSize} strokeWidth={strokeWidth} />
      default:        return <Home color={iconColor} size={iconSize} strokeWidth={strokeWidth} />
    }
  })()

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.tabItemOuter}
      accessible
      accessibilityRole="button"
      accessibilityLabel={getLabel(routeName)}
      accessibilityState={{ selected: isFocused }}
    >
      <Animated.View style={[styles.tabItemInner, pillStyle]}>
        <Animated.View style={[styles.iconWrapper, iconStyle]}>
          {Icon}
          {hasBadge && <View style={styles.badge} />}
        </Animated.View>
        <Animated.Text style={[styles.tabLabel, labelStyle]}>
          {getLabel(routeName)}
        </Animated.Text>
      </Animated.View>
    </TouchableOpacity>
  )
}

// ─── Main FloatingTabBar ─────────────────────────────────────────────────────
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()

  // Hide entirely when the Create composer is active
  const activeRouteName = state.routes[state.index]?.name
  if (activeRouteName === 'create') return null

  const getRoute = (name: string) => state.routes.find((r) => r.name === name)

  const leftRoutes  = LEFT_TABS.map(getRoute).filter(Boolean) as typeof state.routes
  const rightRoutes = RIGHT_TABS.map(getRoute).filter(Boolean) as typeof state.routes

  const handlePress = (route: (typeof state.routes)[0]) => {
    const isFocused = state.routes[state.index].key === route.key
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    })
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name)
    }
  }

  const handleCreatePress = () => {
    const createRoute = state.routes.find((r) => r.name === 'create')
    navigation.navigate(createRoute ? createRoute.name : 'create')
  }

  return (
    <View
      style={[
        styles.outerContainer,
        { paddingBottom: Math.max(insets.bottom + 6, 16) },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.shadow}>
        <View style={styles.floatingBarWrapper}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 72 : 90}
            tint="dark"
            style={styles.blurContainer}
          >
            <View style={styles.tabsRow}>
              {/* ── Left: Home | Explore ─────────────────────────── */}
              <View style={styles.tabGroup}>
                {leftRoutes.map((route) => (
                  <AnimatedTabItem
                    key={route.key}
                    routeName={route.name}
                    isFocused={state.routes[state.index].key === route.key}
                    onPress={() => handlePress(route)}
                  />
                ))}
              </View>

              {/* ── Centre: + Create ─────────────────────────────── */}
              <TouchableOpacity
                onPress={handleCreatePress}
                activeOpacity={0.82}
                style={styles.createButton}
                accessible
                accessibilityRole="button"
                accessibilityLabel="Create Voice"
              >
                <Plus color="#ffffff" size={24} strokeWidth={2.5} />
              </TouchableOpacity>

              {/* ── Right: Chat | Profile ─────────────────────────── */}
              <View style={styles.tabGroup}>
                {rightRoutes.map((route) => (
                  <AnimatedTabItem
                    key={route.key}
                    routeName={route.name}
                    isFocused={state.routes[state.index].key === route.key}
                    hasBadge={route.name === 'inbox'}
                    onPress={() => handlePress(route)}
                  />
                ))}
              </View>
            </View>
          </BlurView>
        </View>
      </View>
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  // Shadow sits outside the overflow:hidden clip so it renders on iOS
  shadow: {
    width: '90%',
    maxWidth: 420,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.42,
    shadowRadius: 18,
    elevation: 16,
  },
  floatingBarWrapper: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  blurContainer: {
    height: 72,
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor:
      Platform.OS === 'android'
        ? 'rgba(10, 18, 36, 0.96)'
        : 'rgba(10, 18, 36, 0.70)',
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  // Outer touchable — gives a generous tap target
  tabItemOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 58,
  },
  // Inner animated pill
  tabItemInner: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 20,
  },
  iconWrapper: {
    position: 'relative',
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 3,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
    borderWidth: 1,
    borderColor: 'rgba(10, 18, 36, 0.9)',
  },
  createButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 8,
  },
})
