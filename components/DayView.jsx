'use client'

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const PIN_COLORS = ['#ef4444', '#3b82f6', '#22c55e']
const ROTATIONS = [-4, 4, -2]
const NUDGE_TOP = [0, 30, 15]

// 100vh * 0.92 = cell height. Subtract: header ~108px, footer ~58px,
// pin+top-pad ~60px, info strip ~65px, border ~10px, buffer ~40px = ~341px
// idx 1 gets +30px extra for its nudge, idx 2 gets +15px
const IMG_SUBTRACT = [341, 371, 356]
const imgHeight = (idx) => `calc(100vh * 0.92 - ${IMG_SUBTRACT[idx]}px)`

const cardWidth = (total) => {
  if (total === 1) return { width: '52%', maxWidth: 290 }
  if (total === 2) return { width: '42%' }
  return { width: '28%' }
}

const PushPin = ({ color }) => (
  <div style={{ position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)', zIndex: 10, pointerEvents: 'none' }}>
    <svg width="26" height="34" viewBox="0 0 26 34" fill="none">
      <circle cx="13" cy="11" r="11" fill={color} />
      <circle cx="9.5" cy="7.5" r="4.5" fill="rgba(255,255,255,0.30)" />
      <line x1="13" y1="21" x2="13" y2="33" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  </div>
)

export default function DayView({ date, events, onClose, onAdd, onDelete }) {
  const dayName = DAYS[date.getDay()]
  const monthName = MONTHS[date.getMonth()]
  const dayNum = date.getDate()
  const year = date.getFullYear()
  const shown = events.slice(0, 3)
  const extra = events.length - 3

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
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'flex-start',
              justifyContent: 'center',
              gap: shown.length === 1 ? 0 : '4%',
              padding: '40px 5% 12px',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}>
              {shown.map((event, idx) => {
                const w = cardWidth(shown.length)
                return (
                  <div
                    key={event.id}
                    style={{
                      ...w,
                      flexShrink: 0,
                      marginTop: NUDGE_TOP[idx],
                      transform: `rotate(${ROTATIONS[idx]}deg)`,
                      transformOrigin: 'top center',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      background: '#fff',
                      border: '3px solid #fff',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
                    }}
                  >
                    <PushPin color={PIN_COLORS[idx]} />

                    {event.image_url ? (
                      <img
                        src={event.image_url}
                        alt={event.title || ''}
                        style={{
                          width: '100%',
                          height: imgHeight(idx),
                          objectFit: 'cover',
                          display: 'block',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '100%',
                        height: imgHeight(idx),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'linear-gradient(135deg,#ede9fe,#ddd6fe)',
                        flexShrink: 0,
                      }}>
                        <p style={{ fontSize: 13, fontWeight: 600, textAlign: 'center', color: '#5b21b6', margin: 8 }}>{event.title}</p>
                      </div>
                    )}

                    {/* Info strip — always visible below image */}
                    <div style={{ flexShrink: 0, padding: '6px 8px 8px', background: '#fff', borderTop: '1px solid #f0ece0' }}>
                      {event.title && (
                        <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 700, color: '#1a1a2e', lineHeight: 1.3 }}>
                          {event.title}
                        </p>
                      )}
                      {event.time_str && (
                        <p style={{ margin: '0 0 2px', fontSize: 10, color: '#6b7280', lineHeight: 1.3 }}>
                          &#128336; {event.time_str}
                        </p>
                      )}
                      {event.location && (
                        <p style={{ margin: 0, fontSize: 10, color: '#6b7280', lineHeight: 1.3 }}>
                          &#128205; {event.location}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => onDelete(event.id)}
                      style={{
                        position: 'absolute', top: 4, right: 4,
                        width: 20, height: 20, borderRadius: '50%',
                        background: 'rgba(239,68,68,0.88)',
                        border: 'none', cursor: 'pointer',
                        color: '#fff', fontSize: 10, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 20, boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                      }}
                    >
                      &#10005;
                    </button>
                  </div>
                )
              })}
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
          <button
            onClick={onClose}
            style={{ padding: '9px 18px', borderRadius: 12, background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
          >
            Close
          </button>
          <button
            onClick={onAdd}
            style={{ padding: '9px 22px', borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, boxShadow: '0 2px 14px rgba(124,58,237,0.38)' }}
          >
            + Scan
          </button>
        </div>
      </div>
    </div>
  )
}
