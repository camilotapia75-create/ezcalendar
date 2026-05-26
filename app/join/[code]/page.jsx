import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function JoinPage({ params }) {
  const { code } = params
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/?next=/join/${code}`)
  }

  const { data: invite } = await supabase
    .from('calendar_invites')
    .select('owner_id')
    .eq('invite_code', code)
    .single()

  if (!invite) {
    redirect('/calendar?join_err=notfound')
  }

  if (invite.owner_id === user.id) {
    redirect('/calendar?join_err=self')
  }

  // Smaller UUID goes in user_a_id (ensures one row per pair)
  const ids = [user.id, invite.owner_id].sort()
  await supabase
    .from('calendar_connections')
    .upsert(
      { user_a_id: ids[0], user_b_id: ids[1] },
      { onConflict: 'user_a_id,user_b_id', ignoreDuplicates: true }
    )

  redirect('/calendar?joined=1')
}
