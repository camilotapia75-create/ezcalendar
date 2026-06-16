import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Send the daily digest at this local hour (24h) in each user's own timezone.
const TARGET_HOUR = 8
// Fallback timezone for subscriptions saved before we tracked it.
const DEFAULT_TZ = 'America/Los_Angeles'
// Max concurrent push deliveries — prevents OOM with thousands of subscribers
const CONCURRENCY = 50

async function runBatch(tasks, concurrency) {
  let i = 0
  async function worker() {
    while (i < tasks.length) await tasks[i++]()
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker))
}

// Local hour (integer 0–23) and local date key (YYYY-MM-DD) for a timezone.
function localParts(tz, date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hour12: false,
  }).formatToParts(date)
  const get = t => parts.find(p => p.type === t)?.value
  return {
    hour: parseInt(get('hour'), 10) % 24, // Intl can emit "24" at midnight
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
  }
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  webpush.setVapidDetails(
    'mailto:noreply@ezcalendar.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )

  const supabase = createAdminClient()

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('user_id, subscription, timezone')
  if (!subs?.length) return NextResponse.json({ sent: 0 })

  const now = new Date()
  const tomorrow = new Date(now.getTime() + 86400000)

  // Resolve each timezone once (many users share a timezone). A subscriber is
  // "active" this run only if their local time is currently TARGET_HOUR — which
  // happens exactly once per day per timezone, so each user gets one digest/day.
  const tzInfo = {}
  const activeSubs = []
  for (const sub of subs) {
    const tz = sub.timezone || DEFAULT_TZ
    if (!(tz in tzInfo)) {
      try {
        const cur = localParts(tz, now)
        tzInfo[tz] = cur.hour === TARGET_HOUR
          ? { todayKey: cur.dateKey, tomorrowKey: localParts(tz, tomorrow).dateKey }
          : null
      } catch {
        tzInfo[tz] = null // invalid timezone string — skip
      }
    }
    if (tzInfo[tz]) activeSubs.push({ ...sub, ...tzInfo[tz] })
  }

  if (!activeSubs.length) return NextResponse.json({ sent: 0, checked: subs.length })

  // Query events across the union of active local-date windows in one shot.
  // No per-user IN filter, so it scales without overflowing the request URL.
  const minKey = activeSubs.reduce((m, s) => s.todayKey    < m ? s.todayKey    : m, activeSubs[0].todayKey)
  const maxKey = activeSubs.reduce((m, s) => s.tomorrowKey > m ? s.tomorrowKey : m, activeSubs[0].tomorrowKey)
  const { data: allEvents } = await supabase
    .from('events')
    .select('user_id, title, date, end_date')
    .lte('date', maxKey)
    .or(`date.gte.${minKey},end_date.gte.${minKey}`)

  const eventsByUser = {}
  for (const e of (allEvents || [])) {
    if (!eventsByUser[e.user_id]) eventsByUser[e.user_id] = []
    eventsByUser[e.user_id].push(e)
  }

  // A multi-day event counts for a given day if that day falls within its span.
  const inRange = (e, key) => e.end_date ? e.date <= key && e.end_date >= key : e.date === key

  const expiredUserIds = []
  let sent = 0

  const tasks = activeSubs.map(sub => async () => {
    const events = eventsByUser[sub.user_id] || []
    const todayEvts    = events.filter(e => inRange(e, sub.todayKey))
    const tomorrowEvts = events.filter(e => inRange(e, sub.tomorrowKey))

    let title = null, body = null
    if (todayEvts.length > 0) {
      title = `${todayEvts.length} event${todayEvts.length > 1 ? 's' : ''} today! 📌`
      body  = todayEvts.map(e => e.title || 'Event').join(' • ')
    } else if (tomorrowEvts.length > 0) {
      title = `${tomorrowEvts.length} event${tomorrowEvts.length > 1 ? 's' : ''} tomorrow 📌`
      body  = tomorrowEvts.map(e => e.title || 'Event').join(' • ')
    }

    if (!title) return

    try {
      await webpush.sendNotification(sub.subscription, JSON.stringify({ title, body }))
      sent++
    } catch (err) {
      if (err.statusCode === 410) {
        expiredUserIds.push(sub.user_id)
      } else {
        // Log non-410 errors (e.g. 401 = VAPID key mismatch) so they surface in Vercel logs
        console.error('[push-notify] sendNotification failed', { statusCode: err.statusCode, message: err.message, user: sub.user_id })
      }
    }
  })

  await runBatch(tasks, CONCURRENCY)

  // Bulk-delete expired subscriptions in one query
  if (expiredUserIds.length) {
    await supabase.from('push_subscriptions').delete().in('user_id', expiredUserIds)
  }

  console.log('[push-notify] done', { checked: subs.length, active: activeSubs.length, sent, expired: expiredUserIds.length })
  return NextResponse.json({ sent, active: activeSubs.length, expired: expiredUserIds.length })
}
