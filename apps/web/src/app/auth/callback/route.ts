import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/feed'

  if (code) {
    let response = NextResponse.redirect(`${origin}${next}`)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://trwraypolgqhkrxlijql.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyd3JheXBvbGdxaGtyeGxpanFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NDYyNjQsImV4cCI6MjEwNjUyMjI2NH0.PyOJX0issEMtgs80pWdcsFIzb-MaGwgdLoPEJYkRWBw',
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value)
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      const user = data.user
      // Check if user already has a profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile) {
        // Generate an initial username from email or name
        const rawName = (user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'user')
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '')
          .slice(0, 16)
        const randomSuffix = Math.floor(1000 + Math.random() * 9000)
        const initialUsername = `${rawName || 'user'}_${randomSuffix}`
        const initialDisplayName = user.user_metadata?.full_name || user.user_metadata?.name || initialUsername
        const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null

        // Create profile via create_profile or direct insert
        try {
          const { error: rpcErr } = await supabase.rpc('create_profile', {
            p_user_id: user.id,
            p_username: initialUsername,
            p_display_name: initialDisplayName,
            p_accepted_terms: true,
            p_email: user.email || null,
          })

          if (rpcErr) {
            console.warn('RPC create_profile fallback for OAuth user:', rpcErr.message)
            await supabase.from('profiles').insert({
              id: user.id,
              username: initialUsername,
              display_name: initialDisplayName,
              avatar_url: avatarUrl,
              accepted_terms: true,
            })
          } else if (avatarUrl) {
            await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id)
          }
        } catch (profileErr) {
          console.error('Error auto-creating profile for Google user:', profileErr)
        }
      }

      return response
    }
  }

  // Fallback to login with error
  const loginUrl = new URL('/login', origin)
  loginUrl.searchParams.set('error', 'Google authentication failed. Please try again.')
  return NextResponse.redirect(loginUrl)
}
