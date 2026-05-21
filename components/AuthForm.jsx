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
      <div className="text-center rounded-2xl p-8" style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="text-3xl mb-3">&#128140;</div>
        <p className="font-semibold mb-1">Check your email</p>
        <p className="text-sm text-zinc-500">Magic link sent to <span className="text-white">{email}</span></p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5">
      <input
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoFocus
        className="w-full rounded-xl px-4 py-3 text-sm placeholder-zinc-600 focus:outline-none transition-colors"
        style={{ background: '#111113', border: '1px solid #2a2a2a', color: '#f0f0f0' }}
        onFocus={e => e.target.style.borderColor = '#7c3aed'}
        onBlur={e => e.target.style.borderColor = '#2a2a2a'}
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-40 transition-opacity"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
      >
        {loading ? 'Sending…' : 'Continue with email →'}
      </button>
      <p className="text-center text-[11px] text-zinc-700 pt-1">No password — we’ll email you a link</p>
    </form>
  )
}
