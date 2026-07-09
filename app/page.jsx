import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuthForm from '@/components/AuthForm'

// Fanned poster thumbnails pinned at the top of the hero
const POSTERS = [
  { tag: 'STREET MARKET', title: 'TACO\nSUN-\nDAY', sub: 'SMORGASBURG', foot: 'SUN 14 · 12PM',
    bg: 'linear-gradient(150deg,#f0913a,#e8dcc8)', ink: '#1a1206', rot: -13, x: -104, y: 16, z: 1 },
  { tag: 'ART WALK', title: 'OPEN\nSTUD-\nIOS', sub: 'Bushwick Editions', foot: '6:00 PM',
    bg: '#efeae0', ink: '#1a1a1a', rot: -1, x: 0, y: 0, z: 3, dot: true },
  { tag: 'LIVE', title: 'NIGHT\nFORM', sub: '', foot: '9PM',
    bg: 'linear-gradient(160deg,#0e0e0e,#161608)', ink: '#c6f24e', rot: 12, x: 104, y: 18, z: 2 },
]

function Poster({ p }) {
  return (
    <div style={{
      position: 'absolute', left: '50%', top: 0,
      transform: `translateX(-50%) translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg)`,
      width: 132, height: 176, borderRadius: 12, background: p.bg, zIndex: p.z,
      boxShadow: '0 18px 40px rgba(0,0,0,0.55)', padding: '12px 12px 10px',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* pushpin */}
      <div style={{ position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)', width: 16, height: 16, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #e8ff7a, #a7d43a)', boxShadow: '0 3px 6px rgba(0,0,0,0.5)' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 6.5, letterSpacing: '0.1em', color: p.ink, opacity: 0.85, fontFamily: 'var(--font-mono-stack)' }}>
        <span>{p.tag}</span><span>18+</span>
      </div>
      {p.dot && <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#e8532e', margin: '10px 0 6px' }} />}
      <div style={{ marginTop: p.dot ? 0 : 'auto', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, lineHeight: 0.92, color: p.ink, whiteSpace: 'pre-line', letterSpacing: '-0.02em' }}>
        {p.title}
      </div>
      <div style={{ marginTop: 'auto', fontSize: 6.5, letterSpacing: '0.06em', color: p.ink, opacity: 0.8, fontFamily: 'var(--font-mono-stack)' }}>
        {p.sub && <div>{p.sub}</div>}
        <div style={{ marginTop: 2 }}>{p.foot}</div>
      </div>
    </div>
  )
}

function Botly({ size = 92 }) {
  return (
    <svg className="botly" width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ filter: 'drop-shadow(0 0 22px rgba(198,242,78,0.55))' }}>
      {/* antenna */}
      <line x1="50" y1="16" x2="50" y2="26" stroke="#8fbf2e" strokeWidth="3" />
      <circle cx="50" cy="13" r="5" fill="#c6f24e" />
      {/* head */}
      <rect x="24" y="26" width="52" height="44" rx="14" fill="url(#botHead)" />
      {/* eyes — grouped so they blink together */}
      <g className="botly-eyes">
        <circle cx="40" cy="46" r="9" fill="#fff" />
        <circle cx="60" cy="46" r="9" fill="#fff" />
        <circle cx="41" cy="47" r="4" fill="#101010" />
        <circle cx="61" cy="47" r="4" fill="#101010" />
      </g>
      {/* smile */}
      <path d="M42 58 Q50 64 58 58" stroke="#2a3d0a" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* body */}
      <rect x="36" y="72" width="28" height="16" rx="7" fill="#9fd13a" />
      <rect x="30" y="74" width="7" height="12" rx="3.5" fill="#8fbf2e" />
      <rect x="63" y="74" width="7" height="12" rx="3.5" fill="#8fbf2e" />
      <defs>
        <linearGradient id="botHead" x1="24" y1="26" x2="76" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#cdf25a" /><stop offset="1" stopColor="#8fbf2e" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export default async function Home({ searchParams }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const next = searchParams?.next
  if (user) redirect(next || '/calendar')

  const authError = searchParams?.error === 'auth'
  const isInvite = next?.startsWith('/join/')

  return (
    <div style={{ minHeight: '100dvh', background: 'radial-gradient(120% 60% at 50% 0%, #131610 0%, #0a0a0b 55%)', display: 'flex', flexDirection: 'column', padding: '0 24px 40px', maxWidth: 440, margin: '0 auto' }}>
      {/* Hero: fanned posters + mascot.
          Top margin clears the status bar / notch so the pushpins aren't cut off.
          Extra hero height drops the robot clear of the fanned posters. */}
      <div style={{ position: 'relative', height: 306, marginTop: 'calc(env(safe-area-inset-top) + 44px)' }}>
        <div style={{ position: 'relative', height: 190 }}>
          {POSTERS.map(p => <Poster key={p.title} p={p} />)}
        </div>
        <div style={{ position: 'absolute', right: 8, bottom: 0 }}><Botly /></div>
      </div>

      {/* Wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 4 }}>
        <span style={{ fontSize: 20 }}>📌</span>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, color: '#fff', letterSpacing: '-0.02em' }}>ezcalendar</span>
      </div>

      {/* Headline */}
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 52, lineHeight: 1.0, letterSpacing: '-0.03em', margin: '18px 0 0', color: '#fff' }}>
        Shoot.<br />Pin.<br /><span style={{ color: 'var(--lime)' }}>Done.</span>
      </h1>

      {/* Tagline */}
      <p style={{ fontSize: 17, lineHeight: 1.5, color: 'var(--text-2)', margin: '18px 0 0', maxWidth: 380 }}>
        {isInvite
          ? <>A friend invited you to share their calendar. <span style={{ color: '#fff', fontWeight: 700 }}>Create a free account to see their events.</span></>
          : <>Just take a picture of any poster — the app reads the date, time and place and adds it to your calendar. <span style={{ color: '#fff', fontWeight: 700 }}>Cause typing is sooooo early 2000's.</span></>}
      </p>

      {authError && (
        <div className="mono-label" style={{ marginTop: 20, padding: '12px 14px', background: 'rgba(239,68,68,0.10)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.28)', borderRadius: 12, fontSize: 11, letterSpacing: '0.08em' }}>
          Link expired or already used — request a new one below.
        </div>
      )}

      <div style={{ marginTop: 26 }}>
        <AuthForm next={next} isInvite={isInvite} />
      </div>
    </div>
  )
}
