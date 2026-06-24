import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: 'VAPID keys not configured on server — add NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to Vercel env vars' }, { status: 500 })
  }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', user.id)
    .single()

  if (!row?.subscription) {
    return NextResponse.json({ error: 'No push subscription found in database — try toggling notifications off and on again' }, { status: 404 })
  }

  webpush.setVapidDetails(
    'mailto:noreply@ezcalendar.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )

  try {
    await webpush.sendNotification(
      row.subscription,
      JSON.stringify({ title: '📌 ezcalendar', body: 'Notifications are working!' })
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err.statusCode === 410) {
      // Subscription expired on the browser side — clean it up so self-heal re-registers it
      await admin.from('push_subscriptions').delete().eq('user_id', user.id)
      return NextResponse.json({ error: 'expired', message: 'Subscription expired — toggle notifications off and on to re-register' }, { status: 410 })
    }
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'vapid_mismatch', message: 'VAPID key mismatch — the key used to subscribe differs from the server key. Re-generate VAPID keys or re-subscribe.' }, { status: 401 })
    }
    return NextResponse.json({ error: err.message, statusCode: err.statusCode }, { status: 500 })
  }
}
