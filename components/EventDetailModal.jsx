'use client'

const DAYS  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function parseLocalDate(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatDate(str) {
  const d = parseLocalDate(str)
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

export default function EventDetailModal({ event, accent, onClose, onDelete }) {
  if (!event) return null

  const isMulti = event.end_date && event.end_date !== event.date

  const handleDelete = () => {
    onDelete(event.id)
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 560, maxHeight: '92dvh', display: 'flex', flexDirection: 'column', borderRadius: '20px 20px 0 0', overflow: 'hidden', background: '#fff' }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4, flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.12)' }} />
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1, WebkitOverflowScrolling: 'touch' }}>
          {/* Flyer image */}
          {event.image_url ? (
            <img src={event.image_url} alt={event.title || ''} style={{ width: '100%', display: 'block', maxHeight: 480, objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: 220, background: `linear-gradient(135deg, ${accent}18, ${accent}38)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 26, fontWeight: 700, color: accent, textAlign: 'center', padding: '0 24px', lineHeight: 1.3 }}>{event.title || 'Event'}</span>
            </div>
          )}

          {/* Details */}
          <div style={{ padding: '20px 20px 8px' }}>
            {event.title && (
              <h2 style={{ margin: '0 0 16px', fontSize: 26, fontWeight: 700, color: '#111', lineHeight: 1.2 }}>
                {event.title}
              </h2>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>📅</span>
                <div>
                  <p style={{ margin: 0, fontSize: 15, color: '#111', fontWeight: 600 }}>{formatDate(event.date)}</p>
                  {isMulti && (
                    <p style={{ margin: '2px 0 0', fontSize: 14, color: '#6b7280' }}>through {formatDate(event.end_date)}</p>
                  )}
                </div>
              </div>

              {event.time_str && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>🕐</span>
                  <p style={{ margin: 0, fontSize: 15, color: '#374151' }}>{event.time_str}</p>
                </div>
              )}

              {event.location && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>📍</span>
                  <p style={{ margin: 0, fontSize: 15, color: '#374151', lineHeight: 1.4 }}>{event.location}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action row */}
        <div style={{ flexShrink: 0, display: 'flex', gap: 10, padding: '12px 16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))', borderTop: '1px solid rgba(0,0,0,0.07)' }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '12px', background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', color: '#374151', fontFamily: 'var(--font-caveat), Caveat, cursive' }}>
            Close
          </button>
          <button onClick={handleDelete}
            style={{ flex: 1, padding: '12px', background: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.25)', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', color: '#dc2626', fontFamily: 'var(--font-caveat), Caveat, cursive' }}>
            Delete event
          </button>
        </div>
      </div>
    </div>
  )
}
