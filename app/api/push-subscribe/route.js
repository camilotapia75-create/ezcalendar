import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import webpush from 'web-push'

export async function POST(request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const subscription = await request.json()
  if (!subscription?.endpoint) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })

  await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: user.id, subscription: subscription, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )

  // Send an immediate push to confirm the subscription pipeline works.
  // This fires when the user enables notifications or when self-heal runs,
  // giving them instant feedback instead of waiting for the daily cron.
  if (process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    try {
      webpush.setVapidDetails(
        'mailto:noreply@ezcalendar.app',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY,
      )
      await webpush.sendNotification(
        subscription,
        JSON.stringify({ title: '📌 Notifications on', body: "You'll get a daily heads-up about events happening today or tomorrow." })
      )
    } catch {} // non-fatal
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase.from('push_subscriptions').delete().eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}
