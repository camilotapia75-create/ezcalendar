'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AuthForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    })
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="text-center py-8 px-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(124,58,237,0.15)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(167,139,250,1)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>
        <p className="font-semibold text-white/80 mb-1">Check your email</p>
        <p className="text-sm text-white/30">Sent a link to <span className="text-white/60">{email}</span></p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
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
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 rounded-2xl text-sm font-semibold disabled:opacity-40 transition-opacity"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
      >
        {loading ? 'Sending…' : 'Continue →'}
      </button>
      <p className="text-center text-xs text-white/15 pt-1">We’ll email you a sign-in link — no password needed</p>
    </form>
  )
}
