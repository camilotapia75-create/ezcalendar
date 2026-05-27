import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuthForm from '@/components/AuthForm'

export default async function Home({ searchParams }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const next = searchParams?.next
  if (user) redirect(next || '/calendar')

  const authError = searchParams?.error === 'auth'

  const isInvite = next?.startsWith('/join/')

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xs">
        <div className="text-center mb-10">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black mx-auto mb-5"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
          >
            ez
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-1.5">ezcalendar</h1>
          <p className="text-sm text-zinc-500">
            {isInvite ? 'A friend invited you to share their calendar.' : 'Snap a flyer. AI pins it to the date.'}
          </p>
        </div>
        {isInvite && (
          <div
            className="mb-4 px-4 py-3 rounded-xl text-sm text-center"
            style={{ background: 'rgba(124,58,237,0.1)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.25)' }}
          >
            Create a free account to accept the invite and see their events.
          </div>
        )}
        {authError && (
          <div
            className="mb-4 px-4 py-3 rounded-xl text-sm text-center"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            Link expired or already used — request a new one below.
          </div>
        )}
        <AuthForm next={next} isInvite={isInvite} />
      </div>
    </div>
  )
}
