import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const DEFAULT_TZ  = 'America/New_York'
const CONCURRENCY = 50

async function runBatch(tasks, concurrency) {
  let i = 0
  async function worker() {
    while (i < tasks.length) await tasks[i++]()
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker))
}

function localDateKey(tz, date) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(date)
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: DEFAULT_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(date)
  }
}

export async function GET(request) {
  // Verify Vercel cron secret
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('[push-notify] Unauthorized — CRON_SECRET mismatch or not set')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Guard VAPID keys early — without these nothing can be sent
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.error('[push-notify] VAPID keys not configured — set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Vercel env vars')
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
  }

  try {
    webpush.setVapidDetails(
      'mailto:noreply@ezcalendar.app',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    )
  } catch (err) {
    console.error('[push-notify] webpush.setVapidDetails failed:', err.message)
    return NextResponse.json({ error: 'VAPID setup failed: ' + err.message }, { status: 500 })
  }

  const supabase = createAdminClient()

  const { data: subs, error: subsErr } = await supabase
    .from('push_subscriptions')
    .select('user_id, subscription, timezone')

  if (subsErr) {
    console.error('[push-notify] failed to load subscriptions:', subsErr.message)
    return NextResponse.json({ error: subsErr.message }, { status: 500 })
  }

  if (!subs?.length) {
    console.log('[push-notify] no subscriptions found')
    return NextResponse.json({ sent: 0, reason: 'no subscriptions' })
  }

  console.log(`[push-notify] processing ${subs.length} subscription(s)`)

  const now      = new Date()
  const tomorrow = new Date(now.getTime() + 86400000)

  const tzKeys = {}
  const resolve = sub => {
    const tz = sub.timezone || DEFAULT_TZ
    if (!(tz in tzKeys)) {
      tzKeys[tz] = { todayKey: localDateKey(tz, now), tomorrowKey: localDateKey(tz, tomorrow) }
    }
    return tzKeys[tz]
  }
  const targets = subs.map(sub => ({ ...sub, ...resolve(sub) }))

  const minKey = targets.reduce((m, s) => s.todayKey    < m ? s.todayKey    : m, targets[0].todayKey)
  const maxKey = targets.reduce((m, s) => s.tomorrowKey > m ? s.tomorrowKey : m, targets[0].tomorrowKey)

  const { data: allEvents, error: eventsErr } = await supabase
    .from('events')
    .select('user_id, title, date, end_date')
    .lte('date', maxKey)
    .or(`date.gte.${minKey},end_date.gte.${minKey}`)

  if (eventsErr) {
    console.error('[push-notify] failed to load events:', eventsErr.message)
    return NextResponse.json({ error: eventsErr.message }, { status: 500 })
  }

  console.log(`[push-notify] found ${allEvents?.length || 0} event(s) in window [${minKey} → ${maxKey}]`)

  const eventsByUser = {}
  for (const e of (allEvents || [])) {
    if (!eventsByUser[e.user_id]) eventsByUser[e.user_id] = []
    eventsByUser[e.user_id].push(e)
  }

  const inRange = (e, key) => e.end_date ? e.date <= key && e.end_date >= key : e.date === key

  const expiredUserIds = []
  let sent = 0, skipped = 0

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

    if (!title) { skipped++; return }

    try {
      await webpush.sendNotification(sub.subscription, JSON.stringify({ title, body }))
      sent++
    } catch (err) {
      if (err.statusCode === 410) {
        expiredUserIds.push(sub.user_id)
        console.log(`[push-notify] subscription expired for user ${sub.user_id} — will remove`)
      } else {
        console.error('[push-notify] sendNotification failed', {
          statusCode: err.statusCode,
          message: err.message,
          user: sub.user_id,
        })
      }
    }
  })

  await runBatch(tasks, CONCURRENCY)

  if (expiredUserIds.length) {
    await supabase.from('push_subscriptions').delete().in('user_id', expiredUserIds)
    console.log(`[push-notify] removed ${expiredUserIds.length} expired subscription(s)`)
  }

  console.log('[push-notify] done', { subs: subs.length, sent, skipped, expired: expiredUserIds.length })
  return NextResponse.json({ sent, skipped, expired: expiredUserIds.length })
}
