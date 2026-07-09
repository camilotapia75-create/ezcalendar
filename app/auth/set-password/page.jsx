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
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0b' }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#c6f24e', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'radial-gradient(120% 55% at 50% -5%, #14170e 0%, #0a0a0b 55%)' }}
    >
      <div className="w-full max-w-xs">
        <div className="text-center mb-8">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: '#fff', fontWeight: 700, marginBottom: 12, letterSpacing: '-0.02em' }}>🔑 ezcalendar</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.02em' }}>Set your password</h1>
          <p style={{ fontSize: 16, color: 'var(--text-2)', margin: 0 }}>You'll use this to sign in from now on</p>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '24px 20px' }}>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="New password (min. 6 chars)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required minLength={6} autoFocus
                style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border-2)', borderRadius: 14, outline: 'none', fontSize: 16, color: '#fff', padding: '14px 44px 14px 16px', fontFamily: 'var(--font-body)' }}
                onFocus={e => e.target.style.borderColor = '#c6f24e'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.16)'}
              />
              <button type="button" onClick={() => setShowPassword(p => !p)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 2 }}
                tabIndex={-1}
              >
                {showPassword
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>

            {error && <p className="mono-label" style={{ fontSize: 11, color: '#fca5a5', margin: 0, letterSpacing: '0.06em' }}>{error}</p>}

            <button type="submit" disabled={loading} className="btn-lime"
              style={{ width: '100%', padding: '15px', fontSize: 16, opacity: loading ? 0.55 : 1 }}>
              {loading ? 'Saving…' : 'Set password → go to calendar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
