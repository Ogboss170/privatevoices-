import { useEffect, useState } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../lib/supabase'
import { registerForPushNotificationsAsync, setupNotificationListeners } from '../lib/pushNotifications'
import { ONBOARDING_STORAGE_KEY } from './onboarding'

// Keep splash screen visible while initializing app state
SplashScreen.preventAutoHideAsync()

/**
 * Root layout — handles native splash screen, onboarding check,
 * Supabase auth state changes, redirects, and push notification tokens.
 */
export default function RootLayout() {
  const router = useRouter()
  const segments = useSegments()
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function prepareApp() {
      try {
        const hasCompletedOnboarding = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY)
        const { data: { session } } = await supabase.auth.getSession()

        if (!isMounted) return

        const inAuthGroup = segments[0] === '(auth)'
        const inOnboarding = segments[0] === 'onboarding'

        if (hasCompletedOnboarding !== 'true' && !inOnboarding) {
          router.replace('/onboarding')
        } else if (hasCompletedOnboarding === 'true') {
          if (!session && !inAuthGroup && !inOnboarding) {
            router.replace('/(auth)/login')
          } else if (session && (inAuthGroup || inOnboarding)) {
            router.replace('/(tabs)')
          }
        }

        if (session?.user) {
          registerForPushNotificationsAsync(session.user.id)
        }
      } catch {
        // Fallback gracefully on storage error
      } finally {
        if (isMounted) {
          setIsReady(true)
          await SplashScreen.hideAsync()
        }
      }
    }

    prepareApp()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const hasCompletedOnboarding = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY)
        const inAuthGroup = segments[0] === '(auth)'
        const inOnboarding = segments[0] === 'onboarding'

        if (hasCompletedOnboarding !== 'true' && !inOnboarding) {
          router.replace('/onboarding')
        } else if (!session && !inAuthGroup && !inOnboarding) {
          router.replace('/(auth)/login')
        } else if (session && (inAuthGroup || inOnboarding)) {
          router.replace('/(tabs)')
        }

        if (session?.user) {
          registerForPushNotificationsAsync(session.user.id)
        }
      }
    )

    const removeListener = setupNotificationListeners((targetUrl) => {
      if (targetUrl) {
        try {
          router.push(targetUrl as any)
        } catch {
          // Fallback if route formatting varies
        }
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
      removeListener()
    }
  }, [segments, router])

  if (!isReady) {
    return null
  }

  return <Slot />
}
