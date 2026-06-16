'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SetPasswordPage() {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ready, setReady] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) setReady(true)
      else router.replace('/')
    })
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/calendar')
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
      </div>
    )
  }

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
          <div style={{ fontSize: 54, lineHeight: 1, color: '#1a1a2e', fontWeight: 700, marginBottom: 8 }}>🔑 ezcalendar</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: '0 0 6px' }}>Set your password</h1>
          <p style={{ fontSize: 16, color: '#7c6a56', margin: 0 }}>You'll use this to sign in from now on</p>
        </div>

        <div style={{ position: 'relative', background: '#fffdf8', border: '1.5px solid #e0ccb4', borderRadius: 4, boxShadow: '4px 4px 0 rgba(140,100,60,0.15)', padding: '28px 24px 24px' }}>
          <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', width: 44, height: 20, background: 'rgba(253,224,71,0.75)', borderRadius: 3 }} />

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="New password (min. 6 chars)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required minLength={6} autoFocus
                style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1.5px solid #c8b4a0', outline: 'none', fontSize: 18, color: '#1a1a2e', padding: '8px 32px 8px 2px', fontFamily: 'var(--font-jakarta), 'Plus Jakarta Sans', system-ui, sans-serif' }}
                onFocus={e => e.target.style.borderBottomColor = '#7c3aed'}
                onBlur={e => e.target.style.borderBottomColor = '#c8b4a0'}
              />
              <button type="button" onClick={() => setShowPassword(p => !p)}
                style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#a89888', padding: 2 }}
                tabIndex={-1}
              >
                {showPassword
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>

            {error && <p style={{ fontSize: 15, color: '#b91c1c', margin: 0 }}>{error}</p>}

            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: '11px', background: '#1a1a2e', color: '#fff', border: '2px solid #1a1a2e', borderRadius: 6, boxShadow: loading ? 'none' : '3px 3px 0 #7c3aed', fontSize: 20, fontFamily: 'var(--font-jakarta), 'Plus Jakarta Sans', system-ui, sans-serif', cursor: 'pointer', fontWeight: 700, opacity: loading ? 0.55 : 1 }}>
              {loading ? 'Saving…' : 'Set password → go to calendar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
