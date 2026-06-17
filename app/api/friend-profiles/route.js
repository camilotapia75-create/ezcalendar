import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ friends: [] }, { status: 401 })

  const { data: connections } = await supabase
    .from('calendar_connections')
    .select('user_a_id, user_b_id')
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)

  if (!connections?.length) return Response.json({ friends: [] })

  const friendIds = connections.map(c => c.user_a_id === user.id ? c.user_b_id : c.user_a_id)

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ friends: friendIds.map(id => ({ id, email: '', name: '' })) })
  }

  const admin = createAdminClient()
  const friends = await Promise.all(friendIds.map(async (id) => {
    try {
      const { data } = await admin.auth.admin.getUserById(id)
      const email = data?.user?.email || ''
      const name = data?.user?.user_metadata?.full_name || data?.user?.user_metadata?.name || ''
      return { id, email, name }
    } catch {
      return { id, email: '', name: '' }
    }
  }))

  return Response.json({ friends })
}
