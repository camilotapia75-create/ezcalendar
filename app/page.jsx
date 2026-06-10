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

        {/* Product preview — mini flyers pinned to dates */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 36 }}>
          {[
            { day: 'FRI 12', grad: 'linear-gradient(135deg,#c084fc,#7c3aed)', emoji: '🎶', rot: -5 },
            { day: 'SAT 13', grad: 'linear-gradient(135deg,#f472b6,#db2777)', emoji: '🎨', rot: 2 },
            { day: 'SUN 14', grad: 'linear-gradient(135deg,#fbbf24,#ea580c)', emoji: '🌮', rot: 6 },
          ].map(f => (
            <div key={f.day} style={{ position: 'relative', transform: `rotate(${f.rot}deg)`, background: '#fffdf8', border: '1.5px solid #e0ccb4', borderRadius: 3, padding: '4px 4px 5px', boxShadow: '2px 3px 8px rgba(140,100,60,0.18)', width: 62 }}>
              <div style={{ position: 'absolute', top: -7, left: '50%', transform: 'translateX(-50%)', width: 10, height: 10, borderRadius: '50%', background: '#ef4444', boxShadow: 'inset -1px -2px 3px rgba(0,0,0,0.25), 0 1px 2px rgba(0,0,0,0.2)' }} />
              <div style={{ width: '100%', height: 56, borderRadius: 2, background: f.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{f.emoji}</div>
              <p style={{ margin: '4px 0 0', fontSize: 8, fontWeight: 800, letterSpacing: '0.08em', color: '#7c6a56', textAlign: 'center', fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif' }}>{f.day}</p>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 14, textAlign: 'center', fontSize: 13, color: '#a89888' }}>
          Your flyers, pinned to the right dates — automatically.
        </p>
      </div>
    </div>
  )
}
