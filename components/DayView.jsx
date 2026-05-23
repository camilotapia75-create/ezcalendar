'use client'
import { useState, useEffect } from 'react'

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const PIN_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6']

const PushPin = ({ color }) => (
  <div style={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', zIndex: 10, pointerEvents: 'none' }}>
    <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
      <circle cx="12" cy="10" r="10" fill={color} />
      <circle cx="8.5" cy="6.5" r="4" fill="rgba(255,255,255,0.30)" />
      <line x1="12" y1="19" x2="12" y2="31" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  </div>
)

const getGrid = (count) => {
  if (count <= 3) return { cols: count, rows: 1 }
  if (count === 4) return { cols: 2, rows: 2 }
  if (count <= 6) return { cols: 3, rows: 2 }
  return { cols: 3, rows: 3 }
}

const rots = [-4, 4, -3, 3, -2, 2, -3, 3, -2]

export default function DayView({ date, events, onClose, onAdd, onDelete }) {
  const [notifEvents, setNotifEvents] = useState({})
  const [globalNotifOn, setGlobalNotifOn] = useState(false)

  useEffect(() => {
    try {
      setNotifEvents(JSON.parse(localStorage.getItem('eventNotifs') || '{}'))
      setGlobalNotifOn(localStorage.getItem('notificationsEnabled') === 'true')
    } catch {}
  }, [])

  const toggleEventNotif = (id) => {
    setNotifEvents(prev => {
      const next = { ...prev }
      if (prev[id] === false) {
        delete next[id]
      } else {
        next[id] = false
      }
      localStorage.setItem('eventNotifs', JSON.stringify(next))
      return next
    })
  }

  const isEventOn = (id) => notifEvents[id] !== false

  const dayName = DAYS[date.getDay()]
  const monthName = MONTHS[date.getMonth()]
  const dayNum = date.getDate()
  const year = date.getFullYear()
  const MAX = 9
  const shown = events.slice(0, MAX)
  const extra = events.length - MAX
  const { cols, rows } = getGrid(shown.length)

  const imgVh = rows === 1 ? 36 : rows === 2 ? 18 : 11
  const cardVw = (imgVh * 0.82).toFixed(1)
  const rotScale = rows > 1 ? 0.4 : 1

  return (
    <div
      className="fixed inset-0 z-50"
      style={{ background: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: '4%', left: '4%', right: '4%', bottom: '4%',
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
        <div style={{
          flexShrink: 0,
          padding: '14px 18px 12px',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          borderBottom: '2px solid #e9e0cc',
        }}>
          <div>
            <div style={{ fontSize: 52, fontWeight: 900, lineHeight: 1, color: '#1a1a1a', letterSpacing: '-2px' }}>{dayNum}</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#9ca3af', marginTop: 3 }}>
              {dayName} &middot; {monthName} {year}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ marginTop: 2, width: 32, height: 32, borderRadius: '50%', background: '#e5e5e5', border: 'none', cursor: 'pointer', fontSize: 14, color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}
          >
            &#10005;
          </button>
        </div>

        {/* Pinboard */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
          {shown.length === 0 ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <span style={{ fontSize: 52 }}>&#128204;</span>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#9ca3af', margin: 0 }}>Nothing pinned yet</p>
              <p style={{ fontSize: 13, color: '#d1d5db', margin: 0 }}>Tap Scan to add a flyer</p>
            </div>
          ) : (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, ${cardVw}vh)`,
              gridAutoRows: 'max-content',
              gap: rows > 1 ? '14px 14px' : '0 4%',
              justifyContent: 'center',
              alignContent: 'center',
              padding: '36px 5% 14px',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}>
              {shown.map((event, idx) => (
                <div
                  key={event.id}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#fff',
                    border: '3px solid #fff',
                    boxShadow: '0 6px 24px rgba(0,0,0,0.22)',
                    transform: `rotate(${rots[idx] * rotScale}deg)`,
                    transformOrigin: 'top center',
                    marginTop: rows === 1 && idx === 1 ? 20 : rows === 1 && idx === 2 ? 10 : 0,
                  }}
                >
                  <PushPin color={PIN_COLORS[idx % PIN_COLORS.length]} />

                  {event.image_url ? (
                    <img
                      src={event.image_url}
                      alt={event.title || ''}
                      style={{ width: '100%', height: `${imgVh}vh`, objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: `${imgVh}vh`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#ede9fe,#ddd6fe)' }}>
                      <p style={{ fontSize: 11, fontWeight: 600, textAlign: 'center', color: '#5b21b6', margin: 6 }}>{event.title}</p>
                    </div>
                  )}

                  {/* Info strip */}
                  <div style={{ flexShrink: 0, padding: '5px 7px 7px', background: '#fff', borderTop: '1px solid #f0ece0' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {event.title && <p style={{ margin: '0 0 2px', fontSize: 9, fontWeight: 700, color: '#1a1a2e', lineHeight: 1.3 }}>{event.title}</p>}
                        {event.time_str && <p style={{ margin: '0 0 2px', fontSize: 9, color: '#6b7280', lineHeight: 1.3 }}>&#128336; {event.time_str}</p>}
                        {event.location && <p style={{ margin: 0, fontSize: 9, color: '#6b7280', lineHeight: 1.3 }}>&#128205; {event.location}</p>}
                      </div>
                      {globalNotifOn && (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleEventNotif(event.id) }}
                          title={isEventOn(event.id) ? 'Mute reminder' : 'Enable reminder'}
                          style={{
                            flexShrink: 0, width: 18, height: 18, borderRadius: '50%', marginTop: 1,
                            background: isEventOn(event.id) ? 'rgba(234,179,8,0.90)' : 'rgba(200,200,200,0.65)',
                            border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 9, transition: 'background 0.15s',
                          }}
                        >
                          {isEventOn(event.id) ? '🔔' : '🔕'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={() => onDelete(event.id)}
                    style={{
                      position: 'absolute', top: 4, right: 4,
                      width: 18, height: 18, borderRadius: '50%',
                      background: 'rgba(239,68,68,0.88)',
                      border: 'none', cursor: 'pointer',
                      color: '#fff', fontSize: 9, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      zIndex: 20, boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                    }}
                  >
                    &#10005;
                  </button>
                </div>
              ))}
            </div>
          )}

          {extra > 0 && (
            <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', background: '#ede9fe', color: '#7c3aed', borderRadius: 999, padding: '4px 14px', fontSize: 12, fontWeight: 700, zIndex: 20, whiteSpace: 'nowrap' }}>
              +{extra} more
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 14px', borderTop: '2px solid #e9e0cc' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 12, background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Close</button>
          <button onClick={onAdd} style={{ padding: '9px 22px', borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, boxShadow: '0 2px 14px rgba(124,58,237,0.38)' }}>+ Scan</button>
        </div>
      </div>
    </div>
  )
}
