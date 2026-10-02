import { useEffect } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { supabase } from '../lib/supabase'

/**
 * Root layout — handles Supabase auth state changes and redirects
 * unauthenticated users to the (auth) group.
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
      }
    )

    return () => subscription.unsubscribe()
  }, [segments, router])

  return <Slot />
}
