import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { supabase } from './supabase'

// Configure default notification handler for in-app alert presentation
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export async function registerForPushNotificationsAsync(userId: string): Promise<string | null> {
  try {
    // 1. Android Notification Channel Setup
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7c3aed',
      })
    }

    // 2. Physical Device Check
    if (!Device.isDevice) {
      console.log('[Push] Must use physical device for Expo push notifications')
      // Record simulated development token for preview testing in simulators
      const simToken = `ExponentPushToken[dev-sim-${userId.slice(0, 8)}]`
      await supabase.from('user_push_tokens').upsert(
        {
          user_id: userId,
          expo_push_token: simToken,
          device_type: `${Platform.OS}-simulator`,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id, expo_push_token' }
      )
      return simToken
    }

    // 3. Request User Permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== 'granted') {
      console.log('[Push] Notification permission not granted')
      return null
    }

    // 4. Retrieve Expo Project ID & Generate Official Token
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId

    const pushTokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    )
    const token = pushTokenData.data

    // 5. Store / Upsert Token in Supabase PostgreSQL
    await supabase.from('user_push_tokens').upsert(
      {
        user_id: userId,
        expo_push_token: token,
        device_type: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id, expo_push_token' }
    )

    console.log('[Push] Official Expo token registered successfully:', token)
    return token
  } catch (err) {
    console.warn('[Push] Error registering push notification token:', err)
    return null
  }
}
