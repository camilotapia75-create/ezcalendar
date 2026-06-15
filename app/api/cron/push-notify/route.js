import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Max concurrent push deliveries — prevents OOM with thousands of subscribers
const CONCURRENCY = 50

async function runBatch(tasks, concurrency) {
  const results = []
  let i = 0
  async function worker() {
    while (i < tasks.length) {
      const idx = i++
      results[idx] = await tasks[idx]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker))
  return results
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

  const { data: subs } = await supabase.from('push_subscriptions').select('user_id, subscription')
  if (!subs?.length) return NextResponse.json({ sent: 0 })

  const pad = n => String(n).padStart(2, '0')
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`
  const tom = new Date(today); tom.setDate(today.getDate() + 1)
  const tomorrowKey = `${tom.getFullYear()}-${pad(tom.getMonth()+1)}-${pad(tom.getDate())}`

  // Single query for ALL subscribed users' events — avoids N+1 at scale.
  // The OR filter captures multi-day events that started before today (date < today)
  // but end today or tomorrow (end_date >= today).
  const userIds = subs.map(s => s.user_id)
  const { data: allEvents } = await supabase
    .from('events')
    .select('user_id, title, date, end_date')
    .in('user_id', userIds)
    .lte('date', tomorrowKey)
    .or(`date.gte.${todayKey},end_date.gte.${todayKey}`)

  // Group events by user_id for O(1) lookup per subscriber
  const eventsByUser = {}
  for (const e of (allEvents || [])) {
    if (!eventsByUser[e.user_id]) eventsByUser[e.user_id] = []
    eventsByUser[e.user_id].push(e)
  }

  const inRange = (e, key) => e.end_date ? e.date <= key && e.end_date >= key : e.date === key

  const expiredUserIds = []
  let sent = 0

  const tasks = subs.map(sub => async () => {
    const events = eventsByUser[sub.user_id] || []
    const todayEvts    = events.filter(e => inRange(e, todayKey))
    const tomorrowEvts = events.filter(e => inRange(e, tomorrowKey))

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
      if (err.statusCode === 410) expiredUserIds.push(sub.user_id)
    }
  })

  await runBatch(tasks, CONCURRENCY)

  // Bulk-delete expired subscriptions in one query
  if (expiredUserIds.length) {
    await supabase.from('push_subscriptions').delete().in('user_id', expiredUserIds)
  }

  return NextResponse.json({ sent, expired: expiredUserIds.length })
}
