import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import CalendarClient from '@/components/CalendarClient'

export default async function CalendarPage({ searchParams }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // These three queries are independent — run them concurrently to cut the
  // server round-trips (and the time-to-first-byte) roughly in half.
  const [inviteRes, connectionsRes, eventsRes] = await Promise.all([
    // Invite code (gracefully no-ops if table doesn't exist yet)
    supabase.from('calendar_invites').select('invite_code').eq('owner_id', user.id).single()
      .then(r => r).catch(() => ({ data: null })),
    // Connections
    supabase.from('calendar_connections').select('user_a_id, user_b_id')
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .then(r => r).catch(() => ({ data: null })),
    // Events — RLS includes connected users' events automatically
    supabase.from('events').select('*').order('date', { ascending: true })
      .then(r => r).catch(() => ({ data: null })),
  ])

  // Create invite code on first visit if one doesn't exist yet
  let inviteCode = inviteRes?.data?.invite_code || ''
  if (!inviteCode) {
    try {
      const { data: newInvite } = await supabase
        .from('calendar_invites')
        .insert({ owner_id: user.id })
        .select('invite_code')
        .single()
      inviteCode = newInvite?.invite_code || ''
    } catch (_) {}
  }

  // Resolve connected friends' display info (depends on the connections result)
  const connections = connectionsRes?.data || []
  let connectedCount = connections.length
  let connectedFriends = []
  if (connections.length && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const adminSupabase = createAdminClient()
      const friendIds = connections.map(c => c.user_a_id === user.id ? c.user_b_id : c.user_a_id)
      connectedFriends = await Promise.all(friendIds.map(async id => {
        try {
          const { data } = await adminSupabase.auth.admin.getUserById(id)
          const email = data?.user?.email || ''
          const name = data?.user?.user_metadata?.full_name || data?.user?.user_metadata?.name || ''
          return { id, email, name }
        } catch { return { id, email: '', name: '' } }
      }))
    } catch (_) {}
  }

  const events = eventsRes?.data

  return (
    <CalendarClient
      initialEvents={events || []}
      user={user}
      inviteCode={inviteCode}
      connectedCount={connectedCount}
      connectedFriends={connectedFriends}
      joined={searchParams?.joined === '1'}
      joinErr={searchParams?.join_err}
      scanUrl={typeof searchParams?.scan === 'string' ? searchParams.scan : null}
    />
  )
}
