import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return NextResponse.json({ error: 'Push not configured' }, { status: 500 })
  }

  const admin = createAdminClient()
  const { data: sub } = await admin
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', user.id)
    .single()

  if (!sub?.subscription) {
    return NextResponse.json({ error: 'No subscription found — enable notifications first' }, { status: 404 })
  }

  webpush.setVapidDetails(
    'mailto:noreply@ezcalendar.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )

  // Hold for 8s before sending so the user has time to close the app and confirm
  // the notification truly arrives in the BACKGROUND (the whole point of the test).
  // The request stays alive server-side even after the client closes the app.
  await new Promise(r => setTimeout(r, 8000))

  try {
    await webpush.sendNotification(
      sub.subscription,
      JSON.stringify({ title: '📌 Test notification', body: 'Background push is working! 🎉' })
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err.message, statusCode: err.statusCode }, { status: 500 })
  }
}
