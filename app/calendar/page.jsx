import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import CalendarClient from '@/components/CalendarClient'

export default async function CalendarPage({ searchParams }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // Get or create user's invite code (gracefully no-ops if table doesn't exist yet)
  let inviteCode = ''
  try {
    let { data: invite, error } = await supabase
      .from('calendar_invites')
      .select('invite_code')
      .eq('owner_id', user.id)
      .single()

    if (!invite) {
      const { data: newInvite } = await supabase
        .from('calendar_invites')
        .insert({ owner_id: user.id })
        .select('invite_code')
        .single()
      invite = newInvite
    }
    inviteCode = invite?.invite_code || ''
  } catch (_) {}

  // Fetch connected friends with their display info
  let connectedCount = 0
  let connectedFriends = []
  try {
    const { data: connections } = await supabase
      .from('calendar_connections')
      .select('user_a_id, user_b_id')
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    connectedCount = (connections || []).length

    if (connections?.length && process.env.SUPABASE_SERVICE_ROLE_KEY) {
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
    }
  } catch (_) {}

  // Fetch events — RLS includes connected users' events automatically
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .order('date', { ascending: true })

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
