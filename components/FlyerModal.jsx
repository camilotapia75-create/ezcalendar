'use client'

const IconDate = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="3"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)

const IconTime = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/>
    <polyline points="12 7 12 12 15.5 15.5"/>
  </svg>
)

const IconLocation = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
)

export default function FlyerModal({ event, onDelete, onClose }) {
  const displayDate = new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(16px)' }}
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-sm rounded-t-[28px] md:rounded-[24px] overflow-hidden"
        style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 -16px 60px rgba(0,0,0,0.6)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-9 h-[3px] rounded-full bg-white/10" />
        </div>

        {event.image_url && (
          <div className="relative" style={{ maxHeight: '52vh', overflow: 'hidden', background: '#000' }}>
            <img
              src={event.image_url}
              alt={event.title || 'flyer'}
              className="w-full object-contain"
              style={{ maxHeight: '52vh' }}
            />
          </div>
        )}

        <div className="p-5 pb-6">
          {event.title && (
            <h3 className="text-xl font-bold tracking-tight mb-4 leading-snug">{event.title}</h3>
          )}

          <div className="space-y-3">
            <div className="flex items-center gap-3" style={{ color: 'rgba(255,255,255,0.45)' }}>
              <IconDate />
              <span className="text-sm">{displayDate}</span>
            </div>
            {event.time_str && (
              <div className="flex items-center gap-3" style={{ color: 'rgba(255,255,255,0.45)' }}>
                <IconTime />
                <span className="text-sm">{event.time_str}</span>
              </div>
            )}
            {event.location && (
              <div className="flex items-center gap-3" style={{ color: 'rgba(255,255,255,0.45)' }}>
                <IconLocation />
                <span className="text-sm">{event.location}</span>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}
            >
              Close
            </button>
            <button
              onClick={() => onDelete(event.id)}
              className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95"
              style={{ background: 'rgba(239,68,68,0.1)', color: 'rgba(248,113,113,0.9)', border: '1px solid rgba(239,68,68,0.15)' }}
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
