'use client'
import { useState } from 'react'

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const PIN_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#ec4899']

const PushPin = ({ color }) => (
  <div style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', zIndex: 10, pointerEvents: 'none' }}>
    <svg width="26" height="34" viewBox="0 0 26 34" fill="none">
      <circle cx="13" cy="11" r="11" fill={color} />
      <circle cx="9" cy="7" r="4.5" fill="rgba(255,255,255,0.30)" />
      <line x1="13" y1="21" x2="13" y2="33" stroke="#9ca3af" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  </div>
)

const getFlyerLayout = (idx, total) => {
  if (total === 1) return { left: '10%', right: '10%', top: '8%', bottom: '10%', rotate: -2 }
  if (total === 2) return idx === 0
    ? { left: '3%', right: '44%', top: '6%', bottom: '8%', rotate: -7 }
    : { left: '42%', right: '3%', top: '10%', bottom: '6%', rotate: 6 }
  const three = [
    { left: '0%', right: '52%', top: '4%', bottom: '28%', rotate: -10 },
    { left: '20%', right: '20%', top: '2%', bottom: '14%', rotate: 1 },
    { left: '52%', right: '0%', top: '6%', bottom: '24%', rotate: 9 },
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
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(8px)', padding: '24px 20px' }}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full"
        style={{
          maxWidth: 400,
          maxHeight: 'calc(100vh - 80px)',
          background: '#fffaee',
          border: '4px solid #1a1a1a',
          borderRadius: 4,
          boxShadow: '8px 8px 0 rgba(0,0,0,0.35)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top row */}
        <div className="flex items-start justify-between shrink-0" style={{ padding: '14px 16px 0' }}>
          <div>
            <span className="font-black leading-none" style={{ fontSize: 42, color: '#1a1a1a' }}>{dayNum}</span>
            <p className="text-xs font-semibold uppercase tracking-widest mt-1" style={{ color: '#9ca3af' }}>
              {dayName} &middot; {monthName} {year}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center font-bold mt-1"
            style={{ width: 30, height: 30, borderRadius: '50%', background: '#e5e5e5', color: '#555', fontSize: 13, border: 'none', cursor: 'pointer' }}
          >
            &#10005;
          </button>
        </div>

        {/* Pinboard */}
        <div
          className="relative"
          style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden', margin: '8px 0 0' }}
        >
          {shown.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 pb-10">
              <span style={{ fontSize: 44 }}>&#128204;</span>
              <p className="text-sm font-semibold" style={{ color: '#9ca3af' }}>Nothing pinned yet</p>
              <p className="text-xs" style={{ color: '#d1d5db' }}>Tap Scan to add a flyer</p>
            </div>
          ) : (
            shown.map((event, idx) => {
              const pos = getFlyerLayout(idx, shown.length)
              const pinColor = PIN_COLORS[idx % PIN_COLORS.length]
              return (
                <div
                  key={event.id}
                  className="absolute"
                  style={{
                    left: pos.left, right: pos.right,
                    top: pos.top, bottom: pos.bottom,
                    transform: `rotate(${pos.rotate}deg)`,
                    transformOrigin: 'top center',
                    zIndex: idx + 1,
                  }}
                >
                  <PushPin color={pinColor} />
                  {event.image_url ? (
                    <img
                      src={event.image_url}
                      alt={event.title || ''}
                      className="w-full h-full object-cover"
                      style={{ border: '3px solid #fff', boxShadow: '0 6px 28px rgba(0,0,0,0.30)', display: 'block' }}
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center p-4"
                      style={{ background: 'linear-gradient(135deg,#ede9fe,#ddd6fe)', border: '2px solid #c4b5fd', boxShadow: '0 4px 16px rgba(124,58,237,0.2)' }}
                    >
                      <p className="text-sm font-semibold text-center" style={{ color: '#5b21b6' }}>{event.title}</p>
                    </div>
                  )}
                  <button
                    onClick={() => handleDelete(event.id)}
                    className="absolute flex items-center justify-center font-bold text-white"
                    style={{
                      top: -2, right: -2,
                      width: 20, height: 20,
                      borderRadius: '50%',
                      fontSize: 9,
                      background: confirmId === event.id ? '#dc2626' : 'rgba(0,0,0,0.45)',
                      zIndex: 20,
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                    }}
                  >
                    {confirmId === event.id ? '&#10003;' : '&#10005;'}
                  </button>
                </div>
              )
            })
          )}

          {extra > 0 && (
            <div
              className="absolute flex items-center justify-center font-bold text-xs"
              style={{ bottom: 8, left: '50%', transform: 'translateX(-50%)', background: '#ede9fe', color: '#7c3aed', borderRadius: 999, padding: '3px 12px', zIndex: 20, whiteSpace: 'nowrap' }}
            >
              +{extra} more
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div
          className="shrink-0 flex items-center justify-between"
          style={{ padding: '10px 14px 14px', borderTop: '2px solid #e9e0cc' }}
        >
          <button
            onClick={onClose}
            className="text-sm font-semibold"
            style={{ padding: '8px 16px', borderRadius: 10, background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer' }}
          >
            Close
          </button>
          <button
            onClick={onAdd}
            className="flex items-center gap-2 text-sm font-bold text-white"
            style={{
              padding: '9px 20px',
              borderRadius: 10,
              background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
              boxShadow: '0 2px 12px rgba(124,58,237,0.35)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            + Scan
          </button>
        </div>
      </div>
    </div>
  )
}
