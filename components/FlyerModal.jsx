'use client'

export default function FlyerModal({ events, activeIndex, onNavigate, onDelete, onClose }) {
  const event = events[activeIndex]
  const total = events.length
  const hasPrev = activeIndex > 0
  const hasNext = activeIndex < total - 1

  const displayDate = new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      style={{ background: 'rgba(109,40,217,0.18)', backdropFilter: 'blur(16px)' }}
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-sm rounded-t-3xl md:rounded-2xl overflow-hidden"
        style={{ background: '#fff', boxShadow: '0 8px 48px rgba(124,58,237,0.22)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 md:hidden">
          <div className="w-10 h-[3px] rounded-full" style={{ background: '#ede9fe' }} />
        </div>

        {/* Image with carousel controls */}
        <div className="relative" style={{ background: '#faf8ff' }}>
          {event.image_url ? (
            <img
              src={event.image_url}
              alt={event.title || 'flyer'}
              className="w-full object-contain"
              style={{ maxHeight: '52vh' }}
            />
          ) : (
            <div className="w-full flex items-center justify-center" style={{ height: 120, background: '#f3f0ff' }}>
              <span className="text-4xl">&#128203;</span>
            </div>
          )}

          {hasPrev && (
            <button
              onClick={() => onNavigate(activeIndex - 1)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold transition-all active:scale-90"
              style={{ background: 'rgba(255,255,255,0.92)', color: '#7c3aed', boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }}
            >
              &#8249;
            </button>
          )}
          {hasNext && (
            <button
              onClick={() => onNavigate(activeIndex + 1)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold transition-all active:scale-90"
              style={{ background: 'rgba(255,255,255,0.92)', color: '#7c3aed', boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }}
            >
              &#8250;
            </button>
          )}

          {total > 1 && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {events.map((_, i) => (
                <button
                  key={i}
                  onClick={() => onNavigate(i)}
                  className="rounded-full transition-all"
                  style={{
                    width: i === activeIndex ? 18 : 6,
                    height: 6,
                    background: i === activeIndex ? '#7c3aed' : 'rgba(255,255,255,0.7)',
                    boxShadow: i === activeIndex ? '0 0 6px rgba(124,58,237,0.5)' : 'none',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="p-5">
          {total > 1 && (
            <p className="text-xs font-semibold mb-2" style={{ color: '#a78bfa' }}>
              {activeIndex + 1} of {total} events
            </p>
          )}

          {event.title && (
            <h3 className="font-bold text-lg tracking-tight mb-3" style={{ color: '#1a1a2e' }}>{event.title}</h3>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2.5 text-sm" style={{ color: '#6b7280' }}>
              <span className="w-4 text-center">&#128197;</span>
              <span>{displayDate}</span>
            </div>
            {event.time_str && (
              <div className="flex items-center gap-2.5 text-sm" style={{ color: '#6b7280' }}>
                <span className="w-4 text-center">&#128336;</span>
                <span>{event.time_str}</span>
              </div>
            )}
            {event.location && (
              <div className="flex items-center gap-2.5 text-sm" style={{ color: '#6b7280' }}>
                <span className="w-4 text-center">&#128205;</span>
                <span>{event.location}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2.5 mt-5">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:bg-violet-50"
              style={{ background: '#f3f0ff', color: '#5b21b6' }}
            >
              Close
            </button>
            <button
              onClick={() => onDelete(event.id)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={{ background: 'rgba(239,68,68,0.07)', color: '#ef4444' }}
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
