import { useEffect } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { supabase } from '../lib/supabase'
import { registerForPushNotificationsAsync, setupNotificationListeners } from '../lib/pushNotifications'

/**
 * Root layout — handles Supabase auth state changes, redirects,
 * and registers device push notification tokens.
 */
export default function RootLayout() {
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const inAuthGroup = segments[0] === '(auth)'

        if (!session && !inAuthGroup) {
          router.replace('/(auth)/login')
        } else if (session && inAuthGroup) {
          router.replace('/(tabs)')
        }

        if (session?.user) {
          registerForPushNotificationsAsync(session.user.id)
        }
      }
    )

    // Setup deep-link listener for incoming notification taps
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
      subscription.unsubscribe()
      removeListener()
    }
  }, [segments, router])

  return <Slot />
}
