import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

interface PushPayload {
  to: string | string[]
  title: string
  body: string
  sound?: string
  badge?: number
  data?: Record<string, any>
}

/**
 * API route to dispatch background Push Notifications via Expo Push Service
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, title, body, data } = await req.json()

    if (!userId || !title || !body) {
      return NextResponse.json(
        { success: false, message: 'Missing required parameters: userId, title, or body' },
        { status: 400 }
      )
    }

    const supabase = await createSupabaseServerClient()

    // 1. Fetch user notification preferences
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    // Filter by type if provided
    if (prefs && data?.type) {
      if (data.type === 'message' && prefs.dms_enabled === false) {
        return NextResponse.json({ success: true, skipped: 'dms_disabled' })
      }
      if (data.type === 'whisper' && prefs.whispers_enabled === false) {
        return NextResponse.json({ success: true, skipped: 'whispers_disabled' })
      }
      if (data.type === 'like' && prefs.likes_enabled === false) {
        return NextResponse.json({ success: true, skipped: 'likes_disabled' })
      }
      if (data.type === 'comment' && prefs.comments_enabled === false) {
        return NextResponse.json({ success: true, skipped: 'comments_disabled' })
      }
      if ((data.type === 'follow' || data.type === 'referral') && prefs.followers_enabled === false) {
        return NextResponse.json({ success: true, skipped: 'follows_disabled' })
      }
    }

    // 2. Fetch all registered Expo push tokens for the user
    const { data: tokenRecords, error: tokenError } = await supabase
      .from('user_push_tokens')
      .select('expo_push_token')
      .eq('user_id', userId)

    if (tokenError || !tokenRecords || tokenRecords.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active push tokens registered for this user',
        sentCount: 0,
      })
    }

    const tokens = tokenRecords.map((t) => t.expo_push_token)

    // 3. Prepare Expo push notifications
    const messages: PushPayload[] = tokens.map((token) => ({
      to: token,
      sound: 'default',
      title,
      body,
      badge: 1,
      data: data || {},
    }))

    // 4. Send via Expo Push API
    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    })

    const expoResult = await expoResponse.json()

    return NextResponse.json({
      success: true,
      sentCount: tokens.length,
      result: expoResult,
    })
  } catch (err: any) {
    console.error('[Push Dispatch API Error]:', err)
    return NextResponse.json(
      { success: false, message: err?.message || 'Failed to dispatch push notification' },
      { status: 500 }
    )
  }
}
