import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  // Back-compat: older clients POSTed the raw subscription object directly.
  const subscription = body.subscription || body
  const timezone = body.timezone || null
  if (!subscription?.endpoint) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })

  const row = { user_id: user.id, subscription, updated_at: new Date().toISOString() }
  // Only set timezone when provided, so an old client doesn't wipe a stored value.
  if (timezone) row.timezone = timezone

  await supabase
    .from('push_subscriptions')
    .upsert(row, { onConflict: 'user_id' })

  return NextResponse.json({ ok: true })
}

export async function DELETE(request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase.from('push_subscriptions').delete().eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}
