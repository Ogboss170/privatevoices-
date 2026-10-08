import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { supabase } from './supabase'

// 1. Configure foreground notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

/**
 * Register device for Expo Push Notifications and save token to Supabase
 */
export async function registerForPushNotificationsAsync(userId: string): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('[Push] Must use physical device for Push Notifications')
    return null
  }

  try {
    // Check permission status
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== 'granted') {
      console.log('[Push] Failed to get push token for push notification!')
      return null
    }

    // Android high priority notification channel with vibration pattern
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3b82f6',
        enableVibrate: true,
        showBadge: true,
      })
    }

    // Get Expo push token
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId

    const pushTokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    })

    const token = pushTokenData.data

    if (token && userId) {
      // Save token to Supabase database
      const { error } = await supabase.from('user_push_tokens').upsert(
        {
          user_id: userId,
          expo_push_token: token,
          device_type: Platform.OS,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,expo_push_token' }
      )

      if (error) {
        console.error('[Push] Error saving push token to database:', error.message)
      } else {
        console.log('[Push] Registered token successfully:', token)
      }
    }

    return token
  } catch (error) {
    console.error('[Push] Error during token registration:', error)
    return null
  }
}

/**
 * Listen for notification user interactions (tapping notification banner)
 */
export function setupNotificationListeners(onNavigate?: (targetUrl: string) => void) {
  // Listener when a user taps on a notification
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data
    const targetUrl = data?.targetUrl as string | undefined

    if (targetUrl && onNavigate) {
      onNavigate(targetUrl)
    }
  })

  return () => {
    subscription.remove()
  }
}
