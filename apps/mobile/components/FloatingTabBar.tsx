import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Home, Search, Plus, MessageSquare, User } from 'lucide-react-native'
import { BlurView } from 'expo-blur'

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()

  // Completely hide bottom tab navigation when inside full-screen Create Composer
  if (state.routes[state.index]?.name === 'create') {
    return null
  }

  const getTabIcon = (routeName: string, isFocused: boolean) => {
    const iconColor = isFocused ? '#3b82f6' : '#9ca3af'
    const iconSize = 22

    switch (routeName) {
      case 'index':
        return <Home color={iconColor} size={iconSize} />
      case 'explore':
        return <Search color={iconColor} size={iconSize} />
      case 'inbox':
        return <MessageSquare color={iconColor} size={iconSize} />
      case 'profile':
        return <User color={iconColor} size={iconSize} />
      default:
        return <Home color={iconColor} size={iconSize} />
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

  const routes = state.routes.filter((r: { name: string }) => r.name !== 'create' && r.name !== 'communities')
  const createRoute = state.routes.find((r: { name: string }) => r.name === 'create')

  const leftRoutes = routes.slice(0, 2)
  const rightRoutes = routes.slice(2, 4)

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
        activeOpacity={0.8}
        style={[
          styles.tabItem,
          isFocused && styles.activePill,
        ]}
      >
        <View style={styles.iconWrapper}>
          {getTabIcon(route.name, isFocused)}
          {route.name === 'inbox' && (
            <View style={styles.badge} />
          )}
        </View>
        <Text style={[styles.tabLabel, isFocused && styles.activeLabel]}>
          {getTabLabel(route.name)}
        </Text>
      </TouchableOpacity>
    )
  }

  const handleCreatePress = () => {
    if (createRoute) {
      navigation.navigate(createRoute.name)
    }
  }

  return (
    <View style={[styles.outerContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      {/* Floating Glassmorphism Container */}
      <View style={styles.floatingBarWrapper}>
        <BlurView intensity={Platform.OS === 'ios' ? 80 : 100} tint="dark" style={styles.blurContainer}>
          <View style={styles.tabsRow}>
            {/* Left Tabs: Home, Explore */}
            <View style={styles.tabGroup}>
              {leftRoutes.map(renderTabItem)}
            </View>

            {/* Elevated Circular Center (+) Button */}
            <TouchableOpacity
              onPress={handleCreatePress}
              activeOpacity={0.85}
              style={styles.createButton}
            >
              <Plus color="#ffffff" size={26} strokeWidth={2.5} />
            </TouchableOpacity>

            {/* Right Tabs: Chat, Profile */}
            <View style={styles.tabGroup}>
              {rightRoutes.map(renderTabItem)}
            </View>
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
    width: '92%',
    maxWidth: 420,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  blurContainer: {
    backgroundColor: Platform.OS === 'android' ? 'rgba(15, 23, 42, 0.92)' : 'rgba(15, 23, 42, 0.75)',
    paddingVertical: 8,
    paddingHorizontal: 10,
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
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    minWidth: 58,
  },
  activePill: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  iconWrapper: {
    position: 'relative',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#9ca3af',
    marginTop: 2,
  },
  activeLabel: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#ef4444',
  },
  createButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
    transform: [{ translateY: -2 }],
  },
})
