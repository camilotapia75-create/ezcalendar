'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const INPUT_STYLE = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  borderBottom: '1.5px solid #c8b4a0',
  outline: 'none',
  fontSize: 15,
  color: '#1a1a2e',
  padding: '9px 2px',
  fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
}

const BTN_STYLE = {
  width: '100%',
  padding: '11px',
  background: '#1a1a2e',
  color: '#fff',
  border: '2px solid #1a1a2e',
  borderRadius: 6,
  boxShadow: '3px 3px 0 #7c3aed',
  fontSize: 20,
  fontFamily: 'var(--font-caveat), Caveat, cursive',
  cursor: 'pointer',
  fontWeight: 700,
  transition: 'opacity 0.15s',
}

export default function AuthForm({ next, isInvite }) {
  const [mode, setMode] = useState(isInvite ? 'signup' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [gLoading, setGLoading] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const router = useRouter()
  const supabase = createClient()

  const switchMode = (m) => { setMode(m); setError(null); setInfo(null) }
  const dest = next || '/calendar'

  const handleGoogle = async () => {
    setError(null)
    setGLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(dest)}` },
    })
    if (error) { setError(error.message); setGLoading(false) }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setInfo(null)

    if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}/auth/callback?next=/auth/set-password`,
      })
      setLoading(false)
      if (error) { setError(error.message); return }
      setInfo('Check your email — click the link to set your password.')
      return
    }

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      setLoading(false)
      if (error) {
        setError(error.message === 'User already registered'
          ? 'An account with this email already exists. Sign in instead.'
          : error.message)
        return
      }
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signInErr) {
        if (signInErr.message.toLowerCase().includes('confirm')) {
          setInfo('Account created! Check your email to confirm it, then sign in.')
        } else {
          setError(signInErr.message)
        }
        return
      }
      router.push(dest)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'Wrong email or password.'
          : error.message
      )
      return
    }
    router.push(dest)
  }

  if (mode === 'reset') {
    return (
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <p style={{ fontSize: 16, color: '#7c6a56', textAlign: 'center', margin: 0 }}>
          Enter your email — we'll send a link to set your password.
        </p>
        <input
          type="email" placeholder="your@email.com" value={email}
          onChange={e => setEmail(e.target.value)} required autoFocus
          style={INPUT_STYLE}
          onFocus={e => e.target.style.borderBottomColor = '#7c3aed'}
          onBlur={e => e.target.style.borderBottomColor = '#c8b4a0'}
        />
        {error && <p style={{ fontSize: 15, color: '#b91c1c', margin: 0 }}>{error}</p>}
        {info && <p style={{ fontSize: 15, color: '#166534', margin: 0 }}>{info}</p>}
        <button type="submit" disabled={loading} style={{ ...BTN_STYLE, opacity: loading ? 0.55 : 1 }}>
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
        <button type="button" onClick={() => switchMode('signin')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#a89888', fontFamily: 'var(--font-caveat), Caveat, cursive' }}
        >
          ← Back to sign in
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <button type="button" onClick={handleGoogle} disabled={gLoading}
        style={{ width: '100%', padding: '10px', background: '#fff', color: '#1a1a2e', border: '1.5px solid #e0ccb4', borderRadius: 6, boxShadow: '2px 2px 0 rgba(140,100,60,0.15)', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: gLoading ? 0.55 : 1 }}>
        <svg width="18" height="18" viewBox="0 0 48 48">
          <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
          <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/>
        </svg>
        {gLoading ? 'Redirecting…' : 'Continue with Google'}
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 1, background: '#e0ccb4' }} />
        <span style={{ fontSize: 12, color: '#a89888', fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif' }}>or</span>
        <div style={{ flex: 1, height: 1, background: '#e0ccb4' }} />
      </div>

      <div style={{ display: 'flex', borderBottom: '1.5px solid #e0ccb4' }}>
        {['signin', 'signup'].map(m => (
          <button key={m} type="button" onClick={() => switchMode(m)}
            style={{
              flex: 1,
              paddingBottom: 10,
              background: 'none',
              border: 'none',
              borderBottom: mode === m ? '2.5px solid #1a1a2e' : '2.5px solid transparent',
              marginBottom: -1.5,
              cursor: 'pointer',
              fontSize: 18,
              color: mode === m ? '#1a1a2e' : '#a89888',
              fontFamily: 'var(--font-caveat), Caveat, cursive',
              fontWeight: mode === m ? 700 : 400,
            }}
          >
            {m === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>

      <input
        type="email" placeholder="your@email.com" value={email}
        onChange={e => setEmail(e.target.value)} required autoFocus
        style={INPUT_STYLE}
        onFocus={e => e.target.style.borderBottomColor = '#7c3aed'}
        onBlur={e => e.target.style.borderBottomColor = '#c8b4a0'}
      />

      <div style={{ position: 'relative' }}>
        <input
          type={showPassword ? 'text' : 'password'} placeholder="Password"
          value={password} onChange={e => setPassword(e.target.value)}
          required minLength={6}
          style={{ ...INPUT_STYLE, paddingRight: 32 }}
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
      {info && <p style={{ fontSize: 15, color: '#166534', margin: 0 }}>{info}</p>}

      <button type="submit" disabled={loading} style={{ ...BTN_STYLE, opacity: loading ? 0.55 : 1 }}>
        {loading
          ? (mode === 'signup' ? 'Creating account…' : 'Signing in…')
          : (mode === 'signup' ? 'Create account' : 'Sign in')}
      </button>

      {mode === 'signin' && (
        <button type="button" onClick={() => switchMode('reset')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#a89888', fontFamily: 'var(--font-caveat), Caveat, cursive' }}
        >
          Forgot password?
        </button>
      )}
      {mode === 'signup' && (
        <p style={{ textAlign: 'center', fontSize: 14, color: '#c8b4a0', margin: 0 }}>Min. 6 characters</p>
      )}
    </form>
  )
}
