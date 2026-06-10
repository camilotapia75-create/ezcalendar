import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  // Protect: Vercel Cron sends this header, or allow a manual secret
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

  // Get all push subscriptions with their user's upcoming events
  const { data: subs } = await supabase.from('push_subscriptions').select('user_id, subscription')
  if (!subs?.length) return NextResponse.json({ sent: 0 })

  const pad = n => String(n).padStart(2, '0')
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`
  const tom = new Date(today); tom.setDate(today.getDate() + 1)
  const tomorrowKey = `${tom.getFullYear()}-${pad(tom.getMonth()+1)}-${pad(tom.getDate())}`

  let sent = 0
  for (const sub of subs) {
    const { data: events } = await supabase
      .from('events')
      .select('title, date, end_date')
      .or(`user_id.eq.${sub.user_id}`)
      .gte('date', todayKey)
      .lte('date', tomorrowKey)

    const inRange = (e, key) => e.end_date ? e.date <= key && e.end_date >= key : e.date === key
    const todayEvts    = (events || []).filter(e => inRange(e, todayKey))
    const tomorrowEvts = (events || []).filter(e => inRange(e, tomorrowKey))

    let title = null, body = null
    if (todayEvts.length > 0) {
      title = `${todayEvts.length} event${todayEvts.length > 1 ? 's' : ''} today! 📌`
      body  = todayEvts.map(e => e.title || 'Event').join(' • ')
    } else if (tomorrowEvts.length > 0) {
      title = `${tomorrowEvts.length} event${tomorrowEvts.length > 1 ? 's' : ''} tomorrow 📌`
      body  = tomorrowEvts.map(e => e.title || 'Event').join(' • ')
    }

    if (!title) continue
    try {
      await webpush.sendNotification(sub.subscription, JSON.stringify({ title, body }))
      sent++
    } catch (err) {
      if (err.statusCode === 410) {
        // Subscription expired — remove it
        await supabase.from('push_subscriptions').delete().eq('user_id', sub.user_id)
      }
    }
  }

  return NextResponse.json({ sent })
}
