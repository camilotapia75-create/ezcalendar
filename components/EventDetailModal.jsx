'use client'

// Shared "no flyer" fill — a lime gradient that fades into the surface. Used
// everywhere an event lacks an image so the look is identical across the app.
const NO_FLYER_BG = 'linear-gradient(150deg, rgba(198,242,78,0.55) 0%, rgba(198,242,78,0.28) 48%, rgba(198,242,78,0.10) 100%), var(--surface-2)'

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

// Icon rows use a small monospace uppercase label above the value
function MetaRow({ icon, label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <span style={{ fontSize: 17, flexShrink: 0, marginTop: 2, opacity: 0.9 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div className="mono-label" style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.12em', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 16, color: 'var(--text)', fontWeight: 600, lineHeight: 1.35 }}>{children}</div>
      </div>
    </div>
  )
}

export default function EventDetailModal({ event, accent = '#c6f24e', onClose, onDelete, reminderOn, onToggleReminder }) {
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
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'var(--overlay)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="anim-modal"
        style={{ width: '100%', maxWidth: 460, maxHeight: '90dvh', display: 'flex', flexDirection: 'column', borderRadius: 24, overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
      >

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1, WebkitOverflowScrolling: 'touch' }}>
          {/* Hero — flyer image, or striped gradient with the title */}
          <div style={{ position: 'relative' }}>
            {event.image_url ? (
              <img src={event.image_url} alt={event.title || ''} style={{ width: '100%', display: 'block', maxHeight: 440, objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: 230, background: NO_FLYER_BG, position: 'relative', display: 'flex', alignItems: 'flex-end', padding: '22px 24px' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, color: 'var(--text)', lineHeight: 1.08, letterSpacing: '-0.02em', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', paddingBottom: 2 }}>{event.title || 'Event'}</span>
              </div>
            )}
            {/* Close chip */}
            <button onClick={onClose} title="Close"
              style={{ position: 'absolute', top: 12, right: 12, width: 34, height: 34, borderRadius: 10, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ✕
            </button>
          </div>

          {/* Details */}
          <div style={{ padding: '20px 20px 6px' }}>
            {/* Title lives in the hero when there's no flyer — don't repeat it here */}
            {event.title && event.image_url && (
              <h2 style={{ margin: '0 0 16px', fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                {event.title}
              </h2>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <MetaRow icon="📅" label="WHEN">
                {formatDate(event.date)}
                {isMulti && <span style={{ display: 'block', fontSize: 13, color: 'var(--text-3)', fontWeight: 500, marginTop: 2 }}>through {formatDate(event.end_date)}</span>}
              </MetaRow>

              {event.time_str && <MetaRow icon="🕐" label="TIME">{event.time_str}</MetaRow>}
              {event.location && <MetaRow icon="📍" label="WHERE">{event.location}</MetaRow>}

              {event.source_url && (
                <MetaRow icon="🔗" label="SOURCE">
                  <a href={event.source_url} target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ fontSize: 15, color: accent, fontWeight: 700, textDecoration: 'none' }}>
                    View original ›
                  </a>
                </MetaRow>
              )}
            </div>
          </div>
        </div>

        {/* Action row */}
        <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', padding: '12px 16px', paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {onToggleReminder !== undefined && (
            <button onClick={onToggleReminder} className={reminderOn ? 'btn-lime' : 'btn-dark'}
              style={{ width: '100%', padding: '14px', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {reminderOn ? '🔔 Reminder on' : '🔕 Reminder off'}
            </button>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} className="btn-dark" style={{ flex: 1, padding: '13px', fontSize: 15, fontWeight: 600 }}>
              Close
            </button>
            {onDelete && (
              <button onClick={handleDelete}
                style={{ flex: 1, padding: '13px', background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 16, fontSize: 15, fontWeight: 700, cursor: 'pointer', color: '#f87171', fontFamily: 'var(--font-display)' }}>
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
