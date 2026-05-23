'use client'
import { useState } from 'react'

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const PIN_COLORS = ['#ef4444', '#3b82f6', '#22c55e']

const PushPin = ({ color }) => (
  <div style={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', zIndex: 10, pointerEvents: 'none' }}>
    <svg width="28" height="38" viewBox="0 0 28 38" fill="none">
      <circle cx="14" cy="12" r="12" fill={color} />
      <circle cx="10" cy="8" r="5" fill="rgba(255,255,255,0.30)" />
      <line x1="14" y1="23" x2="14" y2="37" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round" />
    </svg>
  </div>
)

const getFlyerLayout = (idx, total) => {
  if (total === 1) return { left: '8%', right: '8%', top: '5%', bottom: '5%', rotate: -2 }
  if (total === 2) return idx === 0
    ? { left: '2%', right: '46%', top: '4%', bottom: '6%', rotate: -7 }
    : { left: '44%', right: '2%', top: '8%', bottom: '4%', rotate: 6 }
  const three = [
    { left: '-2%', right: '54%', top: '3%', bottom: '26%', rotate: -11 },
    { left: '18%', right: '18%', top: '1%', bottom: '12%', rotate: 1 },
    { left: '54%', right: '-2%', top: '5%', bottom: '22%', rotate: 10 },
  ]
  return three[idx] ?? three[2]
}

export default function DayView({ date, events, onClose, onAdd, onDelete }) {
  const [confirmId, setConfirmId] = useState(null)
  const dayName = DAYS[date.getDay()]
  const monthName = MONTHS[date.getMonth()]
  const dayNum = date.getDate()
  const year = date.getFullYear()
  const shown = events.slice(0, 3)
  const extra = events.length - 3

  const handleDelete = (id) => {
    if (confirmId === id) {
      onDelete(id)
      setConfirmId(null)
    } else {
      setConfirmId(id)
      setTimeout(() => setConfirmId(null), 2500)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50"
      style={{ background: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      {/* Giant cell — positioned to fill most of the screen */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: '4%',
          left: '4%',
          right: '4%',
          bottom: '4%',
          background: '#fffaee',
          border: '5px solid #1a1a1a',
          borderRadius: 6,
          boxShadow: '10px 10px 0 rgba(0,0,0,0.40)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ flexShrink: 0, padding: '18px 20px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '2px solid #e9e0cc' }}>
          <div>
            <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1, color: '#1a1a1a', letterSpacing: '-2px' }}>{dayNum}</div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9ca3af', marginTop: 4 }}>
              {dayName} &middot; {monthName} {year}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ marginTop: 4, width: 34, height: 34, borderRadius: '50%', background: '#e5e5e5', border: 'none', cursor: 'pointer', fontSize: 14, color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}
          >
            &#10005;
          </button>
        </div>

        {/* Pinboard — takes all remaining height */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {shown.length === 0 ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <span style={{ fontSize: 56 }}>&#128204;</span>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#9ca3af', margin: 0 }}>Nothing pinned yet</p>
              <p style={{ fontSize: 13, color: '#d1d5db', margin: 0 }}>Tap Scan to add a flyer</p>
            </div>
          ) : (
            shown.map((event, idx) => {
              const pos = getFlyerLayout(idx, shown.length)
              return (
                <div
                  key={event.id}
                  style={{
                    position: 'absolute',
                    left: pos.left,
                    right: pos.right,
                    top: pos.top,
                    bottom: pos.bottom,
                    transform: `rotate(${pos.rotate}deg)`,
                    transformOrigin: 'top center',
                    zIndex: idx + 1,
                  }}
                >
                  <PushPin color={PIN_COLORS[idx]} />
                  {event.image_url ? (
                    <img
                      src={event.image_url}
                      alt={event.title || ''}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', border: '4px solid #fff', boxShadow: '0 8px 32px rgba(0,0,0,0.32)', display: 'block' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'linear-gradient(135deg,#ede9fe,#ddd6fe)', border: '3px solid #c4b5fd', boxShadow: '0 6px 20px rgba(124,58,237,0.2)' }}>
                      <p style={{ fontSize: 14, fontWeight: 600, textAlign: 'center', color: '#5b21b6', margin: 0 }}>{event.title}</p>
                    </div>
                  )}
                  <button
                    onClick={() => handleDelete(event.id)}
                    style={{
                      position: 'absolute', top: -2, right: -2,
                      width: 24, height: 24, borderRadius: '50%',
                      background: confirmId === event.id ? '#dc2626' : 'rgba(0,0,0,0.50)',
                      border: 'none', cursor: 'pointer',
                      color: '#fff', fontSize: 10, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      zIndex: 20, boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                    }}
                  >
                    {confirmId === event.id ? '✓' : '✕'}
                  </button>
                </div>
              )
            })
          )}
          {extra > 0 && (
            <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', background: '#ede9fe', color: '#7c3aed', borderRadius: 999, padding: '4px 14px', fontSize: 12, fontWeight: 700, zIndex: 20, whiteSpace: 'nowrap' }}>
              +{extra} more
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px 16px', borderTop: '2px solid #e9e0cc' }}>
          <button
            onClick={onClose}
            style={{ padding: '10px 20px', borderRadius: 12, background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
          >
            Close
          </button>
          <button
            onClick={onAdd}
            style={{ padding: '10px 24px', borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, boxShadow: '0 2px 14px rgba(124,58,237,0.38)' }}
          >
            + Scan
          </button>
        </div>
      </div>
    </div>
  )
}
