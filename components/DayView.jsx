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

const rots = [-4, 4, -3, 3, -2, 2, -3, 3, -2]

export default function DayView({ date, events, onClose, onAdd, onDelete }) {
  const [notifEvents, setNotifEvents] = useState({})
  const [globalNotifOn, setGlobalNotifOn] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)

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

  // Full-screen detail popup for a tapped event
  if (selectedEvent) {
    return (
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)' }}
        onClick={() => setSelectedEvent(null)}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '5%', left: '5%', right: '5%', bottom: '5%',
            background: '#fffaee',
            border: '4px solid #1a1a1a',
            borderRadius: 8,
            boxShadow: '10px 10px 0 rgba(0,0,0,0.40)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative', background: '#f5f0e8' }}>
            {selectedEvent.image_url ? (
              <img
                src={selectedEvent.image_url}
                alt={selectedEvent.title || ''}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#ede9fe,#ddd6fe)' }}>
                <p style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', color: '#5b21b6', padding: 24 }}>{selectedEvent.title}</p>
              </div>
            )}
            <button
              onClick={() => setSelectedEvent(null)}
              style={{ position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: 'none', cursor: 'pointer', fontSize: 16, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}
            >&#10005;</button>
          </div>

          <div style={{ flexShrink: 0, padding: '16px 20px 20px', borderTop: '2px solid #e9e0cc', background: '#fff' }}>
            {selectedEvent.title && (
              <p style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#1a1a2e', lineHeight: 1.3 }}>{selectedEvent.title}</p>
            )}
            {selectedEvent.time_str && (
              <p style={{ margin: '0 0 4px', fontSize: 14, color: '#6b7280' }}>&#128336; {selectedEvent.time_str}</p>
            )}
            {selectedEvent.location && (
              <p style={{ margin: '0 0 4px', fontSize: 14, color: '#6b7280' }}>&#128205; {selectedEvent.location}</p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
              {selectedEvent.source_url ? (
                <a
                  href={selectedEvent.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{ fontSize: 13, color: '#7c3aed', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  &#128279; View original
                </a>
              ) : <span />}
              <button
                onClick={() => toggleEventNotif(selectedEvent.id)}
                style={{
                  padding: '7px 16px', borderRadius: 20,
                  background: isEventOn(selectedEvent.id) ? 'rgba(234,179,8,0.90)' : 'rgba(200,200,200,0.65)',
                  border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: 6,
                  color: isEventOn(selectedEvent.id) ? '#92400e' : '#6b7280',
                  transition: 'background 0.15s',
                }}
              >
                {isEventOn(selectedEvent.id) ? '🔔 Reminder on' : '🔕 Reminder off'}
              </button>
            </div>
            {!globalNotifOn && (
              <p style={{ margin: '8px 0 0', fontSize: 11, color: '#9ca3af', textAlign: 'right' }}>
                Enable notifications (&#128277; in header) to get reminders
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

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
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          flexShrink: 0, padding: '14px 18px 12px',
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
          >&#10005;</button>
        </div>

        {/* Pinboard - responsive scrollable grid */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {shown.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, padding: 32 }}>
              <span style={{ fontSize: 52 }}>&#128204;</span>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#9ca3af', margin: 0 }}>Nothing pinned yet</p>
              <p style={{ fontSize: 13, color: '#d1d5db', margin: 0 }}>Tap Scan to add a flyer</p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: shown.length === 1
                ? 'minmax(0, min(75%, 380px))'
                : shown.length === 2
                  ? 'repeat(2, minmax(0, 1fr))'
                  : 'repeat(3, minmax(0, 1fr))',
              gap: shown.length === 1 ? 0 : '28px 16px',
              justifyContent: 'center',
              maxWidth: shown.length === 1 ? '100%' : shown.length === 2 ? 560 : 860,
              margin: '0 auto',
              width: '100%',
              padding: shown.length === 1 ? '48px 24px 24px' : '44px 20px 24px',
              boxSizing: 'border-box',
            }}>
              {shown.map((event, idx) => (
                <div
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  style={{
                    position: 'relative',
                    display: 'flex', flexDirection: 'column',
                    background: '#fff',
                    border: '3px solid #fff',
                    boxShadow: '0 6px 24px rgba(0,0,0,0.22)',
                    transform: `rotate(${shown.length === 1 ? rots[idx] : rots[idx] * 0.4}deg)`,
                    transformOrigin: 'top center',
                    cursor: 'pointer',
                    userSelect: 'none',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <PushPin color={PIN_COLORS[idx % PIN_COLORS.length]} />

                  {event.image_url ? (
                    <img
                      src={event.image_url}
                      alt={event.title || ''}
                      style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <div style={{ width: '100%', aspectRatio: '3/4', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#ede9fe,#ddd6fe)' }}>
                      <p style={{ fontSize: 11, fontWeight: 600, textAlign: 'center', color: '#5b21b6', margin: 6, padding: '0 4px' }}>{event.title}</p>
                    </div>
                  )}

                  <div style={{ flexShrink: 0, padding: '5px 7px 7px', background: '#fff', borderTop: '1px solid #f0ece0' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {event.title && (
                          <p style={{ margin: '0 0 2px', fontSize: 9, fontWeight: 700, color: '#1a1a2e', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {event.title}
                          </p>
                        )}
                        {event.time_str && (
                          <p style={{ margin: 0, fontSize: 9, color: '#6b7280', lineHeight: 1.3 }}>&#9200; {event.time_str}</p>
                        )}
                      </div>
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
                    </div>
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(event.id) }}
                    style={{
                      position: 'absolute', top: 4, right: 4,
                      width: 18, height: 18, borderRadius: '50%',
                      background: 'rgba(239,68,68,0.88)',
                      border: 'none', cursor: 'pointer',
                      color: '#fff', fontSize: 9, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      zIndex: 20, boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                    }}
                  >&#10005;</button>
                </div>
              ))}
            </div>
          )}

          {extra > 0 && (
            <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
              <span style={{ background: '#ede9fe', color: '#7c3aed', borderRadius: 999, padding: '4px 14px', fontSize: 12, fontWeight: 700 }}>
                +{extra} more
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px 14px', borderTop: '2px solid #e9e0cc',
        }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 12, background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Close</button>
          <button onClick={onAdd} style={{ padding: '9px 22px', borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, boxShadow: '0 2px 14px rgba(124,58,237,0.38)' }}>+ Scan</button>
        </div>
      </div>
    </div>
  )
}
