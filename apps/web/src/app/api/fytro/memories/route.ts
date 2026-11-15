import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// GET: Fetch all memories for authenticated user
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('fytro_memories')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    const mapped = (data || []).map((m: any) => ({
      id: m.id,
      userId: m.user_id,
      category: m.category,
      memoryText: m.memory_text,
      importance: m.importance,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
    }))

    return NextResponse.json({ memories: mapped })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch memories' }, { status: 500 })
  }
}

// POST: Add a new self-sovereign memory
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { memoryText, category = 'perspective', importance = 1 } = body

    if (!memoryText || !memoryText.trim()) {
      return NextResponse.json({ error: 'memoryText is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('fytro_memories')
      .insert({
        user_id: user.id,
        category,
        memory_text: memoryText.trim(),
        importance,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      memory: {
        id: data.id,
        userId: data.user_id,
        category: data.category,
        memoryText: data.memory_text,
        importance: data.importance,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create memory' }, { status: 500 })
  }
}

// DELETE: Remove an individual memory or burn all
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(req.url)
    const memoryId = url.searchParams.get('id')
    const burnAll = url.searchParams.get('burnAll') === 'true'

    if (burnAll) {
      const { data, error } = await supabase.rpc('burn_fytro_memories')
      if (error) throw error
      return NextResponse.json({ success: true, burnedCount: data })
    }

    if (!memoryId) {
      return NextResponse.json({ error: 'memoryId is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('fytro_memories')
      .delete()
      .eq('id', memoryId)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true, deletedId: memoryId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete memory' }, { status: 500 })
  }
}
