'use client'

const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function parseLocalDate(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatDate(str) {
  const d = parseLocalDate(str)
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

export default function EventDetailModal({ event, accent = '#7c3aed', onClose, onDelete, reminderOn, onToggleReminder }) {
  if (!event) return null

  const isMulti = event.end_date && event.end_date !== event.date

  const handleDelete = () => {
    onDelete?.(event.id)
    onClose()
  }

  return (
    <div
      onClick={onClose}
      className="anim-backdrop"
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="anim-modal"
        style={{ width: '100%', maxWidth: 480, maxHeight: '88dvh', display: 'flex', flexDirection: 'column', borderRadius: 20, overflow: 'hidden', background: '#fffaee', border: '2px solid #e9e0cc', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}
      >

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1, WebkitOverflowScrolling: 'touch' }}>
          {/* Flyer image */}
          {event.image_url ? (
            <img src={event.image_url} alt={event.title || ''} style={{ width: '100%', display: 'block', maxHeight: 420, objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: 200, background: `linear-gradient(135deg, ${accent}18, ${accent}38)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: accent, textAlign: 'center', padding: '0 24px', lineHeight: 1.3 }}>{event.title || 'Event'}</span>
            </div>
          )}

          {/* Details */}
          <div style={{ padding: '18px 20px 4px', background: '#fffaee' }}>
            {event.title && (
              <h2 style={{ margin: '0 0 14px', fontSize: 24, fontWeight: 800, color: '#1a1a2e', lineHeight: 1.2, fontFamily: 'var(--font-caveat), Caveat, cursive' }}>
                {event.title}
              </h2>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 17, flexShrink: 0, marginTop: 1 }}>📅</span>
                <div>
                  <p style={{ margin: 0, fontSize: 15, color: '#1a1a2e', fontWeight: 600 }}>{formatDate(event.date)}</p>
                  {isMulti && (
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>through {formatDate(event.end_date)}</p>
                  )}
                </div>
              </div>

              {event.time_str && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 17, flexShrink: 0 }}>🕐</span>
                  <p style={{ margin: 0, fontSize: 15, color: '#374151' }}>{event.time_str}</p>
                </div>
              )}

              {event.location && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 17, flexShrink: 0, marginTop: 1 }}>📍</span>
                  <p style={{ margin: 0, fontSize: 15, color: '#374151', lineHeight: 1.4 }}>{event.location}</p>
                </div>
              )}

              {event.source_url && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 17, flexShrink: 0 }}>🔗</span>
                  <a href={event.source_url} target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ fontSize: 14, color: accent, fontWeight: 700, textDecoration: 'none' }}>
                    View original
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action row */}
        <div style={{ flexShrink: 0, background: '#fffaee', borderTop: '1.5px solid #e9e0cc' }}>
          {onToggleReminder !== undefined && (
            <div style={{ padding: '10px 16px 0' }}>
              <button onClick={onToggleReminder}
                style={{ width: '100%', padding: '10px', background: reminderOn ? 'rgba(234,179,8,0.15)' : 'rgba(0,0,0,0.04)', border: reminderOn ? '1.5px solid rgba(234,179,8,0.5)' : '1.5px solid rgba(0,0,0,0.08)', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', color: reminderOn ? '#92400e' : '#6b7280', fontFamily: 'var(--font-caveat), Caveat, cursive', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {reminderOn ? '🔔 Reminder on' : '🔕 Reminder off'}
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, padding: '10px 16px 14px' }}>
            <button onClick={onClose}
              style={{ flex: 1, padding: '12px', background: 'rgba(0,0,0,0.05)', border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', color: '#374151', fontFamily: 'var(--font-caveat), Caveat, cursive' }}>
              Close
            </button>
            {onDelete && (
              <button onClick={handleDelete}
                style={{ flex: 1, padding: '12px', background: 'rgba(239,68,68,0.07)', border: '1.5px solid rgba(239,68,68,0.25)', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', color: '#dc2626', fontFamily: 'var(--font-caveat), Caveat, cursive' }}>
                Delete event
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
