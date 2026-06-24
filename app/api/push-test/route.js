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

export async function POST() {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: 'VAPID keys not configured in Vercel environment variables' }, { status: 500 })
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
    return NextResponse.json({ error: 'no_subscription', message: 'No push subscription found. Toggle notifications off then on again.' }, { status: 404 })
  }

  // Build the same notification the daily cron would send for this user right now
  const tz = row.timezone || 'America/New_York'
  const now = new Date()
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

  let title, body
  if (todayEvts.length > 0) {
    title = `${todayEvts.length} event${todayEvts.length > 1 ? 's' : ''} today! 📌`
    body  = todayEvts.map(e => e.title || 'Event').join(' • ')
  } else if (tomorrowEvts.length > 0) {
    title = `${tomorrowEvts.length} event${tomorrowEvts.length > 1 ? 's' : ''} tomorrow 📌`
    body  = tomorrowEvts.map(e => e.title || 'Event').join(' • ')
  } else {
    // No events — still confirm the pipeline works with a diagnostic message
    title = 'ezcalendar 📌'
    body  = 'No events today or tomorrow — pipeline is working!'
  }

  webpush.setVapidDetails(
    'mailto:noreply@ezcalendar.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )

  try {
    await webpush.sendNotification(row.subscription, JSON.stringify({ title, body }))
    return NextResponse.json({ ok: true, title, body, todayCount: todayEvts.length, tomorrowCount: tomorrowEvts.length })
  } catch (err) {
    if (err.statusCode === 410) {
      await admin.from('push_subscriptions').delete().eq('user_id', user.id)
      return NextResponse.json({ error: 'expired', message: 'Subscription expired — toggle notifications off then on' }, { status: 410 })
    }
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'vapid_mismatch', message: 'VAPID key mismatch — regenerate keys in Vercel' }, { status: 401 })
    }
    return NextResponse.json({ error: err.message, statusCode: err.statusCode }, { status: 500 })
  }
}
