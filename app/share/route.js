import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// PWA share-target endpoint: the system share sheet sends shared content
// here as query params. Apps are inconsistent about WHICH param carries the
// link (Instagram uses `text`), so scan all of them for the first URL.
export function GET(request) {
  const sp = new URL(request.url).searchParams
  const raw = [sp.get('url'), sp.get('text'), sp.get('title')].filter(Boolean).join(' ')
  const match = raw.match(/https?:\/\/[^\s]+/)
  const dest = match ? `/calendar?scan=${encodeURIComponent(match[0])}` : '/calendar'
  return NextResponse.redirect(new URL(dest, request.url))
}
