'use client'

export default function FlyerModal({ event, onDelete, onClose }) {
  const displayDate = new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <div
      className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {event.image_url && (
          <div className="bg-black flex items-center justify-center" style={{ maxHeight: '60vh' }}>
            <img
              src={event.image_url}
              alt={event.title || 'flyer'}
              className="w-full object-contain"
              style={{ maxHeight: '60vh' }}
            />
          </div>
        )}
        <div className="p-5">
          {event.title && <h3 className="font-bold text-lg leading-tight mb-3">{event.title}</h3>}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-400">
              <span>📅</span><span>{displayDate}</span>
            </div>
            {event.time_str && (
              <div className="flex items-center gap-2 text-gray-400">
                <span>🕐</span><span>{event.time_str}</span>
              </div>
            )}
            {event.location && (
              <div className="flex items-center gap-2 text-gray-400">
                <span>📍</span><span>{event.location}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-5">
            <button
              onClick={onClose}
              className="flex-1 bg-white/5 hover:bg-white/10 rounded-xl py-2.5 text-sm font-medium transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => onDelete(event.id)}
              className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl py-2.5 text-sm font-medium transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
