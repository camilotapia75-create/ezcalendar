import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CalendarClient from '@/components/CalendarClient'

export default async function CalendarPage({ searchParams }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // Get or create user's invite code
  let { data: invite } = await supabase
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

  // Count connected friends
  const { data: connections } = await supabase
    .from('calendar_connections')
    .select('user_a_id, user_b_id')
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)

  const connectedCount = (connections || []).length

  // Fetch events — RLS includes connected users' events automatically
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .order('date', { ascending: true })

  return (
    <CalendarClient
      initialEvents={events || []}
      user={user}
      inviteCode={invite?.invite_code || ''}
      connectedCount={connectedCount}
      joined={searchParams?.joined === '1'}
      joinErr={searchParams?.join_err}
    />
  )
}
