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
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{
        backgroundImage: [
          'linear-gradient(160deg, #fef9f2 0%, #fff5e8 55%, #fef2f8 100%)',
          'repeating-linear-gradient(transparent 0px, transparent 27px, rgba(180,140,100,0.07) 28px)',
        ].join(', '),
      }}
    >
      <div className="w-full max-w-xs">
        <div className="text-center mb-8">
          <div style={{ fontSize: 54, lineHeight: 1, color: '#1a1a2e', fontWeight: 700, marginBottom: 8, letterSpacing: '-1px' }}>
            📌 ezcalendar
          </div>
          <p style={{ fontSize: 17, color: '#7c6a56' }}>
            {isInvite ? 'A friend invited you to share their calendar.' : 'Snap a flyer. It lands on the right date.'}
          </p>
        </div>

        {isInvite && (
          <div
            className="mb-4 px-4 py-3 text-center"
            style={{ background: 'rgba(124,58,237,0.07)', color: '#5b21b6', border: '1.5px solid rgba(124,58,237,0.18)', borderRadius: 4, fontSize: 16 }}
          >
            Create a free account to accept the invite and see their events.
          </div>
        )}
        {authError && (
          <div
            className="mb-4 px-4 py-3 text-center"
            style={{ background: 'rgba(239,68,68,0.06)', color: '#b91c1c', border: '1.5px solid rgba(239,68,68,0.18)', borderRadius: 4, fontSize: 16 }}
          >
            Link expired or already used — request a new one below.
          </div>
        )}

        <div style={{ position: 'relative', background: '#fffdf8', border: '1.5px solid #e0ccb4', borderRadius: 4, boxShadow: '4px 4px 0 rgba(140,100,60,0.15)', padding: '28px 24px 24px' }}>
          <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', width: 44, height: 20, background: 'rgba(253,224,71,0.75)', borderRadius: 3, boxShadow: '0 1px 4px rgba(0,0,0,0.09)' }} />
          <AuthForm next={next} isInvite={isInvite} />
        </div>
      </div>
    </div>
  )
}
