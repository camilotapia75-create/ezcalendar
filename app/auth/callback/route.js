import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/calendar'

  if (code) {
    // Build the redirect response FIRST so we can set cookies on it.
    const response = NextResponse.redirect(`${origin}${next}`)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          // Write session cookies directly onto the redirect response
          // so the browser receives them before hitting /calendar.
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) return response

    // Exchange failed (e.g. code already used, cross-device PKCE mismatch).
    // Fall through to error redirect below.
  }

  // No code or exchange failed — send back to login.
  // Do NOT redirect to /calendar or we create a loop.
  const errorUrl = new URL('/', origin)
  errorUrl.searchParams.set('error', 'auth')
  return NextResponse.redirect(errorUrl)
}
