import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// POST /api/fytro/report
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { messageId, sessionId, reason, details = null } = body

    if (!messageId || !reason) {
      return NextResponse.json({ error: 'messageId and reason are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('fytro_reports')
      .insert({
        message_id: messageId,
        session_id: sessionId || null,
        user_id: user.id,
        reason: String(reason).trim(),
        details: details ? String(details).trim() : null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ report: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
