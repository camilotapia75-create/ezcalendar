import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function localDateKey(tz, date) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(date)
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(date)
  }
}

// Called by the client on first app-open each day as a cron fallback.
// Sends the daily digest push if events exist for today/tomorrow.
// Returns { sent, alreadySent, title, body } — client stores the date in
// localStorage so it only calls this once per calendar day.
export async function POST(request) {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: 'vapid_not_configured' }, { status: 500 })
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: row } = await admin
    .from('push_subscriptions')
    .select('subscription, timezone')
    .eq('user_id', user.id)
    .single()

  if (!row?.subscription) {
    return NextResponse.json({ sent: false, reason: 'no_subscription' })
  }

  const tz       = row.timezone || 'America/New_York'
  const now      = new Date()
  const tomorrow = new Date(now.getTime() + 86400000)
  const todayKey    = localDateKey(tz, now)
  const tomorrowKey = localDateKey(tz, tomorrow)

  const { data: events } = await admin
    .from('events')
    .select('title, date, end_date')
    .eq('user_id', user.id)
    .lte('date', tomorrowKey)
    .or(`date.gte.${todayKey},end_date.gte.${todayKey}`)

  const inRange = (e, key) => e.end_date ? e.date <= key && e.end_date >= key : e.date === key
  const todayEvts    = (events || []).filter(e => inRange(e, todayKey))
  const tomorrowEvts = (events || []).filter(e => inRange(e, tomorrowKey))

  if (todayEvts.length === 0 && tomorrowEvts.length === 0) {
    return NextResponse.json({ sent: false, reason: 'no_events' })
  }

  let title, body
  if (todayEvts.length > 0) {
    title = `${todayEvts.length} event${todayEvts.length > 1 ? 's' : ''} today! 📌`
    body  = todayEvts.map(e => e.title || 'Event').join(' • ')
  } else {
    title = `${tomorrowEvts.length} event${tomorrowEvts.length > 1 ? 's' : ''} tomorrow 📌`
    body  = tomorrowEvts.map(e => e.title || 'Event').join(' • ')
  }

  webpush.setVapidDetails(
    'mailto:noreply@ezcalendar.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )

  try {
    await webpush.sendNotification(row.subscription, JSON.stringify({ title, body }))
    return NextResponse.json({ sent: true, title, body })
  } catch (err) {
    if (err.statusCode === 410) {
      await admin.from('push_subscriptions').delete().eq('user_id', user.id)
    }
    return NextResponse.json({ sent: false, reason: err.message }, { status: 500 })
  }
}
