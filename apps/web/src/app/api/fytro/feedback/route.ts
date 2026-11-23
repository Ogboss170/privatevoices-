import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// GET /api/fytro/feedback?messageId=<msg_id> or sessionId=<session_id>
export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const messageId = searchParams.get('messageId')
    const sessionId = searchParams.get('sessionId')

    let query = supabase
      .from('fytro_feedback')
      .select('*')
      .eq('user_id', user.id)

    if (messageId) {
      query = query.eq('message_id', messageId)
    } else if (sessionId) {
      query = query.eq('session_id', sessionId)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ feedback: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/fytro/feedback
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
    const { messageId, sessionId, reaction, reasons = [], comment = null } = body

    if (!messageId || !reaction || !['like', 'dislike'].includes(reaction)) {
      return NextResponse.json({ error: 'Valid messageId and reaction (like/dislike) are required' }, { status: 400 })
    }

    // Upsert user feedback on this message
    const { data, error } = await supabase
      .from('fytro_feedback')
      .upsert(
        {
          message_id: messageId,
          session_id: sessionId || null,
          user_id: user.id,
          reaction,
          reasons: Array.isArray(reasons) ? reasons : [],
          comment: comment ? String(comment).trim() : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,message_id' }
      )
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ feedback: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/fytro/feedback?messageId=<msg_id>
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const messageId = searchParams.get('messageId')

    if (!messageId) {
      return NextResponse.json({ error: 'messageId is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('fytro_feedback')
      .delete()
      .eq('user_id', user.id)
      .eq('message_id', messageId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
