import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Home, Compass, Plus, MessageSquare, User } from 'lucide-react-native'
import { BlurView } from 'expo-blur'

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()

  // Completely hide bottom tab navigation when inside full-screen Create Composer
  const activeRouteName = state.routes[state.index]?.name
  if (activeRouteName === 'create') {
    return null
  }

  // Ordered tab routes: Home, Explore, Chat, Profile (Create + is rendered in center)
  const mainTabKeys = ['index', 'explore', 'inbox', 'profile']

  const getTabIcon = (routeName: string, isFocused: boolean) => {
    const iconColor = isFocused ? '#3b82f6' : 'rgba(255, 255, 255, 0.65)'
    const iconSize = 20

    switch (routeName) {
      case 'index':
        return <Home color={iconColor} size={iconSize} strokeWidth={isFocused ? 2.3 : 1.8} />
      case 'explore':
        return <Compass color={iconColor} size={iconSize} strokeWidth={isFocused ? 2.3 : 1.8} />
      case 'inbox':
        return <MessageSquare color={iconColor} size={iconSize} strokeWidth={isFocused ? 2.3 : 1.8} />
      case 'profile':
        return <User color={iconColor} size={iconSize} strokeWidth={isFocused ? 2.3 : 1.8} />
      default:
        return <Home color={iconColor} size={iconSize} strokeWidth={1.8} />
    }
  }

  const getTabLabel = (routeName: string) => {
    switch (routeName) {
      case 'index':
        return 'Home'
      case 'explore':
        return 'Explore'
      case 'inbox':
        return 'Chat'
      case 'profile':
        return 'Profile'
      default:
        return routeName
    }
  }

  // Find target routes in order
  const getRouteByName = (name: string) => state.routes.find((r) => r.name === name)

  const leftRoutes = ['index', 'explore'].map(getRouteByName).filter(Boolean) as typeof state.routes
  const rightRoutes = ['inbox', 'profile'].map(getRouteByName).filter(Boolean) as typeof state.routes

  const renderTabItem = (route: (typeof state.routes)[0]) => {
    const isFocused = state.routes[state.index].key === route.key

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      })

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name)
      }
    }

    return (
      <TouchableOpacity
        key={route.key}
        onPress={onPress}
        activeOpacity={0.7}
        style={[styles.tabItem, isFocused && styles.activePill]}
      >
        <View style={styles.iconWrapper}>
          {getTabIcon(route.name, isFocused)}
          {route.name === 'inbox' && <View style={styles.badge} />}
        </View>
        <Text style={[styles.tabLabel, isFocused && styles.activeLabel]}>
          {getTabLabel(route.name)}
        </Text>
      </TouchableOpacity>
    )
  }

  const handleCreatePress = () => {
    const createRoute = state.routes.find((r) => r.name === 'create')
    if (createRoute) {
      navigation.navigate(createRoute.name)
    } else {
      navigation.navigate('create')
    }
  }

  return (
    <View style={[styles.outerContainer, { paddingBottom: Math.max(insets.bottom + 6, 16) }]}>
      {/* Floating Glassmorphism Container */}
      <View style={styles.floatingBarWrapper}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 75 : 95}
          tint="dark"
          style={styles.blurContainer}
        >
          <View style={styles.tabsRow}>
            {/* Left Tabs: Home | Explore */}
            <View style={styles.tabGroup}>{leftRoutes.map(renderTabItem)}</View>

            {/* Central Prominent (+) Create Button */}
            <TouchableOpacity
              onPress={handleCreatePress}
              activeOpacity={0.85}
              style={styles.createButton}
            >
              <Plus color="#ffffff" size={24} strokeWidth={2.5} />
            </TouchableOpacity>

            {/* Right Tabs: Chat | Profile */}
            <View style={styles.tabGroup}>{rightRoutes.map(renderTabItem)}</View>
          </View>
        </BlurView>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  floatingBarWrapper: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  blurContainer: {
    backgroundColor: Platform.OS === 'android' ? 'rgba(15, 23, 42, 0.94)' : 'rgba(15, 23, 42, 0.72)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    height: 68,
    justifyContent: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tabItem: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    minWidth: 56,
  },
  activePill: {
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  iconWrapper: {
    position: 'relative',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.65)',
    marginTop: 2,
  },
  activeLabel: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: -1,
    right: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  createButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
})

