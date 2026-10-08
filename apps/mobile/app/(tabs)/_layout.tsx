import React from 'react'
import { Tabs } from 'expo-router'
import { FloatingTabBar } from '../../components/FloatingTabBar'

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
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
  )
}
