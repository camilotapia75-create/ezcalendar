'use client'
import { useState, useEffect } from 'react'

export default function ShareModal({ inviteCode, connectedCount, onClose }) {
  const [copied, setCopied] = useState(false)
  const [inviteUrl, setInviteUrl] = useState('')

  useEffect(() => {
    setInviteUrl(`${window.location.origin}/join/${inviteCode}`)
  }, [inviteCode])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
    } catch {
      const el = document.createElement('textarea')
      el.value = inviteUrl
      el.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(el)
      el.focus()
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div
      className="fixed inset-0 z-50"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(360px, calc(100vw - 32px))',
          background: '#fff',
          borderRadius: 20,
          padding: '28px 24px 24px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          border: '1px solid rgba(0,0,0,0.08)',
        }}
      >
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, width: 28, height: 28, borderRadius: '50%', background: '#f3f4f6', border: 'none', cursor: 'pointer', fontSize: 14, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >&#10005;</button>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>&#128101;</div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1a1a2e' }}>Shared Calendar</h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#9ca3af', lineHeight: 1.5 }}>
            {connectedCount === 0
              ? "Invite a friend to share each other's events"
              : `${connectedCount} friend${connectedCount > 1 ? 's' : ''} connected — you both see each other's events`}
          </p>
        </div>

        <div style={{ background: '#f8f7ff', borderRadius: 14, padding: '14px 16px', marginBottom: 16, border: '1.5px solid #e8e4ff' }}>
          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af' }}>Your invite link</p>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: '#4b5563', wordBreak: 'break-all', fontFamily: 'monospace', lineHeight: 1.5 }}>
            {inviteUrl || `…/${inviteCode}`}
          </p>
          <button
            onClick={copyLink}
            style={{
              width: '100%', padding: '11px', borderRadius: 10,
              background: copied ? 'rgba(34,197,94,0.12)' : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
              color: copied ? '#16a34a' : '#fff',
              border: copied ? '1.5px solid rgba(34,197,94,0.3)' : 'none',
              cursor: 'pointer', fontSize: 14, fontWeight: 700,
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {copied ? '✓ Copied!' : '📋 Copy invite link'}
          </button>
        </div>

        <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', textAlign: 'center', lineHeight: 1.6 }}>
          Send this link to a friend. When they open it and sign in, you'll both see each other's pinned events.
        </p>
      </div>
    </div>
  )
}
