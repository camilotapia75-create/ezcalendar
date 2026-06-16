import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

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

// Local date key (YYYY-MM-DD) for a timezone at a given instant.
function localDateKey(tz, date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date)
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

  // The Hobby plan caps cron at one run/day, so we can't deliver at each user's
  // local 8 AM. Instead we run once at a fixed UTC hour and notify everyone — but
  // we still compute each user's "today/tomorrow" in THEIR timezone, so the digest
  // content is correct for their local calendar day. Resolve each timezone once
  // (many users share one) to avoid redundant Intl work.
  const tzKeys = {}
  const resolve = sub => {
    const tz = sub.timezone || DEFAULT_TZ
    if (!(tz in tzKeys)) {
      try {
        tzKeys[tz] = { todayKey: localDateKey(tz, now), tomorrowKey: localDateKey(tz, tomorrow) }
      } catch {
        tzKeys[tz] = { todayKey: localDateKey(DEFAULT_TZ, now), tomorrowKey: localDateKey(DEFAULT_TZ, tomorrow) }
      }
    }
    return tzKeys[tz]
  }
  const targets = subs.map(sub => ({ ...sub, ...resolve(sub) }))

  // Query events across the union of all users' local-date windows in one shot.
  // No per-user IN filter, so it scales without overflowing the request URL.
  const minKey = targets.reduce((m, s) => s.todayKey    < m ? s.todayKey    : m, targets[0].todayKey)
  const maxKey = targets.reduce((m, s) => s.tomorrowKey > m ? s.tomorrowKey : m, targets[0].tomorrowKey)
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

  const tasks = targets.map(sub => async () => {
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

  console.log('[push-notify] done', { subs: subs.length, sent, expired: expiredUserIds.length })
  return NextResponse.json({ sent, expired: expiredUserIds.length })
}
