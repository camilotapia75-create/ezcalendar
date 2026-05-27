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
  fontSize: 18,
  color: '#1a1a2e',
  padding: '8px 2px',
  fontFamily: 'var(--font-caveat), Caveat, cursive',
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
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const router = useRouter()
  const supabase = createClient()

  const switchMode = (m) => { setMode(m); setError(null); setInfo(null) }
  const dest = next || '/calendar'

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
