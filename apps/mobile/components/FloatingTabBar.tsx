import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Home, Compass, Users, MessageSquare, User } from 'lucide-react-native'
import { BlurView } from 'expo-blur'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated'

import { useTheme } from '../context/ThemeContext'
import { colors } from '../constants/colors'

// ─── Brand colours ──────────────────────────────────────────────────────────
const ACCENT        = '#7c3aed'
const ACCENT_BG     = 'rgba(124, 58, 237, 0.12)'
const ACCENT_BORDER = 'rgba(124, 58, 237, 0.3)'

// ─── Animation config ────────────────────────────────────────────────────────
const ANIM_DURATION = 200
const easing        = Easing.out(Easing.cubic)

// ─── Tab meta ────────────────────────────────────────────────────────────────
const TAB_ORDER = ['index', 'explore', 'communities', 'inbox', 'profile'] as const
type TabName = (typeof TAB_ORDER)[number]

function getLabel(name: string, t?: any): string {
  if (t) {
    switch (name) {
      case 'index':       return t.home || 'Home'
      case 'explore':     return t.explore || 'Explore'
      case 'communities': return t.community || 'Community'
      case 'inbox':       return t.inbox || 'Chat'
      case 'profile':     return t.profile || 'Profile'
      default:            return name
    }
  }
  switch (name) {
    case 'index':       return 'Home'
    case 'explore':     return 'Explore'
    case 'communities': return 'Community'
    case 'inbox':       return 'Chat'
    case 'profile':     return 'Profile'
    default:            return name
  }
}

function TabIcon({
  name,
  color,
  size,
  strokeWidth,
}: {
  name: string
  color: string
  size: number
  strokeWidth: number
}) {
  switch (name) {
    case 'index':       return <Home          color={color} size={size} strokeWidth={strokeWidth} />
    case 'explore':     return <Compass       color={color} size={size} strokeWidth={strokeWidth} />
    case 'communities': return <Users         color={color} size={size} strokeWidth={strokeWidth} />
    case 'inbox':       return <MessageSquare color={color} size={size} strokeWidth={strokeWidth} />
    case 'profile':     return <User          color={color} size={size} strokeWidth={strokeWidth} />
    default:            return <Home          color={color} size={size} strokeWidth={strokeWidth} />
  }
}

// ─── Single animated tab item ─────────────────────────────────────────────────
function AnimatedTabItem({
  routeName,
  isFocused,
  hasBadge,
  onPress,
  isDark,
  themeColors,
  t,
}: {
  routeName: string
  isFocused: boolean
  hasBadge: boolean
  onPress: () => void
  isDark: boolean
  themeColors: any
  t: any
}) {
  const progress = useSharedValue(isFocused ? 1 : 0)

  useEffect(() => {
    progress.value = withTiming(isFocused ? 1 : 0, { duration: ANIM_DURATION, easing })
  }, [isFocused])

  const pillStyle = useAnimatedStyle(() => ({
    backgroundColor: isFocused ? ACCENT_BG     : 'transparent',
    borderColor:     isFocused ? ACCENT_BORDER : 'transparent',
    borderWidth:     isFocused ? 1             : 0,
  }))

  const iconScaleStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withTiming(isFocused ? 1.08 : 1, { duration: ANIM_DURATION, easing }) },
    ],
  }))

  const inactiveColor = isDark ? 'rgba(255, 255, 255, 0.55)' : '#737373'

  const labelStyle = useAnimatedStyle(() => ({
    color:      isFocused ? ACCENT   : inactiveColor,
    fontWeight: isFocused ? '600'    : '500',
    opacity:    isFocused ? 1        : 0.85,
  }))

  const iconColor   = isFocused ? ACCENT : inactiveColor
  const strokeWidth = isFocused ? 2.3    : 1.8

  const labelText = getLabel(routeName, t)

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.tabOuter}
      accessible
      accessibilityRole="button"
      accessibilityLabel={labelText}
      accessibilityState={{ selected: isFocused }}
    >
      <Animated.View style={[styles.tabInner, pillStyle]}>
        <Animated.View style={[styles.iconWrap, iconScaleStyle]}>
          <TabIcon name={routeName} color={iconColor} size={20} strokeWidth={strokeWidth} />
          {hasBadge && <View style={[styles.dot, { borderColor: isDark ? '#121212' : '#ffffff' }]} />}
        </Animated.View>
        <Animated.Text style={[styles.label, labelStyle]}>
          {labelText}
        </Animated.Text>
      </Animated.View>
    </TouchableOpacity>
  )
}

// ─── FloatingTabBar ───────────────────────────────────────────────────────────
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const { colors: themeColors, isDark, t } = useTheme()

  // Never render during the create tab (full-screen modal behaviour)
  const activeRouteName = state.routes[state.index]?.name
  if (activeRouteName === 'create') return null

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

  // Render tabs in the canonical order, skipping any route not in TAB_ORDER
  const orderedRoutes = TAB_ORDER
    .map((name) => state.routes.find((r) => r.name === name))
    .filter(Boolean) as typeof state.routes

  return (
    <View
      style={[
        styles.outerContainer,
        { paddingBottom: Math.max(insets.bottom + 6, 16) },
      ]}
      pointerEvents="box-none"
    >
      {/* Shadow lives outside overflow:hidden so it renders on iOS */}
      <View
        style={[
          styles.shadow,
          {
            shadowColor: isDark ? '#000000' : 'rgba(0, 0, 0, 0.12)',
            shadowOpacity: isDark ? 0.45 : 0.16,
          },
        ]}
      >
        <View
          style={[
            styles.floatingBarWrapper,
            {
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
              backgroundColor: isDark ? '#121212' : '#ffffff',
            },
          ]}
        >
          <BlurView
            intensity={Platform.OS === 'ios' ? (isDark ? 70 : 80) : 95}
            tint={isDark ? 'dark' : 'light'}
            style={[
              styles.blurContainer,
              {
                backgroundColor: isDark
                  ? Platform.OS === 'android' ? 'rgba(18, 18, 18, 0.96)' : 'rgba(18, 18, 18, 0.75)'
                  : Platform.OS === 'android' ? 'rgba(255, 255, 255, 0.96)' : 'rgba(255, 255, 255, 0.85)',
              },
            ]}
          >
            <View style={styles.tabsRow}>
              {orderedRoutes.map((route) => {
                const isFocused = state.routes[state.index].key === route.key
                const hasBadge  = route.name === 'inbox'
                return (
                  <AnimatedTabItem
                    key={route.key}
                    routeName={route.name}
                    isFocused={isFocused}
                    hasBadge={hasBadge}
                    onPress={() => handlePress(route)}
                    isDark={isDark}
                    themeColors={themeColors}
                    t={t}
                  />
                )
              })}
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
  shadow: {
    width: '92%',
    maxWidth: 440,
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
    height: 68,
    justifyContent: 'center',
    paddingHorizontal: 4,
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
  // Outer touchable — generous tap target
  tabOuter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Animated pill
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 18,
  },
  iconWrap: {
    position: 'relative',
  },
  label: {
    fontSize: 9.5,
    marginTop: 3,
    letterSpacing: 0.1,
  },
  dot: {
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
})
