import React from 'react'
import { View, TouchableOpacity, StyleSheet } from 'react-native'
import { Tabs } from 'expo-router'
import { Bell } from 'lucide-react-native'
import { FloatingTabBar } from '../../components/FloatingTabBar'

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', color: '#111827' },
        headerRight: () => (
          <TouchableOpacity
            style={styles.notificationHeaderBtn}
            onPress={() => console.log('Notification pressed')}
            activeOpacity={0.7}
          >
            <Bell color="#111827" size={22} />
            <View style={styles.headerBadge} />
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
