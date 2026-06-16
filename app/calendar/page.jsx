import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CalendarClient from '@/components/CalendarClient'

export default async function CalendarPage({ searchParams }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/')

  return (
    <CalendarClient
      user={session.user}
      joined={searchParams?.joined === '1'}
      joinErr={searchParams?.join_err}
      scanUrl={typeof searchParams?.scan === 'string' ? searchParams.scan : null}
    />
  )
}
