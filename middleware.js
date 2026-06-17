import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getSession() reads from the signed cookie — no network call, safe for Edge middleware.
  // Full token verification happens inside the calendar page via getUser() on the server.
  let session = null
  try {
    const { data } = await supabase.auth.getSession()
    session = data?.session ?? null
  } catch {
    return supabaseResponse
  }

  const isCalendarRoute = request.nextUrl.pathname.startsWith('/calendar')

  if (!session && isCalendarRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // MUST return supabaseResponse unmodified (or with cookies copied) so the
  // browser receives any refreshed session tokens set in setAll above.
  return supabaseResponse
}

export const config = {
  // /calendar is intentionally excluded: it's a static page (instant CDN paint)
  // that resolves auth client-side, so middleware must not add latency to it.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|auth/|calendar).*)'],
}
