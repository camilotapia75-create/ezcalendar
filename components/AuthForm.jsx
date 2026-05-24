'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthForm() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      // After signup, sign in immediately
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) { setError(signInError.message); setLoading(false); return }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
    }

    router.push('/calendar')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex rounded-2xl p-1" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <button type="button" onClick={() => { setMode('signin'); setError(null) }}
          className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
          style={mode === 'signin'
            ? { background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: 'white' }
            : { color: 'rgba(255,255,255,0.35)' }}
        >Sign in</button>
        <button type="button" onClick={() => { setMode('signup'); setError(null) }}
          className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
          style={mode === 'signup'
            ? { background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: 'white' }
            : { color: 'rgba(255,255,255,0.35)' }}
        >Create account</button>
      </div>

      <input
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        autoFocus
        className="w-full rounded-2xl px-4 py-3.5 text-sm placeholder-white/20 focus:outline-none transition-all"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0f0f0' }}
        onFocus={e => e.target.style.borderColor = 'rgba(124,58,237,0.5)'}
        onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
      />

      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full rounded-2xl px-4 py-3.5 pr-12 text-sm placeholder-white/20 focus:outline-none transition-all"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0f0f0' }}
          onFocus={e => e.target.style.borderColor = 'rgba(124,58,237,0.5)'}
          onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
        />
        <button
          type="button"
          onClick={() => setShowPassword(p => !p)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
          tabIndex={-1}
        >
          {showPassword
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          }
        </button>
      </div>

      {error && (
        <p className="text-xs px-1" style={{ color: 'rgba(248,113,113,0.9)' }}>
          {error === 'Invalid login credentials' ? 'Wrong email or password.' : error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
      >
        {loading ? (mode === 'signup' ? 'Creating account…' : 'Signing in…') : (mode === 'signup' ? 'Create account' : 'Sign in')}
      </button>

      {mode === 'signup' && (
        <p className="text-center text-xs text-white/15 pt-1">Min. 6 characters for password</p>
      )}
    </form>
  )
}
