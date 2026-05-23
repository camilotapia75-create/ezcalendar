'use client'

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function DayView({ date, events, onClose, onAdd, onDelete }) {
  const dayName = DAYS[date.getDay()]
  const monthName = MONTHS[date.getMonth()]
  const dayNum = date.getDate()
  const year = date.getFullYear()

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <div
        className="flex-1 flex flex-col rounded-t-3xl overflow-hidden"
        style={{ background: '#faf8ff', marginTop: '10vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: '#ddd6fe' }} />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '2px solid #ede9fe' }}
        >
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#a78bfa' }}>
              {dayName}
            </p>
            <h2 className="text-2xl font-black tracking-tight" style={{ color: '#1a1a2e' }}>
              {monthName} {dayNum}
              <span className="text-lg font-normal ml-2" style={{ color: '#c4b5fd' }}>{year}</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onAdd}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 2px 12px rgba(124,58,237,0.35)' }}
            >
              + Scan
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all"
              style={{ background: '#ede9fe', color: '#7c3aed' }}
            >
              &#10005;
            </button>
          </div>
        </div>

        {/* Events list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-20">
              <div className="text-5xl mb-2">&#128204;</div>
              <p className="text-base font-semibold" style={{ color: '#9ca3af' }}>Nothing pinned yet</p>
              <p className="text-sm" style={{ color: '#d1d5db' }}>Tap Scan to add a flyer</p>
            </div>
          ) : (
            events.map(event => {
              const displayDate = new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
              })
              return (
                <div
                  key={event.id}
                  className="rounded-2xl overflow-hidden"
                  style={{ background: '#fff', boxShadow: '0 4px 20px rgba(124,58,237,0.10)', border: '1px solid #ede9fe' }}
                >
                  {event.image_url && (
                    <div className="relative">
                      <img
                        src={event.image_url}
                        alt={event.title || 'flyer'}
                        className="w-full object-cover"
                        style={{ maxHeight: '55vw' }}
                      />
                      {/* Decorative pin */}
                      <div style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)' }}>
                        <svg width="18" height="24" viewBox="0 0 18 24" fill="none">
                          <circle cx="9" cy="7" r="7" fill="#ef4444" />
                          <circle cx="6.5" cy="4.5" r="2.5" fill="rgba(255,255,255,0.32)" />
                          <line x1="9" y1="13" x2="9" y2="23" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </div>
                    </div>
                  )}
                  <div className="p-4">
                    {event.title && (
                      <h3 className="font-bold text-xl tracking-tight mb-3" style={{ color: '#1a1a2e' }}>
                        {event.title}
                      </h3>
                    )}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm" style={{ color: '#6b7280' }}>
                        <span>&#128197;</span><span>{displayDate}</span>
                      </div>
                      {event.time_str && (
                        <div className="flex items-center gap-2 text-sm" style={{ color: '#6b7280' }}>
                          <span>&#128336;</span><span>{event.time_str}</span>
                        </div>
                      )}
                      {event.location && (
                        <div className="flex items-center gap-2 text-sm" style={{ color: '#6b7280' }}>
                          <span>&#128205;</span><span>{event.location}</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => onDelete(event.id)}
                      className="text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
                      style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
