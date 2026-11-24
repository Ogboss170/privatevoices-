import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Redirect root path directly to /feed for a seamless feed-first experience (like TikTok, Instagram, X)
  if (pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/feed'
    return NextResponse.redirect(url)
  }

  // Public routes that don't require authentication - allows visitors to browse feed and explore freely
  const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password', '/auth/callback', '/', '/feed', '/explore']
  const isPublicRoute = publicRoutes.includes(pathname)
  // Profile routes (/@username), post detail routes (/post/...), and public invite/join landing pages
  const isProfileRoute = pathname.startsWith('/@')
  const isPostRoute = pathname.startsWith('/post/')
  const isPublicInviteRoute = pathname.startsWith('/invite/') || pathname.startsWith('/join/')
  const isApiRoute = pathname.startsWith('/api/')

  if (!user && !isPublicRoute && !isProfileRoute && !isPostRoute && !isPublicInviteRoute && !isApiRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && (pathname === '/login' || pathname === '/register')) {
    const url = request.nextUrl.clone()
    url.pathname = '/feed'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
