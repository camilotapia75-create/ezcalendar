export default function DayCell({ day, currentMonth, isToday, events, onClick, onEventClick }) {
  return (
    <div
      onClick={onClick}
      className={[
        'relative flex flex-col rounded-2xl transition-all',
        currentMonth ? 'cursor-pointer active:scale-[0.97]' : 'opacity-20 pointer-events-none',
      ].join(' ')}
      style={{ minHeight: 100, padding: '6px 4px 4px' }}
    >
      {/* Day number */}
      <div className="flex justify-center mb-1">
        <span
          className="w-7 h-7 flex items-center justify-center rounded-full text-[13px] font-medium"
          style={isToday
            ? { background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontWeight: 700 }
            : { color: 'rgba(255,255,255,0.4)' }
          }
        >
          {day}
        </span>
      </div>

      {/* Events */}
      <div className="flex flex-col gap-[3px] flex-1">
        {events.slice(0, 2).map(event => (
          <button
            key={event.id}
            onClick={e => { e.stopPropagation(); onEventClick(event) }}
            className="w-full rounded-xl overflow-hidden transition-opacity active:opacity-70 hover:opacity-90 text-left"
          >
            {event.image_url ? (
              <div className="relative w-full" style={{ aspectRatio: '1/1' }}>
                <img
                  src={event.image_url}
                  alt={event.title || ''}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {event.title && (
                  <div
                    className="absolute bottom-0 left-0 right-0 px-1 py-0.5"
                    style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)' }}
                  >
                    <p className="text-[9px] text-white font-medium truncate leading-tight">{event.title}</p>
                  </div>
                )}
              </div>
            ) : (
              <div
                className="w-full px-1.5 py-1.5 rounded-xl"
                style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.2)' }}
              >
                <p className="text-[10px] text-violet-300 truncate leading-tight font-medium">{event.title}</p>
              </div>
            )}
          </button>
        ))}
        {events.length > 2 && (
          <p className="text-[9px] text-white/25 text-center mt-0.5">+{events.length - 2}</p>
        )}
      </div>
    </div>
  )
}
