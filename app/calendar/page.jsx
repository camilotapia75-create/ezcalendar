import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CalendarClient from '@/components/CalendarClient'

export default async function CalendarPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .order('date', { ascending: true })

  return <CalendarClient initialEvents={events || []} user={user} />
}
