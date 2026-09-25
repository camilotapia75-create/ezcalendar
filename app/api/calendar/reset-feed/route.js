import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

// Rotate the user's calendar feed token. The OLD feed URL then 404s, so any
// device subscribed to it stops receiving updates — i.e. "unsubscribe". A fresh
// token is returned so the user can re-subscribe if they want.
export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const feed_token = randomUUID()
  // Upsert so it works whether or not an invites row already exists.
  const { error } = await admin
    .from('calendar_invites')
    .upsert({ owner_id: user.id, feed_token }, { onConflict: 'owner_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ feedToken: feed_token })
}
