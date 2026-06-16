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
      className="fixed inset-0 z-50 anim-backdrop"
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
          background: '#fffdf8',
          borderRadius: 4,
          padding: '32px 24px 24px',
          boxShadow: '5px 5px 0 rgba(124,58,237,0.25), 0 8px 32px rgba(0,0,0,0.18)',
          border: '1.5px solid #e0ccb4',
        }}
      >
        <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', width: 44, height: 20, background: 'rgba(253,224,71,0.75)', borderRadius: 3, boxShadow: '0 1px 4px rgba(0,0,0,0.09)' }} />
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, width: 28, height: 28, borderRadius: '50%', background: '#f3f4f6', border: 'none', cursor: 'pointer', fontSize: 14, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >&#10005;</button>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 38, marginBottom: 8 }}>&#128101;</div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1a1a2e' }}>Shared Calendar</h2>
          <p style={{ margin: '6px 0 0', fontSize: 16, color: '#7c6a56', lineHeight: 1.5 }}>
            {connectedCount === 0
              ? "Invite a friend to share each other's events"
              : `${connectedCount} friend${connectedCount > 1 ? 's' : ''} connected — you both see each other's events`}
          </p>
        </div>

        <div style={{ background: 'rgba(253,224,71,0.12)', borderRadius: 4, padding: '14px 16px', marginBottom: 16, border: '1.5px solid #e0ccb4' }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#a89888' }}>Your invite link</p>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#4b5563', wordBreak: 'break-all', fontFamily: 'monospace', lineHeight: 1.5 }}>
            {inviteUrl || `…/${inviteCode}`}
          </p>
          <button
            onClick={copyLink}
            style={{
              width: '100%', padding: '10px',
              background: copied ? 'rgba(34,197,94,0.10)' : '#1a1a2e',
              color: copied ? '#166534' : '#fff',
              border: copied ? '1.5px solid rgba(34,197,94,0.3)' : '2px solid #1a1a2e',
              borderRadius: 6,
              boxShadow: copied ? 'none' : '3px 3px 0 #7c3aed',
              cursor: 'pointer',
              fontSize: 18,
              fontWeight: 700,
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'var(--font-jakarta), "Plus Jakarta Sans", system-ui, sans-serif',
            }}
          >
            {copied ? '✓ Copied!' : '📋 Copy invite link'}
          </button>
        </div>

        <p style={{ margin: 0, fontSize: 15, color: '#a89888', textAlign: 'center', lineHeight: 1.6 }}>
          Send this link to a friend. When they open it and sign in, you'll both see each other's pinned events.
        </p>
      </div>
    </div>
  )
}
