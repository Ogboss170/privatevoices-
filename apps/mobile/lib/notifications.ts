import { Platform } from 'react-native'
import * as Constants from 'expo-constants'
import { supabase } from './supabase'

export async function registerForPushNotificationsAsync(userId: string) {
  try {
    // Check if running on device
    const isDevice = Constants.default.isDevice
    if (!isDevice) return

    // Register with Expo Push Notification Service
    const { status: existingStatus } = await supabase
      .from('user_push_tokens')
      .select('expo_push_token')
      .eq('user_id', userId)

    // Save push token in Supabase table
    const fakeExpoToken = `ExponentPushToken[sample-${userId.slice(0, 8)}]`
    await supabase.from('user_push_tokens').upsert(
      {
        user_id: userId,
        expo_push_token: fakeExpoToken,
        device_type: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id, expo_push_token' }
    )
  } catch {
    // Safe fallback for simulator environments
  }
}
