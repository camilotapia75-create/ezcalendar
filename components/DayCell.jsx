const PushPin = () => (
  <div style={{
    position: 'absolute', top: -10, left: '50%',
    transform: 'translateX(-50%)', zIndex: 5, pointerEvents: 'none',
  }}>
    <svg width="13" height="17" viewBox="0 0 13 17" fill="none">
      <circle cx="6.5" cy="5" r="5" fill="#ef4444" />
      <circle cx="4.8" cy="3.2" r="1.8" fill="rgba(255,255,255,0.32)" />
      <line x1="6.5" y1="9.5" x2="6.5" y2="16.5" stroke="#9ca3af" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  </div>
)

const getFanStyle = (idx, total) => {
  if (total === 1) return { left: '6%', right: '6%', rotate: -1 }
  if (total === 2) return idx === 0
    ? { left: '-4%', right: '32%', rotate: -9 }
    : { left: '32%', right: '-4%', rotate: 9 }
  if (idx === 0) return { left: '-6%', right: '44%', rotate: -13 }
  if (idx === 1) return { left: '17%', right: '17%', rotate: 1 }
  return { left: '44%', right: '-6%', rotate: 13 }
}

export default function DayCell({ day, currentMonth, isToday, isWeekend, events, onClick, onEventClick }) {
  const displayed = events.slice(0, 3)
  const count = displayed.length

  return (
    <div
      onClick={onClick}
      className={[
        'relative flex flex-col',
        'min-h-[108px] md:min-h-[128px]',
        currentMonth ? 'cursor-pointer' : 'pointer-events-none',
      ].join(' ')}
      style={{
        borderRight: '3px solid #111',
        borderBottom: '3px solid #111',
        background: !currentMonth
          ? 'rgba(150,100,45,0.30)'
          : isWeekend
          ? 'rgba(255,245,225,0.82)'
          : 'rgba(255,250,238,0.90)',
      }}
    >
      {/* Day number */}
      <div className="p-1.5 md:p-2">
        <span
          className="inline-flex w-6 h-6 text-[11px] items-center justify-center rounded-full font-semibold"
          style={{
            background: isToday ? '#7c3aed' : 'transparent',
            color: isToday ? '#fff'
              : !currentMonth ? 'rgba(110,70,20,0.45)'
              : isWeekend ? '#92400e'
              : '#374151',
          }}
        >
          {day}
        </span>
      </div>

      {/* Fanned flyers with pins */}
      {count > 0 && (
        <div className="flex-1 relative">
          <button
            onClick={(e) => { e.stopPropagation(); onEventClick(events) }}
            className="absolute inset-0"
            style={{ overflow: 'visible' }}
          >
            {displayed.map((event, idx) => {
              const s = getFanStyle(idx, count)
              return (
                <div
                  key={event.id}
                  className="absolute"
                  style={{
                    left: s.left,
                    right: s.right,
                    bottom: 10,
                    height: 54,
                    transform: `rotate(${s.rotate}deg)`,
                    zIndex: idx + 1,
                  }}
                >
                  <PushPin />
                  {event.image_url ? (
                    <img
                      src={event.image_url}
                      alt={event.title || ''}
                      className="w-full h-full object-cover rounded"
                      style={{ border: '2.5px solid white', boxShadow: '0 3px 12px rgba(0,0,0,0.22)' }}
                    />
                  ) : (
                    <div
                      className="w-full h-full rounded flex items-center justify-center px-1"
                      style={{
                        background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)',
                        border: '1.5px solid #c4b5fd',
                        boxShadow: '0 2px 8px rgba(124,58,237,0.15)',
                      }}
                    >
                      <p className="text-[8px] font-semibold text-center" style={{ color: '#5b21b6' }}>{event.title}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </button>

          {events.length > 3 && (
            <div
              className="absolute top-0 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
              style={{ background: '#7c3aed', zIndex: 20 }}
            >
              +{events.length - 3}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
