'use client'

export default function FlyerModal({ event, onDelete, onClose }) {
  const displayDate = new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-sm rounded-t-3xl md:rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.08)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 md:hidden">
          <div className="w-8 h-[3px] rounded-full bg-white/10" />
        </div>

        {event.image_url && (
          <img
            src={event.image_url}
            alt={event.title || 'flyer'}
            className="w-full object-contain"
            style={{ maxHeight: '55vh', background: '#000' }}
          />
        )}

        <div className="p-5">
          {event.title && (
            <h3 className="font-bold text-lg tracking-tight mb-3">{event.title}</h3>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2.5 text-sm text-zinc-400">
              <span className="w-4 text-center opacity-60">&#128197;</span>
              <span>{displayDate}</span>
            </div>
            {event.time_str && (
              <div className="flex items-center gap-2.5 text-sm text-zinc-400">
                <span className="w-4 text-center opacity-60">&#128336;</span>
                <span>{event.time_str}</span>
              </div>
            )}
            {event.location && (
              <div className="flex items-center gap-2.5 text-sm text-zinc-400">
                <span className="w-4 text-center opacity-60">&#128205;</span>
                <span>{event.location}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2.5 mt-5">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-white transition-colors"
              style={{ background: '#1a1a1e' }}
            >
              Close
            </button>
            <button
              onClick={() => onDelete(event.id)}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:text-red-300 transition-colors"
              style={{ background: 'rgba(239,68,68,0.08)' }}
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
