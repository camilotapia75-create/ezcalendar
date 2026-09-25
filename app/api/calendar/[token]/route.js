import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { vcalendar } from '@/lib/calendarExport'

export const dynamic = 'force-dynamic'

// Subscribable calendar feed. A user subscribes their Google/Apple calendar to
//   webcal://<domain>/api/calendar/<feed_token>.ics
// and every event they pin flows in and stays updated. The token is an
// unguessable per-user secret (like Google's "secret address"); no session is
// present on these fetches, so we resolve the owner via the admin client.
export async function GET(_request, { params }) {
  const token = (params?.token || '').replace(/\.ics$/i, '')
  if (!token || token.length < 16) return new NextResponse('Not found', { status: 404 })

  try {
    const admin = createAdminClient()
    const { data: inv } = await admin
      .from('calendar_invites')
      .select('owner_id')
      .eq('feed_token', token)
      .single()

    if (!inv?.owner_id) return new NextResponse('Not found', { status: 404 })

    const { data: events } = await admin
      .from('events')
      .select('id, title, date, end_date, time_str, location, source_url')
      .eq('user_id', inv.owner_id)
      .order('date', { ascending: true })

    const ics = vcalendar(events || [], 'FLYRLY')
    return new NextResponse(ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="ezcalendar.ics"',
        // Calendar clients re-poll on their own cadence; a modest cache is fine
        'Cache-Control': 'public, max-age=1800',
      },
    })
  } catch (err) {
    return new NextResponse('Error', { status: 500 })
  }
}
